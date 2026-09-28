import json
import os
import unittest
from unittest.mock import patch
import httpx
from fastapi import HTTPException
from app import runtime
from app.providers import ModelProvider
from app.runtime import ProviderConfig


MESSAGES = [
    {'role': 'system', 'content': 'Follow the BA rules.'},
    {'role': 'user', 'content': 'Draft one requirement.'},
]
SCHEMA = {'type': 'object', 'properties': {'summary': {'type': 'string'}}, 'required': ['summary'], 'additionalProperties': False}


def provider_payload(provider):
    if provider == 'ollama':
        return {'message': {'content': 'response'}, 'model': 'test-model', 'prompt_eval_count': 12, 'eval_count': 3, 'done_reason': 'stop'}
    if provider == 'openai':
        return {'status': 'completed', 'model': 'test-model', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'response'}]}], 'usage': {'input_tokens': 12, 'output_tokens': 3}}
    if provider == 'gemini':
        return {'status': 'completed', 'model': 'test-model', 'steps': [{'type': 'model_output', 'content': [{'type': 'text', 'text': 'response'}]}], 'usage': {'total_input_tokens': 12, 'total_output_tokens': 3}}
    return {'choices': [{'message': {'content': 'response'}, 'finish_reason': 'stop'}], 'model': 'test-model', 'usage': {'prompt_tokens': 12, 'completion_tokens': 3}}


class ProviderContractTests(unittest.IsolatedAsyncioTestCase):
    async def call_with_transport(self, provider, handler, *, schema=SCHEMA):
        real_client = httpx.AsyncClient
        with patch('app.providers.httpx.AsyncClient', side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)):
            return await ModelProvider(ProviderConfig(provider=provider, model='test-model', api_key='test-key')).complete(MESSAGES, schema)

    async def test_provider_http_contracts_and_usage(self):
        expected_hosts = {
            'ollama': '127.0.0.1', 'openai': 'api.openai.com', 'gemini': 'generativelanguage.googleapis.com',
            'openrouter': 'openrouter.ai', 'huggingface': 'router.huggingface.co',
        }
        for provider in expected_hosts:
            with self.subTest(provider=provider):
                seen = []
                def handler(request):
                    seen.append(request)
                    return httpx.Response(200, json=provider_payload(provider))
                result = await self.call_with_transport(provider, handler)
                request = seen[0]
                body = json.loads(request.content)
                self.assertEqual(result['usage']['input_tokens'], 12)
                self.assertEqual(result['usage']['output_tokens'], 3)
                self.assertIsNone(result['usage']['cost'])
                self.assertFalse(body['stream'])
                self.assertEqual(request.url.host, expected_hosts[provider])
                if provider == 'ollama':
                    self.assertEqual(request.url.path, '/api/chat')
                    self.assertEqual(body['format'], SCHEMA)
                elif provider == 'openai':
                    self.assertEqual(request.url.path, '/v1/responses')
                    self.assertEqual(request.headers['authorization'], 'Bearer test-key')
                    self.assertFalse(body['store'])
                    self.assertEqual(body['instructions'], MESSAGES[0]['content'])
                    self.assertEqual(body['text']['format']['schema'], SCHEMA)
                    self.assertTrue(body['text']['format']['strict'])
                elif provider == 'gemini':
                    self.assertEqual(request.url.path, '/v1/interactions')
                    self.assertEqual(request.headers['x-goog-api-key'], 'test-key')
                    self.assertFalse(body['store'])
                    self.assertEqual(body['system_instruction'], MESSAGES[0]['content'])
                    self.assertEqual(body['input'][0]['type'], 'user_input')
                    self.assertEqual(body['response_format']['schema'], SCHEMA)
                else:
                    self.assertEqual(request.headers['authorization'], 'Bearer test-key')
                    self.assertTrue(body['response_format']['json_schema']['strict'])
                    if provider == 'openrouter':
                        self.assertFalse(body['provider']['allow_fallbacks'])

    async def test_environment_credentials_are_provider_specific(self):
        environment = {'OPENAI_API_KEY': 'openai-env', 'GEMINI_API_KEY': 'gemini-env', 'OPENROUTER_API_KEY': 'router-env', 'HF_TOKEN': 'hf-env'}
        with patch.dict(os.environ, environment, clear=True):
            for provider, expected in [('openai', 'openai-env'), ('gemini', 'gemini-env'), ('openrouter', 'router-env'), ('huggingface', 'hf-env')]:
                with self.subTest(provider=provider):
                    self.assertEqual(runtime.environment_credential(provider), expected)
                    with patch.object(runtime, 'config', ProviderConfig(provider=provider, model='test-model')):
                        public = runtime.public_config()
                    self.assertTrue(public['has_key'])
                    self.assertNotIn('api_key', public)

    async def test_gemini_allows_google_api_key_as_environment_fallback(self):
        with patch.dict(os.environ, {'GOOGLE_API_KEY': 'google-env'}, clear=True):
            self.assertEqual(runtime.environment_credential('gemini'), 'google-env')

    async def test_truncated_responses_are_not_returned_as_complete(self):
        cases = {
            'ollama': {'message': {'content': 'partial'}, 'done_reason': 'length'},
            'openai': {'status': 'incomplete', 'incomplete_details': {'reason': 'max_output_tokens'}, 'output': []},
            'gemini': {'status': 'incomplete', 'steps': []},
            'openrouter': {'choices': [{'message': {'content': 'partial'}, 'finish_reason': 'length'}]},
        }
        for provider, payload in cases.items():
            with self.subTest(provider=provider):
                transport = lambda request, payload=payload: httpx.Response(200, json=payload)
                with self.assertRaises(HTTPException) as caught:
                    await self.call_with_transport(provider, transport, schema=None)
                self.assertEqual(caught.exception.status_code, 502)
                self.assertIn('output space', caught.exception.detail)

    async def test_openai_refusal_is_not_treated_as_a_proposal(self):
        payload = {'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'No'}]}]}
        with self.assertRaises(HTTPException) as caught:
            await self.call_with_transport('openai', lambda request: httpx.Response(200, json=payload))
        self.assertIn('declined', caught.exception.detail)

    async def test_provider_errors_do_not_echo_remote_secrets(self):
        for provider in ['ollama', 'openai', 'gemini', 'openrouter', 'huggingface']:
            with self.subTest(provider=provider):
                with self.assertRaises(HTTPException) as caught:
                    await self.call_with_transport(provider, lambda request: httpx.Response(401, text='provider echoed secret-key'))
                self.assertNotIn('secret-key', caught.exception.detail)

    async def test_unavailable_model_quota_and_bad_schema_are_classified_without_fallback(self):
        for status, expected in [(400, 'structured-output'), (404, 'not found'), (429, 'quota')]:
            with self.subTest(status=status):
                with self.assertRaises(HTTPException) as caught:
                    await self.call_with_transport('openai', lambda request, status=status: httpx.Response(status, text='provider detail'))
                self.assertIn(expected, caught.exception.detail.lower())

    async def test_unavailable_endpoint_and_timeout_leave_no_provider_response(self):
        for error, expected_status in [(httpx.ConnectError('offline'), 503), (httpx.TimeoutException('slow'), 504)]:
            with self.subTest(error=type(error).__name__):
                def handler(request, error=error):
                    raise error
                with self.assertRaises(HTTPException) as caught:
                    await self.call_with_transport('gemini', handler)
                self.assertEqual(expected_status, caught.exception.status_code)


if __name__ == '__main__':
    unittest.main()

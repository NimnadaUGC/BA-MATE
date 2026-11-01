import json
import time
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

from app import token_management as tokens
from app.contracts import RunRequest
from app.runtime import ProviderConfig
from app.workflow import prepare_messages, schema_for_provider


class CapabilityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tokens.clear_capability_cache()

    def tearDown(self):
        tokens.clear_capability_cache()

    async def test_model_capacity_above_old_ceiling_and_output_limit(self):
        seen = []
        def handler(request):
            seen.append(request)
            return httpx.Response(200, json={'data': [{'id': 'test/large', 'context_length': 1000000,
                'top_provider': {'context_length': 1000000, 'max_completion_tokens': 131072}}]})
        real = httpx.AsyncClient
        with patch('app.token_management.httpx.AsyncClient', side_effect=lambda **kw: real(transport=httpx.MockTransport(handler), **kw)):
            cfg = await tokens.resolve_config(ProviderConfig(provider='openrouter', model='test/large', context_mode='model', output_tokens=32768))
            again = await tokens.resolve_config(cfg)
        self.assertEqual(cfg.context_tokens, 1000000)
        self.assertEqual(again.output_tokens, 32768)
        self.assertEqual(len(seen), 1)
        self.assertEqual(seen[0].method, 'GET')
        self.assertFalse(seen[0].content)
        self.assertNotIn('authorization', seen[0].headers)

    async def test_context_and_output_are_independently_validated(self):
        caps = {'context_tokens': 262144, 'output_tokens': 16384}
        for cfg in [ProviderConfig(context_tokens=300000), ProviderConfig(context_tokens=262144, output_tokens=32768)]:
            with self.assertRaises(HTTPException) as caught:
                tokens.apply_model_limits(cfg, caps)
            self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(tokens.apply_model_limits(ProviderConfig(context_tokens=131072, output_tokens=16384), caps).context_tokens, 131072)

    async def test_unknown_auto_model_fails_explicitly_but_manual_still_works(self):
        real = httpx.AsyncClient
        with patch('app.token_management.httpx.AsyncClient', side_effect=lambda **kw: real(transport=httpx.MockTransport(lambda req: httpx.Response(503)), **kw)):
            with self.assertRaises(HTTPException) as caught:
                await tokens.resolve_config(ProviderConfig(provider='openrouter', model='missing', context_mode='model'))
        self.assertEqual(caught.exception.status_code, 409)
        cfg = await tokens.resolve_config(ProviderConfig(provider='openrouter', model='missing', context_tokens=131072))
        self.assertEqual(cfg.context_tokens, 131072)

    async def test_provider_changes_do_not_reuse_another_models_capacity(self):
        tokens._catalogue = [{'id': 'large', 'context_length': 1000000}]
        tokens._catalogue_at = time.monotonic()
        with self.assertRaises(HTTPException):
            await tokens.resolve_config(ProviderConfig(provider='openrouter', model='different', context_mode='model'))
        cfg = await tokens.resolve_config(ProviderConfig(provider='ollama', model='large', context_tokens=8192))
        self.assertEqual(cfg.context_tokens, 8192)

    async def test_smaller_top_provider_limit_is_respected_in_manual_mode(self):
        tokens._catalogue = [{'id': 'large', 'context_length': 1000000, 'top_provider': {'context_length': 131072}}]
        with self.assertRaises(HTTPException):
            await tokens.resolve_config(ProviderConfig(provider='openrouter', model='large', context_tokens=262144))


class RequestBudgetTests(unittest.TestCase):
    def request(self, **changes):
        return RunRequest.model_validate({'request_id': 'budget', 'project_id': 'synthetic', 'task': 'clarify',
            'prompt': 'Find one gap.', 'context': [{'id': 'SRC-1', 'type': 'Source', 'content': 'Business evidence. ' * 9000}],
            **changes})

    def test_large_capacity_preserves_evidence_previously_cut_off(self):
        request = self.request()
        _, small = prepare_messages(request, ProviderConfig(context_tokens=32768), schema_for_provider('clarify'))
        messages, large = prepare_messages(request, ProviderConfig(context_tokens=262144, output_tokens=32768), schema_for_provider('clarify'))
        self.assertIn('SRC-1', small['partial_reference_ids'])
        self.assertEqual(large['partial_reference_ids'], [])
        self.assertIn(request.context[0].content, json.loads(messages[1]['content'].split('\n', 1)[1])[0]['content'])
        self.assertLessEqual(large['estimated_tokens'] + large['output_reservation'] + large['safety_tokens'], large['token_budget'])

    def test_unicode_json_schema_and_history_are_in_budget(self):
        request = self.request(context=[{'id': 'SRC-1', 'type': 'Source', 'content': 'සිංහල 中文 😀 "\\\n' * 6000}],
            history=[{'role': 'user', 'content': 'Earlier question ' * 100}] * 5)
        messages, receipt = prepare_messages(request, ProviderConfig(context_tokens=32768), schema_for_provider('clarify'))
        self.assertLessEqual(receipt['estimated_tokens'] + receipt['output_reservation'] + receipt['safety_tokens'], receipt['token_budget'])
        self.assertEqual(receipt['estimated_tokens'], tokens.request_tokens(messages, schema_for_provider('clarify')))
        self.assertTrue(receipt['partial_reference_ids'])
        self.assertGreater(receipt['history_messages_omitted'], 0)

    def test_offline_missing_tokenizer_does_not_download_during_requests(self):
        with patch('app.token_management._encoding', return_value=None):
            self.assertEqual(tokens.count_tokens('සිංහල 😀'), len('සිංහල 😀'.encode('utf-8')))
            self.assertIn('unavailable', tokens.counting_method())

    def test_output_reservation_cannot_consume_context(self):
        with self.assertRaises(HTTPException):
            tokens.apply_model_limits(ProviderConfig(context_tokens=8192, output_tokens=8192), {})

    def test_large_models_are_not_limited_to_one_hundred_references_or_thirty_messages(self):
        request = self.request(context=[{'id': f'SRC-{i}', 'type': 'Source', 'content': 'Reviewed source.'} for i in range(150)],
                               history=[{'role': 'user', 'content': f'Earlier question {i}'} for i in range(60)])
        _, receipt = prepare_messages(request, ProviderConfig(context_tokens=262144, output_tokens=32768), schema_for_provider('clarify'))
        self.assertEqual(len(receipt['included_reference_ids']), 150)
        self.assertEqual(receipt['history_messages_included'], 60)
        self.assertEqual(receipt['history_messages_omitted'], 0)


if __name__ == '__main__':
    unittest.main()

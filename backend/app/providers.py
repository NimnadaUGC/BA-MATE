"""Real inference adapters. Provider failures never become demonstration output."""
import httpx
from fastapi import HTTPException
from . import runtime
from .runtime import ProviderConfig


REMOTE_ENDPOINTS = {
    'openai': 'https://api.openai.com/v1/responses',
    'gemini': 'https://generativelanguage.googleapis.com/v1/interactions',
    'openrouter': 'https://openrouter.ai/api/v1/chat/completions',
    'huggingface': 'https://router.huggingface.co/v1/chat/completions',
}


def _key_for(config: ProviderConfig):
    return config.api_key or runtime.environment_credential(config.provider)


def _openai_request(config: ProviderConfig, messages: list[dict], schema: dict | None):
    instructions = '\n\n'.join(message['content'] for message in messages if message.get('role') == 'system')
    input_messages = [message for message in messages if message.get('role') != 'system']
    body = {
        'model': config.model,
        'input': input_messages,
        'stream': False,
        'store': False,
        'temperature': config.temperature,
        'max_output_tokens': config.output_tokens,
    }
    if instructions:
        body['instructions'] = instructions
    if schema:
        body['text'] = {'format': {'type': 'json_schema', 'name': 'ba_workflow', 'strict': True, 'schema': schema}}
    return body


def _gemini_request(config: ProviderConfig, messages: list[dict], schema: dict | None):
    system_instruction = '\n\n'.join(message['content'] for message in messages if message.get('role') == 'system')
    steps = []
    for message in messages:
        if message.get('role') == 'system':
            continue
        step_type = 'model_output' if message.get('role') == 'assistant' else 'user_input'
        steps.append({'type': step_type, 'content': [{'type': 'text', 'text': message['content']}]})
    body = {
        'model': config.model,
        'input': steps,
        'stream': False,
        'store': False,
        'generation_config': {'temperature': config.temperature, 'max_output_tokens': config.output_tokens},
    }
    if system_instruction:
        body['system_instruction'] = system_instruction
    if schema:
        body['response_format'] = {'type': 'text', 'mime_type': 'application/json', 'schema': schema}
    return body


def _chat_completion_request(config: ProviderConfig, messages: list[dict], schema: dict | None):
    body = {'model': config.model, 'messages': messages, 'stream': False,
            'temperature': config.temperature, 'max_tokens': config.output_tokens}
    if schema:
        body['response_format'] = {'type': 'json_schema', 'json_schema': {'name': 'ba_workflow', 'strict': True, 'schema': schema}}
        if config.provider == 'openrouter':
            body['provider'] = {'require_parameters': True, 'allow_fallbacks': False}
    return body


def _extract_openai(payload: dict, config: ProviderConfig):
    status = payload.get('status')
    incomplete_reason = (payload.get('incomplete_details') or {}).get('reason')
    if status == 'incomplete' or incomplete_reason:
        raise HTTPException(502, 'The model ran out of output space. Request fewer artifacts or increase the output limit in Settings.')
    if status in {'failed', 'cancelled'} or payload.get('error'):
        raise HTTPException(502, 'OpenAI could not complete the response. No project changes were applied.')
    texts, refused = [], False
    for item in payload.get('output') or []:
        if item.get('type') != 'message':
            continue
        for content in item.get('content') or []:
            if content.get('type') == 'output_text' and isinstance(content.get('text'), str):
                texts.append(content['text'])
            elif content.get('type') == 'refusal':
                refused = True
    if refused and not texts:
        raise HTTPException(502, 'OpenAI declined this request. No project changes were applied; revise the task or use manual BA work.')
    usage = payload.get('usage') or {}
    return {
        'text': ''.join(texts),
        'model': payload.get('model', config.model),
        'provider': 'openai',
        'usage': {'input_tokens': usage.get('input_tokens'), 'output_tokens': usage.get('output_tokens'), 'cost': None},
    }


def _extract_gemini(payload: dict, config: ProviderConfig):
    status = payload.get('status')
    if status == 'incomplete':
        raise HTTPException(502, 'The model ran out of output space. Request fewer artifacts or increase the output limit in Settings.')
    if status in {'failed', 'cancelled'} or payload.get('errors'):
        raise HTTPException(502, 'Gemini could not complete the response. No project changes were applied.')
    texts = []
    for step in payload.get('steps') or []:
        if step.get('type') != 'model_output':
            continue
        for content in step.get('content') or []:
            if content.get('type') == 'text' and isinstance(content.get('text'), str):
                texts.append(content['text'])
    usage = payload.get('usage') or {}
    return {
        'text': ''.join(texts),
        'model': payload.get('model', config.model),
        'provider': 'gemini',
        'usage': {'input_tokens': usage.get('total_input_tokens'), 'output_tokens': usage.get('total_output_tokens'), 'cost': None},
    }


def _extract_chat_completion(payload: dict, config: ProviderConfig):
    choice = payload['choices'][0]
    if choice.get('message', {}).get('refusal'):
        raise HTTPException(502, 'The provider declined this request. No project changes were applied; revise the task or use manual BA work.')
    finish = choice.get('finish_reason')
    if finish in {'length', 'max_tokens'}:
        raise HTTPException(502, 'The model ran out of output space. Request fewer artifacts or increase the output limit in Settings.')
    if finish == 'content_filter':
        raise HTTPException(502, 'The provider stopped this response for safety review. No project changes were applied.')
    usage = payload.get('usage') or {}
    return {
        'text': choice['message']['content'],
        'model': payload.get('model', config.model),
        'provider': payload.get('provider', config.provider),
        'usage': {'input_tokens': usage.get('prompt_tokens'), 'output_tokens': usage.get('completion_tokens'), 'cost': usage.get('cost')},
    }


def _provider_error(status_code: int):
    if status_code in {401, 403}:
        return 'The provider rejected the API key or this key cannot use the selected model.'
    if status_code == 404:
        return 'The selected model or endpoint was not found.'
    if status_code == 429:
        return 'The provider is busy or your request quota is exhausted. Try later or change the connection in Settings.'
    if status_code >= 500:
        return 'The provider is temporarily unavailable. Try again later; no project changes were applied.'
    return 'The provider rejected the request. Check the model identifier and structured-output support in Settings.'


class ModelProvider:
    def __init__(self, config: ProviderConfig):
        self.config = config

    async def complete(self, messages: list[dict], schema: dict | None = None):
        cfg = self.config
        if cfg.provider == 'ollama':
            url = cfg.base_url + '/api/chat'
            headers = {}
            body = {'model': cfg.model, 'messages': messages, 'stream': False,
                    'options': {'temperature': cfg.temperature, 'num_ctx': cfg.context_tokens, 'num_predict': cfg.output_tokens}}
            if schema:
                body['format'] = schema
        else:
            key = _key_for(cfg)
            if not key:
                raise HTTPException(409, 'Add your provider key in Settings before starting an AI task.')
            url = REMOTE_ENDPOINTS[cfg.provider]
            headers = {'x-goog-api-key': key} if cfg.provider == 'gemini' else {'Authorization': f'Bearer {key}'}
            if cfg.provider == 'openai':
                body = _openai_request(cfg, messages, schema)
            elif cfg.provider == 'gemini':
                body = _gemini_request(cfg, messages, schema)
            else:
                body = _chat_completion_request(cfg, messages, schema)
        try:
            async with httpx.AsyncClient(timeout=cfg.timeout_seconds, follow_redirects=False) as client:
                response = await client.post(url, headers=headers, json=body)
            if response.status_code >= 400:
                raise HTTPException(502, _provider_error(response.status_code))
            payload = response.json()
            if cfg.provider == 'ollama':
                result = {
                    'text': payload['message']['content'],
                    'model': payload.get('model', cfg.model),
                    'usage': {'input_tokens': payload.get('prompt_eval_count'), 'output_tokens': payload.get('eval_count'), 'cost': None},
                    'provider': 'ollama',
                }
                if payload.get('done_reason') in {'length', 'max_tokens'}:
                    raise HTTPException(502, 'The model ran out of output space. Request fewer artifacts or increase the output limit in Settings.')
            elif cfg.provider == 'openai':
                result = _extract_openai(payload, cfg)
            elif cfg.provider == 'gemini':
                result = _extract_gemini(payload, cfg)
            else:
                result = _extract_chat_completion(payload, cfg)
            if not isinstance(result['text'], str) or not result['text'].strip():
                raise ValueError('Empty response')
            return result
        except httpx.TimeoutException as exc:
            raise HTTPException(504, 'The model took too long. Your work is saved; try a smaller task or increase the timeout.') from exc
        except httpx.RequestError as exc:
            raise HTTPException(503, 'Cannot reach the model. Check the connection in Settings and start Ollama if using a local model.') from exc
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise HTTPException(502, 'The provider returned an unreadable response. No project changes were applied.') from exc

"""Model limits and honest local token estimates. Discovery never sends project content."""
import math
import time
import os
import sys
import tempfile
import hashlib
from pathlib import Path
from functools import lru_cache

import httpx
from fastapi import HTTPException

from .runtime import ProviderConfig

_catalogue: list[dict] = []
_catalogue_at = 0.0
_last_attempt = 0.0
CACHE_SECONDS = 3600


def clear_capability_cache():
    global _catalogue, _catalogue_at, _last_attempt
    _catalogue, _catalogue_at, _last_attempt = [], 0.0, 0.0


def _positive(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


async def model_capabilities(provider: str, model: str, refresh=False):
    global _catalogue, _catalogue_at, _last_attempt
    if provider != 'openrouter':
        return {'status': 'manual', 'provider': provider, 'model': model,
                'context_tokens': None, 'output_tokens': None,
                'note': 'Use the limits published for this model. Local Ollama also depends on available memory.'}
    now = time.monotonic()
    failed = False
    if refresh or (now - _catalogue_at > CACHE_SECONDS and now - _last_attempt > 30):
        _last_attempt = now
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
                response = await client.get('https://openrouter.ai/api/v1/models')
                response.raise_for_status()
                data = response.json()['data']
                if not isinstance(data, list):
                    raise ValueError('Invalid model catalogue')
                _catalogue = data
                _catalogue_at = now
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            failed = True
    item = next((item for item in _catalogue if isinstance(item, dict) and item.get('id') == model), None)
    stale = bool(_catalogue_at and now - _catalogue_at > CACHE_SECONDS)
    if not item:
        return {'status': 'unavailable', 'provider': provider, 'model': model,
                'context_tokens': None, 'output_tokens': None,
                'note': 'Model limits could not be verified. Retry discovery or use explicit manual limits.'}
    top = item.get('top_provider') or {}
    contexts = [v for v in [_positive(item.get('context_length')), _positive(top.get('context_length'))] if v]
    return {'status': 'cached' if failed or stale else 'available', 'provider': provider, 'model': model,
            'context_tokens': min(contexts) if contexts else None,
            'output_tokens': _positive(top.get('max_completion_tokens')),
            'supported_parameters': item.get('supported_parameters') or [],
            'note': 'Published model/top-provider limits; individual serving endpoints and account quotas may be lower.'}


def apply_model_limits(config: ProviderConfig, capabilities: dict):
    context_limit = capabilities.get('context_tokens')
    output_limit = capabilities.get('output_tokens')
    if config.context_mode == 'model' and config.provider == 'openrouter' and not context_limit:
        raise HTTPException(409, 'Cannot verify the model context capacity. Retry model-limit discovery in Settings or choose manual limits.')
    context = context_limit if config.context_mode == 'model' and context_limit else config.context_tokens
    if context_limit and context > context_limit:
        raise HTTPException(422, f'This model advertises {context_limit:,} context tokens. Reduce the manual context budget or use the model capacity setting.')
    if output_limit and config.output_tokens > output_limit:
        raise HTTPException(422, f'This model advertises at most {output_limit:,} output tokens. Reduce Maximum output in Settings.')
    if config.output_tokens >= context - 1024:
        raise HTTPException(422, 'Leave at least 1,024 context tokens for instructions and evidence after reserving output space.')
    return config.model_copy(update={'context_tokens': context})


async def resolve_config(config: ProviderConfig):
    # Manual settings remain usable offline without a catalogue request. Settings
    # discovery validates their published limits when OpenRouter is available.
    if config.provider == 'openrouter' and config.context_mode == 'model':
        capabilities = await model_capabilities(config.provider, config.model)
    else:
        item = next((item for item in _catalogue if isinstance(item, dict) and item.get('id') == config.model), None) if config.provider == 'openrouter' else None
        top = (item or {}).get('top_provider') or {}
        contexts = [v for v in [_positive((item or {}).get('context_length')), _positive(top.get('context_length'))] if v]
        capabilities = {'context_tokens': min(contexts) if contexts else None, 'output_tokens': _positive(top.get('max_completion_tokens'))}
    return apply_model_limits(config, capabilities)


@lru_cache(maxsize=1)
def _encoding():
    try:
        import tiktoken
        bundled = Path(getattr(sys, '_MEIPASS', '')) / 'token-cache'
        cache = bundled if bundled.is_dir() else Path(os.environ.get('TIKTOKEN_CACHE_DIR', os.environ.get('DATA_GYM_CACHE_DIR', Path(tempfile.gettempdir()) / 'data-gym-cache')))
        name = hashlib.sha1(b'https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken').hexdigest()
        if not (cache / name).is_file():
            return None  # Never download tokenizer data during a project request.
        if bundled.is_dir():
            os.environ['TIKTOKEN_CACHE_DIR'] = str(bundled)
        return tiktoken.get_encoding('o200k_base')
    except Exception:
        # Offline first launch must still work if tokenizer data is unavailable.
        return None


def count_tokens(value: str):
    encoding = _encoding()
    if encoding is None:
        return len(value.encode('utf-8'))
    # This reference tokenizer is not claimed to be the selected model's exact
    # tokenizer. Allow 20% overhead; the request also reserves a safety margin.
    return math.ceil(len(encoding.encode(value, disallowed_special=())) * 1.2)


def counting_method():
    return 'reference tokenizer estimate (+20%); provider count may differ' if _encoding() else 'UTF-8 byte upper estimate; model tokenizer unavailable'


def request_tokens(messages: list[dict], schema=None):
    import json
    # Count escaped JSON and schema again: providers receive both the schema in
    # the prompt and the separate structured-output declaration.
    envelope = {'messages': messages}
    if schema:
        envelope['response_schema'] = schema
    return count_tokens(json.dumps(envelope, ensure_ascii=False)) + 32

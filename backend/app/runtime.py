"""Local application configuration. Secrets never enter workspace or research exports."""
import os
import secrets
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator

DATA_DIR = Path(os.environ.get('BA_MATE_DATA_DIR', Path.home() / '.ba-mate')).expanduser()
SESSION_TOKEN = secrets.token_urlsafe(32)
FRAMEWORK_VERSION = 'ba-framework-0.4.0'
PROMPT_VERSION = 'evidence-workflow-3'

class ProviderConfig(BaseModel):
    provider: str = 'ollama'
    model: str = 'qwen3:8b'
    base_url: str = 'http://127.0.0.1:11434'
    api_key: str = ''
    timeout_seconds: int = Field(default=180, ge=10, le=600)
    context_tokens: int = Field(default=8192, ge=2048, le=65536)
    output_tokens: int = Field(default=2048, ge=256, le=8192)
    temperature: float = Field(default=0.2, ge=0, le=1)

    @field_validator('provider')
    @classmethod
    def provider_supported(cls, value):
        if value not in {'ollama', 'openai', 'gemini', 'openrouter', 'huggingface'}:
            raise ValueError('Choose Ollama, OpenAI, Gemini, OpenRouter or Hugging Face.')
        return value

    @field_validator('model')
    @classmethod
    def model_required(cls, value):
        if not value.strip() or len(value) > 200:
            raise ValueError('Enter a model identifier.')
        return value.strip()

    @field_validator('base_url')
    @classmethod
    def valid_url(cls, value):
        parsed = urlparse(value)
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Enter an HTTP(S) model server address without credentials.')
        if parsed.scheme == 'http' and parsed.hostname not in {'localhost', '127.0.0.1', '::1'}:
            raise ValueError('Use HTTPS for a model server on another computer.')
        return value.rstrip('/')

config = ProviderConfig(provider=os.getenv('BA_MATE_PROVIDER', 'ollama'), model=os.getenv('BA_MATE_MODEL', 'qwen3:8b'))

def configuration_signature(value=None):
    return hashlib.sha256((value or config).model_dump_json(exclude={'api_key'}).encode()).hexdigest()

def environment_credential(provider):
    names = {
        'openai': ('OPENAI_API_KEY',),
        'gemini': ('GEMINI_API_KEY', 'GOOGLE_API_KEY'),
        'openrouter': ('OPENROUTER_API_KEY',),
        'huggingface': ('HF_TOKEN',),
    }.get(provider, ())
    return next((os.getenv(name, '') for name in names if os.getenv(name)), '')

def public_config():
    return {**config.model_dump(exclude={'api_key'}), 'has_key': bool(config.api_key or environment_credential(config.provider)),
            'configuration_signature': configuration_signature(), 'key_storage': 'memory for this session', 'framework_version': FRAMEWORK_VERSION, 'prompt_version': PROMPT_VERSION}

def load_config():
    global config
    path = DATA_DIR / 'provider.json'
    if path.exists():
        config = ProviderConfig.model_validate_json(path.read_text())


def save_config(value: ProviderConfig):
    global config
    # Blank means retain the existing key for the same provider; switching clears it.
    if not value.api_key and value.provider == config.provider:
        value.api_key = config.api_key
    config = value
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / 'provider.json'
    path.write_text(value.model_dump_json(exclude={'api_key'}))
    path.chmod(0o600)

def clear_session_credential():
    """Remove only the memory-held BYOK value; environment credentials stay outside app control."""
    global config
    config = config.model_copy(update={'api_key': ''})
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / 'provider.json'
    path.write_text(config.model_dump_json(exclude={'api_key'}))
    path.chmod(0o600)

def qualification_path():
    return DATA_DIR / 'model-qualification.json'

def load_qualification():
    path = qualification_path()
    return json.loads(path.read_text()) if path.exists() else None

def save_qualification(report):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = qualification_path()
    path.write_text(json.dumps(report, indent=2))
    path.chmod(0o600)

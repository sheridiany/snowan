"""Build a PydanticAI model from settings. Provider SDKs are imported lazily so
only the selected provider's dependency is required at runtime."""
from ..config import Settings

# Cache built models keyed on the resolved settings so an unchanged config reuses
# the same provider/httpx client (and its connection pool) across turns. build_agent
# runs per-turn, so a Settings change yields a new key and rebuilds immediately.
_MODEL_CACHE: dict[tuple, object] = {}


def build_model(settings: Settings):
    key = (settings.provider, settings.model, settings.api_key, settings.base_url)
    cached = _MODEL_CACHE.get(key)
    if cached is not None:
        return cached
    model = _build_model(settings)
    _MODEL_CACHE[key] = model
    return model


def _build_model(settings: Settings):
    if settings.provider == "test" or not settings.api_key:
        from pydantic_ai.models.test import TestModel

        return TestModel()

    # "custom" is an OpenAI-compatible endpoint (base_url + key + any model name).
    if settings.provider in ("openai", "openrouter", "custom"):
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        base_url = settings.base_url or (
            "https://openrouter.ai/api/v1" if settings.provider == "openrouter" else None
        )
        return OpenAIChatModel(
            settings.model or "gpt-4o",
            provider=OpenAIProvider(api_key=settings.api_key, base_url=base_url),
        )

    if settings.provider == "anthropic":
        from pydantic_ai.models.anthropic import AnthropicModel
        from pydantic_ai.providers.anthropic import AnthropicProvider

        return AnthropicModel(
            settings.model or "claude-sonnet-4-5",
            provider=AnthropicProvider(api_key=settings.api_key),
        )

    if settings.provider == "google":
        from pydantic_ai.models.google import GoogleModel
        from pydantic_ai.providers.google import GoogleProvider

        return GoogleModel(
            settings.model or "gemini-2.0-flash",
            provider=GoogleProvider(api_key=settings.api_key),
        )

    raise ValueError(f"unknown SNOWAN_PROVIDER: {settings.provider}")


def cache_settings(settings: Settings):
    """Prompt-cache the stable system+tools prefix (and the growing message prefix)
    for Anthropic, so the per-turn dynamic context — which now rides in the user
    message, not the instructions — is the only uncached part. Other providers cache
    server-side automatically, so no settings are needed."""
    if settings.provider == "anthropic":
        from pydantic_ai.models.anthropic import AnthropicModelSettings

        return AnthropicModelSettings(
            anthropic_cache_instructions=True,
            anthropic_cache_tool_definitions=True,
            anthropic_cache=True,
        )
    return None

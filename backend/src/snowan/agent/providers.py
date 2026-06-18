"""Build a PydanticAI model from settings. Provider SDKs are imported lazily so
only the selected provider's dependency is required at runtime."""
from ..config import Settings


def build_model(settings: Settings):
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

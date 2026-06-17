import os
from dataclasses import dataclass


@dataclass
class Settings:
    provider: str
    model: str
    api_key: str | None
    base_url: str | None


def load_settings() -> Settings:
    return Settings(
        provider=os.getenv("SNOWAN_PROVIDER", "test").lower(),
        model=os.getenv("SNOWAN_MODEL", ""),
        api_key=os.getenv("SNOWAN_API_KEY") or None,
        base_url=os.getenv("SNOWAN_BASE_URL") or None,
    )

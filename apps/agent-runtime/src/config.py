"""
AgentePro Runtime Configuration — Pydantic Settings
Validated on startup, fails fast on missing required values.
"""
from __future__ import annotations

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeConfig(BaseSettings):
    """Configuration loaded from environment with validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Redis ────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"

    # ── ChromaDB ─────────────────────────────────────────────────────────
    chromadb_url: str = "http://localhost:8000"

    # ── LLM Providers ────────────────────────────────────────────────────
    anthropic_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None

    # ── Default LLM ──────────────────────────────────────────────────────
    llm_model: str = "anthropic/claude-sonnet-4-20250514"
    llm_small_model: str = "anthropic/claude-haiku-4-20250414"

    # ── API Bridge ───────────────────────────────────────────────────────
    api_url: str = "http://localhost:3001"
    api_token: str | None = None
    runtime_port: int = 8001
    runtime_host: str = "0.0.0.0"

    # ── Security ─────────────────────────────────────────────────────────
    max_input_length: int = 4000
    max_output_length: int = 8000

    # ── MCP Brasil ───────────────────────────────────────────────────────
    transparencia_api_key: SecretStr | None = None
    
config = RuntimeConfig()

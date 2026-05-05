"""
ProspectFlow AI — Configurações Centralizadas
Todas as settings vêm de variáveis de ambiente via Pydantic Settings.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Infra ──────────────────────────────────────────────────────────────
    environment: Literal["development", "production"] = "production"
    secret_key: SecretStr = Field(..., description="Chave secreta da aplicação (openssl rand -hex 32)")

    # ── Banco de dados ─────────────────────────────────────────────────────
    database_url: str = Field(..., description="PostgreSQL async URL")

    # ── Redis ──────────────────────────────────────────────────────────────
    redis_url: str = Field(..., description="Redis URL com senha")

    # ── LLM ───────────────────────────────────────────────────────────────
    anthropic_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    llm_model: str = "claude-sonnet-4-5"
    llm_small_model: str = "claude-haiku-4-5-20251001"  # para tarefas simples (classificação, scoring)

    # ── Google Maps ────────────────────────────────────────────────────────
    google_maps_api_key: SecretStr = Field(...)
    google_maps_monthly_budget_usd: float = 30.0
    # Cache de 30 dias para place_ids já consultados
    maps_cache_ttl_seconds: int = 60 * 60 * 24 * 30

    # ── WhatsApp ───────────────────────────────────────────────────────────
    evolution_url: str = Field(...)
    evolution_api_key: SecretStr = Field(...)
    # Nome da instância WhatsApp no Evolution API
    evolution_instance: str = "prospectflow"

    # ── E-mail ─────────────────────────────────────────────────────────────
    brevo_api_key: SecretStr = Field(...)
    brevo_sender_name: str = "ProspectFlow Sites"
    brevo_sender_email: str = "contato@example.com"

    # ── Publicação ─────────────────────────────────────────────────────────
    vercel_token: SecretStr | None = None
    cloudflare_api_token: SecretStr | None = None
    cloudflare_account_id: str | None = None
    sites_output_dir: str = "./sites_output"

    # ── Integrações CRM ────────────────────────────────────────────────────
    hubspot_access_token: SecretStr | None = None
    rdstation_client_id: str | None = None
    rdstation_client_secret: SecretStr | None = None
    pipedrive_api_token: SecretStr | None = None
    webhook_url: str | None = None
    webhook_secret: SecretStr | None = None

    # ── Negócio ────────────────────────────────────────────────────────────
    daily_new_leads_limit: int = 50
    default_site_price: int = 1200
    warranty_days: int = 30
    brand_name: str = "WebPro Sites"

    # ── Rate limits WhatsApp ───────────────────────────────────────────────
    # Máx mensagens por lead por dia
    wa_max_messages_per_lead_day: int = 1
    # Delay mínimo entre mensagens (segundos)
    wa_min_delay_seconds: int = 30
    # Janela ativa de sessão (24h em segundos)
    wa_session_window_seconds: int = 86400

    # ── Segurança ──────────────────────────────────────────────────────────
    max_injection_attempts_before_block: int = 3
    security_alert_webhook: str | None = None

    @computed_field
    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @computed_field
    @property
    def llm_provider(self) -> str:
        if self.anthropic_api_key:
            return "anthropic"
        if self.openai_api_key:
            return "openai"
        raise ValueError("Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY no .env")


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Atalho global
settings = get_settings()

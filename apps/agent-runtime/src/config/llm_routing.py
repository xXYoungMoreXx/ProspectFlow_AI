"""
Mapa de LLM por sub-agente — PRD Hefesto v2 §9.
Tier 0 ($0): Ollama local | Tier 1-2 (barato): Gemini Flash, Haiku
Tier 3 (médio): Sonnet | Tier 4 (caro): Opus 4.7/4.8 | Tier 5: Imagen
"""

MODELS: dict[str, str] = {
    # Tier 0 — custo $0
    "orchestrator": "ollama/llama3.2:3b",
    "data_enricher": "ollama/llama3.2:3b",
    "deal_tracker": "ollama/llama3.2:3b",
    # Tier 1-2 — baixo custo
    "prospector": "gemini/gemini-2.0-flash",
    "site_inspector": "gemini/gemini-2.0-flash",
    "brief_extractor": "claude-haiku-4-5-20251001",
    "seo_optimizer": "claude-haiku-4-5-20251001",
    "deployer": "claude-haiku-4-5-20251001",
    "perf_auditor": "claude-haiku-4-5-20251001",
    "content_check": "claude-haiku-4-5-20251001",
    "tutorial_generator": "claude-haiku-4-5-20251001",
    "doc_generator": "claude-haiku-4-5-20251001",
    "notifier": "claude-haiku-4-5-20251001",
    # Tier 3 — médio
    "outreach_writer": "claude-sonnet-4-6",
    "conv_handler": "claude-sonnet-4-6",
    "proposal_writer": "claude-sonnet-4-6",
    "copywriter": "claude-sonnet-4-6",
    "interviewer": "claude-sonnet-4-6",
    # Tier 4a — caro (código e segurança)
    "coder": "claude-opus-4-8",
    "sec_auditor": "claude-opus-4-8",
    # Tier 4b — design visual
    "designer": "claude-opus-4-7",
    # Default seguro
    "default": "claude-sonnet-4-6",
}


def get_model(role: str) -> str:
    """Retorna o modelo LiteLLM para o sub-agente dado. Fallback: default."""
    return MODELS.get(role.lower(), MODELS["default"])

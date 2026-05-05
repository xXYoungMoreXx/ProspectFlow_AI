"""
ProspectFlow AI — Camada de Segurança contra Prompt Injection.

Implementa 5 camadas independentes de defesa:
  1. Filtro de entrada pré-LLM (regex + lista de padrões)
  2. Separação de contexto via delimitadores XML no system prompt
  3. Filtro de saída pós-LLM
  4. Controle de permissões mínimas por agente
  5. Auditoria e bloqueio automático por reincidência
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

logger = logging.getLogger(__name__)

# ─── Padrões de detecção ──────────────────────────────────────────────────────

# Padrões de injeção mais comuns — case-insensitive, com variações PT/EN
_INJECTION_PATTERNS: list[re.Pattern] = [p for p in map(re.compile, [
    # Tentativas de sobrescrever instruções
    r"ignore\s+(all\s+)?(previous|anterior|suas)\s+(instructions?|instruções)",
    r"esquece?\s+(tudo|as instruções|o que te disseram)",
    r"override\s+(your\s+)?instructions?",
    r"disregard\s+(all\s+)?previous",

    # Troca de persona/identidade
    r"(you\s+are|você\s+(é|se torna|agora é))\s+(now\s+)?(a\s+)?(?!a\s+assistant)",
    r"act\s+as\s+(?!a\s+(helpful|sales))",
    r"atue?\s+como\s+(?!(vendedor|assistente))",
    r"finja\s+(ser|que\s+(é|você))\s+(?!(um vendedor|um assistente))",
    r"pretend\s+(you\s+are|to\s+be)",
    r"roleplay\s+as",

    # Vazamento de system prompt
    r"(revele?|mostr[ae]|repita|repeat|show|reveal|print)\s+(o\s+)?(your\s+)?(system\s+prompt|prompt\s+original|suas?\s+instruções)",
    r"what\s+(are\s+)?your\s+(system\s+|original\s+)?instructions?",
    r"quais\s+(são\s+)?suas?\s+(instruções|regras|sistema)",

    # Jailbreaks conhecidos
    r"\bDAN\b",  # Do Anything Now
    r"jailbreak",
    r"modo\s+(desenvolvedor|dev|god|deus)",
    r"developer\s+mode",
    r"unrestricted\s+mode",
    r"sem\s+(restrições|limites|censura)",

    # Tentativas de injeção via XML/delimitadores
    r"<\s*(SYSTEM|PROMPT|INSTRUÇÃO|INSTRUCTION|USER_INPUT)\s*>",
    r"\[SYSTEM\]|\[INST\]|\[SYS\]",

    # Extração de dados internos
    r"(mostre?|liste?|revele?|me\s+dê)\s+(as?\s+)?(api\s+key|token|senha|password|segredo|secret)",
    r"(what\s+is\s+)?your\s+(api\s+key|access\s+token|password)",

    # Indireções comuns
    r"na\s+verdade\s+(você\s+é|seu\s+objetivo\s+é)",
    r"your\s+real\s+(purpose|goal|instructions?)\s+is",
    r"the\s+previous\s+instructions?\s+(were|are)\s+fake",
], flags=re.IGNORECASE)]

# Padrões suspeitos na SAÍDA do LLM (vazamento de dados internos)
_OUTPUT_LEAK_PATTERNS: list[re.Pattern] = [p for p in map(re.compile, [
    r"sk-ant-[a-zA-Z0-9]+",       # chave Anthropic
    r"sk-[a-zA-Z0-9]{48}",        # chave OpenAI
    r"AIza[0-9A-Za-z_-]{35}",     # chave Google
    r"postgresql\+asyncpg://",     # URL de banco
    r"redis://",                   # URL Redis
    r"SECRET_KEY\s*=",
    r"\[INJECTION_DETECTED\]",     # o próprio agente sinaliza
    r"SYSTEM_INSTRUCTIONS",        # vazamento do template
    r"CONVERSATION_HISTORY",
], flags=re.IGNORECASE)]

# Padrões de opt-out (LGPD)
_OPT_OUT_PATTERNS: list[re.Pattern] = [p for p in map(re.compile, [
    r"\b(parar?|stop|sair|cancelar|descadastrar|remover)\b",
    r"\bnão\s+(quero|desejo)\s+(mais\s+)?(mensagens?|contato)\b",
    r"\bme\s+(retire|remova|descadastre)\b",
    r"\bnão\s+me\s+(perturbe|chame|contate)\b",
], flags=re.IGNORECASE)]


@dataclass
class SecurityCheckResult:
    passed: bool
    is_injection: bool = False
    is_opt_out: bool = False
    matched_pattern: str | None = None
    reason: str | None = None


@dataclass
class SecurityContext:
    """Estado de segurança de uma conversa."""
    lead_id: str
    injection_attempts: int = 0
    is_blocked: bool = False
    events: list[dict] = field(default_factory=list)

    def record_attempt(self, pattern: str, message: str) -> None:
        self.injection_attempts += 1
        self.events.append({
            "type": "injection_attempt",
            "pattern": pattern,
            "message_preview": message[:100],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def should_block(self, max_attempts: int = 3) -> bool:
        return self.injection_attempts >= max_attempts


class SecurityGuard:
    """
    Guarda de segurança — valida entradas e saídas do agente.
    Thread-safe, stateless por default (estado vem do caller).
    """

    def __init__(
        self,
        on_injection: Callable[[str, str, str], None] | None = None,
        on_opt_out: Callable[[str], None] | None = None,
    ):
        # Callbacks para persistência de eventos (injetados pelo caller)
        self._on_injection = on_injection
        self._on_opt_out = on_opt_out

    # ── Camada 1 — Filtro de entrada ──────────────────────────────────────

    def check_input(self, message: str, lead_id: str = "") -> SecurityCheckResult:
        """
        Verifica uma mensagem recebida do cliente antes de enviar ao LLM.
        Retorna SecurityCheckResult com diagnóstico completo.
        """
        # Verifica opt-out primeiro (maior prioridade — é direito do usuário)
        for pattern in _OPT_OUT_PATTERNS:
            if pattern.search(message):
                logger.info("[SECURITY] Opt-out detectado: lead=%s", lead_id)
                if self._on_opt_out:
                    self._on_opt_out(lead_id)
                return SecurityCheckResult(
                    passed=True,  # não bloqueia, mas sinaliza
                    is_opt_out=True,
                    matched_pattern=pattern.pattern,
                    reason="opt_out",
                )

        # Verifica padrões de injeção
        for pattern in _INJECTION_PATTERNS:
            if pattern.search(message):
                logger.warning(
                    "[SECURITY] Injeção detectada: lead=%s pattern=%s preview='%s'",
                    lead_id, pattern.pattern, message[:80]
                )
                if self._on_injection:
                    self._on_injection(lead_id, pattern.pattern, message)
                return SecurityCheckResult(
                    passed=False,
                    is_injection=True,
                    matched_pattern=pattern.pattern,
                    reason="injection_detected",
                )

        return SecurityCheckResult(passed=True)

    # ── Camada 3 — Filtro de saída ────────────────────────────────────────

    def check_output(self, response: str, lead_id: str = "") -> SecurityCheckResult:
        """
        Verifica a resposta do LLM antes de enviar ao cliente.
        Bloqueia vazamento de dados internos ou sinais de injeção bem-sucedida.
        """
        for pattern in _OUTPUT_LEAK_PATTERNS:
            if pattern.search(response):
                logger.critical(
                    "[SECURITY] Vazamento na saída do LLM: lead=%s pattern=%s",
                    lead_id, pattern.pattern
                )
                return SecurityCheckResult(
                    passed=False,
                    matched_pattern=pattern.pattern,
                    reason="output_leak",
                )

        # Resposta muito estranha (fora do escopo) — heurística simples
        suspicious_keywords = [
            "system prompt", "instruções originais", "posso fazer qualquer coisa",
            "sem restrições agora", "I can do anything",
        ]
        for kw in suspicious_keywords:
            if kw.lower() in response.lower():
                logger.warning(
                    "[SECURITY] Resposta suspeita do LLM: lead=%s kw='%s'",
                    lead_id, kw
                )
                return SecurityCheckResult(
                    passed=False,
                    matched_pattern=kw,
                    reason="suspicious_output",
                )

        return SecurityCheckResult(passed=True)

    # ── Resposta padrão para injeções ─────────────────────────────────────

    @staticmethod
    def injection_response() -> str:
        """Mensagem de encerramento amigável quando injection é detectada."""
        return (
            "Olá! Posso te ajudar com informações sobre nosso serviço de criação de sites. "
            "Se tiver alguma dúvida sobre como funciona, os preços ou o processo de entrega, "
            "é só perguntar! 😊"
        )

    @staticmethod
    def opt_out_response() -> str:
        """Confirmação de opt-out conforme LGPD."""
        return (
            "Tudo bem! Removi seu contato da nossa lista imediatamente. "
            "Você não receberá mais mensagens nossas. "
            "Se mudar de ideia no futuro, pode nos contatar a qualquer momento. "
            "Tenha um ótimo dia! 🙂"
        )

    @staticmethod
    def blocked_response() -> str:
        """Resposta quando lead é bloqueado por reincidência."""
        return (
            "Obrigado pelo contato. Não consigo continuar esta conversa, "
            "mas nosso serviço continua disponível em nosso site. "
            "Tenha um bom dia!"
        )


# ─── Utilitário de sanitização ────────────────────────────────────────────────

def sanitize_for_prompt(text: str, max_length: int = 2000) -> str:
    """
    Sanitiza texto do usuário antes de inserir no prompt do LLM.
    Remove delimitadores XML que poderiam interferir no template.
    """
    # Remove tags XML que correspondem aos delimitadores do system prompt
    text = re.sub(r"</?(?:SYSTEM_INSTRUCTIONS|CONVERSATION_HISTORY|USER_INPUT)>", "", text)
    # Remove null bytes e caracteres de controle (exceto newline/tab)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Trunca para evitar token bombing
    return text[:max_length].strip()

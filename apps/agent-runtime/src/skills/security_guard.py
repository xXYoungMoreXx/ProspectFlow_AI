"""
SecurityGuard — Migrated from legacy modules/conv_agent/security.py
Input/output filter for LLM interactions.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ─── Injection patterns (bilingual PT-BR/EN) ─────────────────────────────────

INJECTION_PATTERNS = [
    # English
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"forget\s+(all\s+)?(your\s+)?instructions",
    r"you\s+are\s+now\s+a?\s*(different|new)\s",
    r"act\s+as\s+(a\s+)?system\s+without",
    r"reveal\s+(your\s+)?system\s+prompt",
    r"repeat\s+(the\s+)?system\s+prompt",
    r"what\s+(is|are)\s+(your\s+)?instructions",
    r"DAN\s+mode",
    r"jailbreak\s+mode",
    r"your\s+real\s+purpose",
    r"bypass\s+restrictions",
    # Portuguese
    r"ignor[ea]\s+(todas?\s+)?(as\s+)?instruções\s+anteriores",
    r"esqueç[ae]|esquece\s+tudo",
    r"você\s+agora\s+é\s+um\s+assistente\s+sem\s+restrições",
    r"atu[ea]\s+como\s+um\s+sistema\s+sem\s+regras",
    r"finj[ae]\s+ser",
    r"mostr[ea]\s+suas\s+instruções",
    r"quais\s+são\s+suas\s+instruções",
    r"modo\s+desenvolvedor",
    r"me\s+dê\s+sua\s+api\s+key",
    r"what\s+is\s+your\s+api\s+key",
    r"repita\s+o\s+system\s+prompt",
    # Structural attacks
    r"<SYSTEM_INSTRUCTIONS>",
    r"\[SYSTEM\]\s+override",
]

OPT_OUT_PATTERNS = [
    r"^parar$",
    r"^stop$",
    r"^cancelar$",
    r"^descadastrar$",
    r"não\s+quero\s+mais\s+mensagens",
    r"me\s+remov[ae]\s+da\s+lista",
    r"não\s+me\s+perturb[ea]",
    r"não\s+desejo\s+mais\s+contato",
]

OUTPUT_LEAK_PATTERNS = [
    r"sk-ant-api\d{2}-[a-zA-Z0-9]",          # Anthropic
    r"sk-[a-zA-Z0-9]{48}",                    # OpenAI
    r"AIza[a-zA-Z0-9_-]{32,}",                  # Google
    r"postgresql(\+asyncpg)?://\S+:\S+@",     # DB conn string
    r"redis://\S+:\S+@",                       # Redis conn string
    r"SYSTEM_INSTRUCTIONS\s+are",
]


@dataclass(frozen=True)
class SecurityResult:
    """Immutable result of a security check."""
    passed: bool
    is_injection: bool = False
    is_opt_out: bool = False
    reason: str = ""


class SecurityGuard:
    """
    Multi-layer security filter for LLM I/O.
    Layer 1: Input injection detection
    Layer 2: Opt-out detection
    Layer 3: Output leak prevention
    """

    def __init__(self) -> None:
        self._injection_re = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]
        self._opt_out_re = [re.compile(p, re.IGNORECASE) for p in OPT_OUT_PATTERNS]
        self._leak_re = [re.compile(p, re.IGNORECASE) for p in OUTPUT_LEAK_PATTERNS]

    def check_input(self, text: str, lead_id: str) -> SecurityResult:
        """Check user input for injection attempts and opt-out signals."""
        # Layer 1: Injection detection
        for pattern in self._injection_re:
            if pattern.search(text):
                logger.warning(
                    "INJECTION DETECTED | lead=%s | pattern=%s | input=%s",
                    lead_id, pattern.pattern, text[:100],
                )
                return SecurityResult(passed=False, is_injection=True, reason=pattern.pattern)

        # Layer 2: Opt-out detection
        for pattern in self._opt_out_re:
            if pattern.search(text.strip()):
                logger.info("OPT-OUT detected | lead=%s | input=%s", lead_id, text[:50])
                return SecurityResult(passed=True, is_opt_out=True, reason="opt_out")

        return SecurityResult(passed=True)

    def check_output(self, text: str, lead_id: str) -> SecurityResult:
        """Check LLM output for credential/secret leaks."""
        for pattern in self._leak_re:
            if pattern.search(text):
                logger.error(
                    "OUTPUT LEAK BLOCKED | lead=%s | pattern=%s",
                    lead_id, pattern.pattern,
                )
                return SecurityResult(passed=False, reason=f"leak:{pattern.pattern}")

        return SecurityResult(passed=True)

    def check_ssrf(self, url: str, lead_id: str = "system") -> SecurityResult:
        """Check URL against SSRF patterns (internal IPs, localhost, metadata API)."""
        blocked_domains = [
            r"localhost",
            r"127\.0\.0\.1",
            r"0\.0\.0\.0",
            r"169\.254\.169\.254",  # AWS Metadata
            r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}",
            r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}",
            r"192\.168\.\d{1,3}\.\d{1,3}",
            r"\.internal$",
            r"\.local$"
        ]
        
        try:
            import urllib.parse
            parsed = urllib.parse.urlparse(url)
            hostname = parsed.hostname or url
            
            for pattern in blocked_domains:
                if re.search(pattern, hostname, re.IGNORECASE):
                    logger.error(
                        "SSRF BLOCKED | lead=%s | url=%s | pattern=%s",
                        lead_id, url, pattern
                    )
                    return SecurityResult(passed=False, reason=f"ssrf:{pattern}")
                    
            return SecurityResult(passed=True)
        except Exception as e:
            logger.error("Failed to parse URL for SSRF check: %s", str(e))
            return SecurityResult(passed=False, reason="invalid_url")


def sanitize_for_prompt(text: str, max_length: int = 4000) -> str:
    """
    Sanitize user input before embedding in LLM prompt.
    - Removes XML-like delimiters that could be used for injection
    - Removes control characters
    - Truncates to max_length
    """
    # Remove XML delimiters that could interfere with prompt structure
    text = re.sub(r"</?[A-Z_]+>", "", text)
    # Remove control characters (except newline and tab)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Truncate
    return text[:max_length]

"""
SiteBuilder — Geração automática de sites via LLM + extração de design system.

Pipeline:
  1. Extrai design system do site de referência (cores, tipografia, layout)
  2. LLM gera HTML/CSS adaptado ao cliente
  3. Publica no Vercel/Cloudflare Pages
  4. Configura domínio e SSL
"""
from __future__ import annotations

import json
import logging
import re
import tempfile
from pathlib import Path

import anthropic
import httpx

from config import settings
from db.models import Lead

logger = logging.getLogger(__name__)


# ─── Prompt de geração do site ────────────────────────────────────────────────

SITE_GENERATION_PROMPT = """
Você é um web designer especializado em sites para pequenos negócios locais.
Crie um site HTML completo, moderno e responsivo para o seguinte cliente:

DADOS DO CLIENTE:
- Nome do negócio: {business_name}
- Segmento: {category}
- Cidade: {city}
- Descrição: {description}
- Telefone: {phone}

DESIGN SYSTEM EXTRAÍDO DA REFERÊNCIA ({reference_url}):
{design_system}

PERSONALIZAÇÃO DO CLIENTE:
- Cores preferidas: {colors}
- Tem logomarca: {has_logo}
- URL da logo: {logo_url}

SEÇÕES OBRIGATÓRIAS:
1. Header: logo + nome do negócio + menu de navegação
2. Hero: título impactante + subtítulo + CTA principal (botão WhatsApp ou Agendar)
3. Sobre: breve apresentação do negócio com foto placeholder
4. Serviços/Produtos: grid com 3-6 itens do nicho ({category})
5. Depoimentos: 3 depoimentos fictícios plausíveis para o nicho
6. Contato: formulário simples + Google Maps embed placeholder + telefone + endereço
7. Footer: redes sociais + copyright

REGRAS TÉCNICAS:
- HTML5 semântico em arquivo único (tudo inline: CSS no <style> e JS no <script>)
- Mobile-first, responsivo com CSS Grid/Flexbox
- Paleta de cores baseada no design system, adaptada às cores do cliente
- Google Fonts via CDN (escolha fontes que combinem com o nicho)
- Sem dependências externas além de Google Fonts
- Imagens: use URLs do Unsplash para placeholders (ex: https://images.unsplash.com/...)
- WhatsApp CTA: href="https://wa.me/55{phone_digits}" 
- Performance: CSS crítico inline, JS mínimo
- SEO: meta tags, og:title, og:description preenchidos

IMPORTANTE:
- O site deve parecer profissional e ter sido feito por um designer humano
- Adapte o vocabulário e o conteúdo ao nicho específico ({category})
- Use cores que transmitam confiança para o segmento
- Nenhum placeholder óbvio de template (ex: "Lorem ipsum" ou "[NOME]")

Retorne APENAS o código HTML completo, sem explicações ou markdown.
"""


class DesignExtractor:
    """
    Extrai design system de um site de referência.
    Usa LLM com dados da página (fallback quando MCP não disponível).
    """

    def __init__(self):
        self._http: httpx.AsyncClient | None = None
        self._llm = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value()
        )

    async def __aenter__(self):
        self._http = httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ProspectFlow/1.0)"},
        )
        return self

    async def __aexit__(self, *_):
        if self._http:
            await self._http.aclose()

    async def extract(self, url: str) -> dict:
        """
        Extrai design system do site de referência.
        Tenta buscar o CSS da página e analisar via LLM.
        """
        # Tenta acessar o site e pegar informações básicas
        try:
            resp = await self._http.get(url)
            html_preview = resp.text[:8000]  # Primeiros 8k caracteres
        except Exception as e:
            logger.warning("Não foi possível acessar %s: %s", url, e)
            html_preview = ""

        design_system = await self._analyze_with_llm(url, html_preview)
        return design_system

    async def _analyze_with_llm(self, url: str, html_preview: str) -> dict:
        prompt = f"""
Analise o HTML abaixo do site {url} e extraia o design system.
Se não tiver HTML, use seu conhecimento sobre o site para inferir.

HTML (primeiros 8000 chars):
{html_preview[:4000] if html_preview else "(não disponível)"}

Extraia e retorne APENAS este JSON (sem markdown):
{{
  "colors": {{
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "text": "#hex",
    "accent": "#hex"
  }},
  "typography": {{
    "heading_font": "nome da fonte",
    "body_font": "nome da fonte",
    "heading_weight": "700",
    "style": "serif|sans-serif|mixed"
  }},
  "layout": {{
    "style": "minimal|bold|classic|modern|corporate",
    "max_width": "1200px",
    "border_radius": "4px|8px|16px|full",
    "shadow_style": "none|soft|strong"
  }},
  "components": {{
    "hero_style": "centered|split|video|image-bg",
    "cta_style": "filled|outlined|ghost",
    "card_style": "flat|elevated|bordered",
    "nav_style": "transparent|solid|sticky"
  }},
  "tone": "luxury|friendly|professional|energetic|trustworthy"
}}
"""
        try:
            resp = await self._llm.messages.create(
                model=settings.llm_small_model,
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            logger.warning("Extração de design system falhou: %s", e)
            return self._default_design_system()

    @staticmethod
    def _default_design_system() -> dict:
        return {
            "colors": {
                "primary": "#1A56DB",
                "secondary": "#F3F4F6",
                "background": "#FFFFFF",
                "text": "#111827",
                "accent": "#10B981",
            },
            "typography": {
                "heading_font": "Poppins",
                "body_font": "Inter",
                "heading_weight": "700",
                "style": "sans-serif",
            },
            "layout": {
                "style": "modern",
                "max_width": "1200px",
                "border_radius": "8px",
                "shadow_style": "soft",
            },
            "components": {
                "hero_style": "centered",
                "cta_style": "filled",
                "card_style": "elevated",
                "nav_style": "sticky",
            },
            "tone": "professional",
        }


class SiteBuilder:
    """
    Constrói e publica sites automaticamente.
    """

    def __init__(self):
        self._llm = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value()
        )
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._http = httpx.AsyncClient(timeout=60.0)
        return self

    async def __aexit__(self, *_):
        if self._http:
            await self._http.aclose()

    # ── Geração ───────────────────────────────────────────────────────────

    async def generate(self, lead: Lead, design_system: dict) -> str:
        """
        Gera o HTML completo do site do cliente via LLM.
        """
        from modules.lead_hunter.hunter import NICHE_MAP

        niche_info = NICHE_MAP.get(lead.niche or "", {})
        reference_url = (
            lead.reference_url
            or (niche_info.get("references", [""])[0])
            or "site genérico do segmento"
        )

        # Limpa dígitos do telefone para CTA WhatsApp
        phone_digits = re.sub(r"\D", "", lead.phone or "")

        preferred_colors = json.dumps(
            lead.preferred_colors or design_system.get("colors", {}),
            ensure_ascii=False,
        )

        prompt = SITE_GENERATION_PROMPT.format(
            business_name=lead.name,
            category=lead.category or lead.niche or "negócio local",
            city=lead.city,
            description=lead.business_description or f"{lead.name} em {lead.city}",
            phone=lead.phone or "",
            phone_digits=phone_digits,
            reference_url=reference_url,
            design_system=json.dumps(design_system, ensure_ascii=False, indent=2),
            colors=preferred_colors,
            has_logo="Sim" if lead.logo_url else "Não",
            logo_url=lead.logo_url or "",
        )

        logger.info("Gerando site para: %s (%s)", lead.name, lead.niche)

        # Usa model mais capaz para geração de código
        resp = await self._llm.messages.create(
            model=settings.llm_model,
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,  # Menos temperatura para código mais correto
        )

        html = resp.content[0].text.strip()

        # Remove possíveis markdown fences
        if html.startswith("```"):
            html = re.sub(r"^```(?:html)?\n?", "", html)
            html = re.sub(r"\n?```$", "", html)

        logger.info("Site gerado: %d chars para %s", len(html), lead.name)
        return html

    # ── Publicação no Vercel ──────────────────────────────────────────────

    async def publish_to_vercel(self, html: str, project_name: str) -> str | None:
        """
        Publica o site no Vercel via API e retorna a URL.
        project_name: slug do negócio (ex: salao-beleza-total)
        """
        if not settings.vercel_token:
            logger.warning("VERCEL_TOKEN não configurado — salvando localmente")
            return await self._save_locally(html, project_name)

        # Prepara o deployment
        payload = {
            "name": project_name,
            "files": [
                {
                    "file": "index.html",
                    "data": html,
                }
            ],
            "projectSettings": {
                "framework": None,  # HTML puro
            },
        }

        try:
            resp = await self._http.post(
                "https://api.vercel.com/v13/deployments",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.vercel_token.get_secret_value()}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            url = f"https://{data['url']}"
            logger.info("Site publicado no Vercel: %s", url)
            return url
        except Exception as e:
            logger.error("Erro ao publicar no Vercel: %s", e)
            return await self._save_locally(html, project_name)

    # ── Publicação local (fallback) ───────────────────────────────────────

    async def _save_locally(self, html: str, project_name: str) -> str:
        """Salva o site localmente (dev ou fallback)."""
        output_dir = Path(settings.sites_output_dir) / project_name
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "index.html"
        output_file.write_text(html, encoding="utf-8")
        url = f"file://{output_file.absolute()}"
        logger.info("Site salvo localmente: %s", url)
        return url

    # ── Slug ─────────────────────────────────────────────────────────────

    @staticmethod
    def make_slug(name: str, city: str) -> str:
        """Gera slug único para o projeto."""
        import unicodedata

        def normalize(s: str) -> str:
            s = unicodedata.normalize("NFD", s.lower())
            s = "".join(c for c in s if unicodedata.category(c) != "Mn")
            s = re.sub(r"[^a-z0-9\s-]", "", s)
            s = re.sub(r"[\s]+", "-", s.strip())
            return s[:40]

        return f"{normalize(name)}-{normalize(city)}"

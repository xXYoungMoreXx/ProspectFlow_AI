"""
MailAgent — Outreach por e-mail com templates adaptativos gerados por LLM.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import anthropic
import httpx

from config import settings
from db.models import Lead

logger = logging.getLogger(__name__)


# ─── Prompts de geração de e-mail ─────────────────────────────────────────────

EMAIL_GENERATION_PROMPT = """
Você é um copywriter especializado em prospecção B2B para serviços digitais.

Escreva um e-mail de prospecção para o seguinte negócio:
- Nome: {business_name}
- Categoria: {category}
- Cidade: {city}
- Avaliação no Google Maps: {rating} ⭐ ({total_ratings} avaliações)
- Não tem site cadastrado
- Site de referência do nicho: {reference_url}
- Sequência: E-mail #{sequence_number}

CONTEXTO DA SEQUÊNCIA:
{sequence_context}

REGRAS DO E-MAIL:
- Máximo 150 palavras no corpo
- Tom: profissional mas próximo — como um parceiro, não um vendedor
- Assunto: personalizado, máximo 60 chars, desperte curiosidade (não spam)
- Mencione detalhes específicos do negócio deles (avaliação, cidade, nicho)
- Inclua o link de referência como âncora de valor
- NÃO use jargões técnicos (SEO, responsivo, CMS, etc.)
- NÃO seja insistente ou desesperado
- Termine com UMA pergunta ou CTA claro

FORMATO DE RESPOSTA (JSON apenas, sem markdown):
{{
  "subject": "...",
  "body": "...",
  "preview_text": "..."
}}
"""

SEQUENCE_CONTEXTS = {
    1: """
Primeiro contato. O objetivo é gerar curiosidade e mostrar a referência visual.
Mencione que encontrou o negócio no Google Maps. Apresente o site de referência.
Não fale de preço. Termine perguntando se podem marcar uma conversa rápida.
    """,
    2: """
Follow-up (sem resposta ao e-mail anterior). 
Abordagem diferente: foque em um case de sucesso do nicho deles.
Mencione que criou um esboço personalizado para o negócio deles.
Tom: mais direto, mas ainda respeitoso.
    """,
    3: """
Último e-mail da sequência. Tom final, de encerramento elegante.
Diga que é a última mensagem. Ofereça um benefício concreto (ex: primeiro mês grátis, garantia estendida).
Deixe a porta aberta para contato futuro sem pressão.
    """,
}


class MailAgent:
    """
    Gerencia toda a comunicação por e-mail:
    - Geração dinâmica de e-mails via LLM
    - Envio via Brevo (Sendinblue)
    - Controle de sequência e follow-ups
    """

    def __init__(self):
        self._llm = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value()
        )
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._http = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *_):
        if self._http:
            await self._http.aclose()

    # ── Geração de e-mail ─────────────────────────────────────────────────

    async def generate_email(
        self,
        lead: Lead,
        sequence_number: int = 1,
    ) -> dict:
        """
        Gera e-mail personalizado via LLM com dados do Maps do cliente.
        """
        from modules.lead_hunter.hunter import NICHE_MAP

        niche_info = NICHE_MAP.get(lead.niche or "", {})
        reference_url = (
            lead.reference_url
            or (niche_info.get("references", [""])[0])
            or "sem referência específica"
        )

        prompt = EMAIL_GENERATION_PROMPT.format(
            business_name=lead.name,
            category=lead.category or lead.niche or "negócio local",
            city=lead.city,
            rating=lead.rating or "sem avaliação",
            total_ratings=lead.total_ratings or 0,
            reference_url=reference_url,
            sequence_number=sequence_number,
            sequence_context=SEQUENCE_CONTEXTS.get(sequence_number, SEQUENCE_CONTEXTS[1]),
        )

        resp = await self._llm.messages.create(
            model=settings.llm_model,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.75,
        )

        import json
        raw = resp.content[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            email_data = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Falha ao parsear e-mail gerado pela IA: %s", raw[:200])
            email_data = self._fallback_email(lead, sequence_number)

        return email_data

    # ── Envio via Brevo ───────────────────────────────────────────────────

    async def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_body: str,
        text_body: str | None = None,
    ) -> bool:
        """
        Envia e-mail via Brevo API.
        """
        payload = {
            "sender": {
                "name": settings.brevo_sender_name,
                "email": settings.brevo_sender_email,
            },
            "to": [{"email": to_email, "name": to_name}],
            "subject": subject,
            "htmlContent": html_body,
            "textContent": text_body or html_body,
        }

        try:
            resp = await self._http.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers={
                    "api-key": settings.brevo_api_key.get_secret_value(),
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            logger.info("E-mail enviado: to=%s subject='%s'", to_email, subject)
            return True
        except Exception as e:
            logger.error("Erro ao enviar e-mail para %s: %s", to_email, e)
            return False

    async def send_prospect_email(
        self,
        lead: Lead,
        sequence_number: int = 1,
    ) -> bool:
        """
        Gera e envia e-mail de prospecção para um lead.
        """
        if not lead.email:
            logger.warning("Lead %s sem e-mail: %s", lead.id, lead.name)
            return False

        email_data = await self.generate_email(lead, sequence_number)

        html_body = self._text_to_html(
            email_data["body"],
            lead.name,
            email_data.get("preview_text", ""),
        )

        return await self.send_email(
            to_email=lead.email,
            to_name=lead.name,
            subject=email_data["subject"],
            html_body=html_body,
            text_body=email_data["body"],
        )

    # ── HTML Builder ──────────────────────────────────────────────────────

    @staticmethod
    def _text_to_html(body: str, business_name: str, preview: str) -> str:
        """Converte texto plano em HTML responsivo simples."""
        paragraphs = "".join(
            f"<p style='margin:0 0 12px 0;line-height:1.6'>{p.strip()}</p>"
            for p in body.split("\n")
            if p.strip()
        )

        return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{preview}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:20px">
      <table width="600" cellpadding="0" cellspacing="0" 
             style="background:#fff;border-radius:8px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr>
          <td style="background:#1A56DB;padding:24px 32px">
            <span style="color:#fff;font-size:20px;font-weight:bold">
              {settings.brand_name}
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#374151;font-size:15px">
            {paragraphs}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;color:#9CA3AF;font-size:12px;
                     border-top:1px solid #E5E7EB">
            <p style="margin:0">
              Você recebeu este e-mail pois seu negócio foi encontrado no Google Maps.<br>
              <a href="#" style="color:#9CA3AF">Clique aqui para não receber mais mensagens</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    # ── Fallback ──────────────────────────────────────────────────────────

    @staticmethod
    def _fallback_email(lead: Lead, sequence: int) -> dict:
        """E-mail padrão caso a geração por IA falhe."""
        return {
            "subject": f"{lead.name} — encontrei vocês no Google Maps",
            "body": (
                f"Olá!\n\n"
                f"Vi o {lead.name} no Google Maps e percebi que vocês ainda não têm um site.\n\n"
                f"Crio sites profissionais para {lead.category or 'negócios locais'} "
                f"a partir de R$ {settings.default_site_price}. "
                f"Entrega em até 5 dias úteis, com garantia de {settings.warranty_days} dias.\n\n"
                f"Posso te mostrar alguns exemplos do nosso trabalho?\n\n"
                f"Att,\n{settings.brand_name}"
            ),
            "preview_text": f"Encontrei o {lead.name} no Maps e tenho uma proposta",
        }

from __future__ import annotations

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from src.config import config


class EmailSenderInput(BaseModel):
    to_email: str = Field(..., description="O endereço de email do destinatário.")
    subject: str = Field(..., description="O assunto do email.")
    body: str = Field(..., description="O corpo do email (HTML ou texto).")


class EmailSenderTool(BaseTool):
    name: str = "email_sender"
    description: str = "Envia um email para um lead através da API central do AgentePro."
    args_schema: type[BaseModel] = EmailSenderInput

    def _run(self, to_email: str, subject: str, body: str) -> str:
        try:
            with httpx.Client(timeout=30.0) as client:
                headers = {"X-Internal-Token": config.api_token} if config.api_token else {}
                resp = client.post(
                    f"{config.api_url}/api/v1/internal/messages/email",
                    json={
                        "to": to_email,
                        "subject": subject,
                        "htmlContent": body,
                    },
                    headers=headers,
                )
                if resp.status_code in (200, 201, 202):
                    return f"Email enviado com sucesso para {to_email}."
                return f"Erro ao enviar email: {resp.text}"
        except Exception as e:
            return f"Erro interno ao enviar email: {str(e)}"

from __future__ import annotations

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from src.config import config


class WhatsAppSenderInput(BaseModel):
    phone: str = Field(..., description="O telefone do destinatário com DDI (ex: 5511999999999).")
    message: str = Field(..., description="A mensagem de texto a ser enviada pelo WhatsApp.")


class WhatsAppSenderTool(BaseTool):
    name: str = "whatsapp_sender"
    description: str = "Envia uma mensagem de WhatsApp para um lead através da API central do AgentePro."
    args_schema: type[BaseModel] = WhatsAppSenderInput

    def _run(self, phone: str, message: str) -> str:
        try:
            with httpx.Client(timeout=30.0) as client:
                headers = {"X-Internal-Token": config.api_token} if config.api_token else {}

                # Opt-out é verificado server-side pela rota interna (403 = blocklist)
                resp = client.post(
                    f"{config.api_url}/api/v1/internal/messages/whatsapp",
                    json={"phone": phone, "message": message},
                    headers=headers,
                )
                if resp.status_code in (200, 201):
                    return f"WhatsApp enviado com sucesso para {phone}."
                if resp.status_code == 403:
                    return f"Envio bloqueado: Lead {phone} está na blocklist (opt-out)."
                return f"Erro ao enviar WhatsApp: {resp.text}"
        except Exception as e:
            return f"Erro interno ao enviar WhatsApp: {str(e)}"

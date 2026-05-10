from __future__ import annotations

import httpx
from typing import Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from src.config import config

class WhatsAppSenderInput(BaseModel):
    phone: str = Field(..., description="O telefone do destinatário com DDI (ex: 5511999999999).")
    message: str = Field(..., description="A mensagem de texto a ser enviada pelo WhatsApp.")

class WhatsAppSenderTool(BaseTool):
    name: str = "whatsapp_sender"
    description: str = "Envia uma mensagem de WhatsApp para um lead através da API central do AgentePro."
    args_schema: Type[BaseModel] = WhatsAppSenderInput

    def _run(self, phone: str, message: str) -> str:
        # Verifica opt-out antes de enviar
        try:
            with httpx.Client() as client:
                headers = {"Authorization": f"Bearer {config.api_token}"} if config.api_token else {}
                
                # 1. Opt-out check
                opt_resp = client.get(
                    f"{config.api_url}/leads/optout/check?phone={phone}",
                    headers=headers
                )
                if opt_resp.status_code == 200 and opt_resp.json().get("isBlocked", False):
                    return f"Envio bloqueado: Lead {phone} está na blocklist (opt-out)."
                
                # 2. Chama a API Node.js central
                resp = client.post(
                    f"{config.api_url}/internal/messages/whatsapp",
                    json={
                        "phone": phone,
                        "message": message,
                    },
                    headers=headers
                )
                if resp.status_code in (200, 201):
                    return f"WhatsApp enviado com sucesso para {phone}."
                else:
                    return f"Erro ao enviar WhatsApp: {resp.text}"
        except Exception as e:
            return f"Erro interno ao enviar WhatsApp: {str(e)}"

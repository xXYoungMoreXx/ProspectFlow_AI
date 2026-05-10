from __future__ import annotations

import httpx
from typing import Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from src.config import config
import jwt
import time

class ContractNotifierInput(BaseModel):
    deal_id: str = Field(..., description="O ID do deal (negociação) para o qual o contrato será gerado.")
    phone: str = Field(..., description="O telefone do destinatário com DDI (ex: 5511999999999).")
    contract_value: float = Field(..., description="O valor acordado do contrato.")

class ContractNotifierTool(BaseTool):
    name: str = "contract_notifier"
    description: str = "Gera um link seguro para aceitação de proposta/contrato e envia via WhatsApp."
    args_schema: Type[BaseModel] = ContractNotifierInput

    def _run(self, deal_id: str, phone: str, contract_value: float) -> str:
        try:
            # 1. Gera token JWT temporário para o link do contrato (expira em 7 dias)
            secret = config.api_token or "super-secret-key"
            payload = {
                "dealId": deal_id,
                "amount": contract_value,
                "exp": int(time.time()) + 7 * 24 * 3600
            }
            token = jwt.encode(payload, secret, algorithm="HS256")
            
            # 2. Constrói o link
            proposal_link = f"{config.api_url}/public/deals/{deal_id}/proposal?token={token}"
            
            message = (
                f"Olá! Conforme nossa negociação, sua proposta no valor de R$ {contract_value:.2f} "
                f"está pronta. Por favor, acesse o link abaixo para revisar e aceitar os termos:\n\n"
                f"{proposal_link}\n\n"
                f"O link é válido por 7 dias."
            )
            
            # 3. Chama a API Node.js central para enviar a mensagem
            with httpx.Client() as client:
                headers = {"Authorization": f"Bearer {config.api_token}"} if config.api_token else {}
                
                resp = client.post(
                    f"{config.api_url}/internal/messages/whatsapp",
                    json={
                        "phone": phone,
                        "message": message,
                    },
                    headers=headers
                )
                if resp.status_code in (200, 201):
                    return f"Link do contrato gerado e enviado com sucesso para {phone}. Link: {proposal_link}"
                else:
                    # In tests this might be a mock route, so we just log and return the generated link
                    return f"Link gerado, mas erro ao enviar WhatsApp: {resp.text}. Link: {proposal_link}"
                    
        except Exception as e:
            return f"Erro interno ao notificar contrato: {str(e)}"

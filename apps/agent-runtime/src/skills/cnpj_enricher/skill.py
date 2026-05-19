# Removed future annotations
import json
import httpx
from typing import Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

class CNPJEnricherInput(BaseModel):
    cnpj: str = Field(..., description="O CNPJ da empresa a ser enriquecido (somente números ou formatado).")

class CNPJEnricherTool(BaseTool):
    name: str = "cnpj_enricher"
    description: str = "Busca dados enriquecidos de uma empresa pelo CNPJ (Quadro societário/QSA, capital social, CNAEs secundários)."
    args_schema: type[BaseModel] = CNPJEnricherInput

    def _run(self, cnpj: str) -> str:
        # Limpar formatação
        clean_cnpj = "".join(filter(str.isdigit, cnpj))
        if len(clean_cnpj) != 14:
            return "Erro: O CNPJ deve conter exatamente 14 dígitos."

        base_url = f"https://brasilapi.com.br/api/cnpj/v1/{clean_cnpj}"
        
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(base_url)
                if resp.status_code == 404:
                    return f"CNPJ {clean_cnpj} não encontrado."
                resp.raise_for_status()
                data = resp.json()

                # Extrair dados enriquecidos
                enriched_info = {
                    "cnpj": data.get("cnpj"),
                    "razao_social": data.get("razao_social"),
                    "capital_social": data.get("capital_social"),
                    "qsa": data.get("qsa", []),
                    "cnaes_secundarios": data.get("cnaes_secundarios", [])
                }
                
                return json.dumps(enriched_info, ensure_ascii=False, indent=2)
                
        except Exception as e:
            return f"Erro no enriquecimento do CNPJ: {str(e)}"

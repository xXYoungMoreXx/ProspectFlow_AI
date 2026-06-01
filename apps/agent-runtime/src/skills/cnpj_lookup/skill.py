# Removed future annotations
import json

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class CNPJLookupInput(BaseModel):
    cnpj: str = Field(..., description="O CNPJ da empresa (somente números ou formatado).")


class CNPJLookupTool(BaseTool):
    name: str = "cnpj_lookup"
    description: str = (
        "Busca os dados iniciais de uma empresa pelo CNPJ (razão social, nome fantasia, status, endereço)."
    )
    args_schema: type[BaseModel] = CNPJLookupInput

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

                # Extrair dados básicos
                basic_info = {
                    "cnpj": data.get("cnpj"),
                    "razao_social": data.get("razao_social"),
                    "nome_fantasia": data.get("nome_fantasia"),
                    "descricao_situacao_cadastral": data.get("descricao_situacao_cadastral"),
                    "data_inicio_atividade": data.get("data_inicio_atividade"),
                    "cnae_fiscal_descricao": data.get("cnae_fiscal_descricao"),
                    "endereco": (
                        f"{data.get('logradouro')}, {data.get('numero')} - "
                        f"{data.get('bairro')}, {data.get('municipio')} - {data.get('uf')}"
                    ),
                    "cep": data.get("cep"),
                    "telefone": data.get("ddd_telefone_1") or data.get("ddd_telefone_2"),
                }

                return json.dumps(basic_info, ensure_ascii=False, indent=2)

        except Exception as e:
            return f"Erro na consulta do CNPJ: {str(e)}"

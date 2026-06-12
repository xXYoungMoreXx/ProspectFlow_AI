from __future__ import annotations

import logging
import re

import chromadb
import litellm
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from src.config.llm_routing import get_model

logger = logging.getLogger(__name__)


class SiteGeneratorInput(BaseModel):
    business_name: str = Field(..., description="Nome do negócio")
    category: str = Field(..., description="Segmento do negócio (ex: clínica médica)")
    city: str = Field(..., description="Cidade do negócio")
    description: str = Field(..., description="Breve descrição do negócio")
    phone: str = Field(..., description="Telefone de contato")
    reference_url: str = Field("", description="URL do site de referência (opcional)")


class SiteGeneratorTool(BaseTool):
    name: str = "site_generator"
    description: str = (
        "Gera o código HTML completo e moderno de um site one-page e retorna o HTML "
        "para que o pipeline de build/deploy o persista."
    )
    args_schema: type[BaseModel] = SiteGeneratorInput

    def _run(
        self, business_name: str, category: str, city: str, description: str, phone: str, reference_url: str = ""
    ) -> str:
        prompt = f"""
        Você é um web designer de agência premium, especializado em sites para pequenos negócios locais.
        Crie um site HTML completo com padrão de design de 2026 para o seguinte cliente:

        DADOS DO CLIENTE:
        - Nome do negócio: {business_name}
        - Segmento: {category}
        - Cidade: {city}
        - Descrição: {description}
        - Telefone: {phone}

        SEÇÕES OBRIGATÓRIAS:
        1. Header sticky: nome do negócio + menu de navegação
        2. Hero com profundidade (gradiente mesh/formas CSS): título impactante + CTA WhatsApp
        3. Sobre: breve apresentação do negócio
        4. Serviços/Produtos: grid com 3-6 cards (sombras em camadas, hover states)
        5. Depoimentos: 3 depoimentos plausíveis
        6. Contato: telefone + endereço + botão WhatsApp flutuante
        7. Footer: redes sociais + copyright

        REGRAS TÉCNICAS:
        - HTML5 semântico em arquivo único (CSS no <style>, JS inline mínimo)
        - html lang="pt-BR"; acessibilidade nível Lighthouse 100 (contraste AA+, alt, focus-visible)
        - Tipografia fluida com clamp(); mobile-first com CSS Grid/Flexbox
        - Máx 2 Google Fonts via CDN (display=swap + preconnect)
        - prefers-reduced-motion respeitado
        - Visuais via CSS/SVG inline — sem imagens externas

        Retorne APENAS o código HTML completo, começando com <!DOCTYPE html>.
        """

        # Consult ChromaDB for builder knowledge (best-effort)
        try:
            chroma_client = chromadb.PersistentClient(path="./chroma_db")
            collection = chroma_client.get_collection(name="builder_knowledge")
            results = collection.query(query_texts=[category, "guideline"], n_results=3)
            if results["documents"] and results["documents"][0]:
                rag_context = "\nCONHECIMENTO EXTRAÍDO (RAG / Templates / Diretrizes):\n" + "\n---\n".join(
                    results["documents"][0]
                )
                prompt += f"\n\n{rag_context}\n"
        except Exception as e:
            logger.warning("Failed to query ChromaDB: %s", e)

        try:
            # WHY: sempre via LiteLLM (regra do projeto) e modelo do routing central —
            # o tier "coder" garante qualidade de código/design adequada.
            resp = litellm.completion(
                model=get_model("coder"),
                max_tokens=16000,
                temperature=0.5,
                messages=[{"role": "user", "content": prompt}],
            )
            html = (resp.choices[0].message.content or "").strip()

            if html.startswith("```"):
                html = re.sub(r"^```(?:html)?\n?", "", html)
                html = re.sub(r"\n?```$", "", html)

            if not html.startswith("<!DOCTYPE"):
                return f"Error generating site: output inesperado (não começa com <!DOCTYPE): {html[:200]}"

            # Retorna o HTML integral — o caller (pipeline de build) persiste e deploya.
            return html
        except Exception as e:
            return f"Error generating site: {str(e)}"

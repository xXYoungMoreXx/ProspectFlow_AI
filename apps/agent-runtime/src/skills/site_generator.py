from __future__ import annotations

import logging
import os
import re

import anthropic
import chromadb
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class SiteGeneratorInput(BaseModel):
    business_name: str = Field(..., description="Nome do negócio")
    category: str = Field(..., description="Segmento do negócio (ex: clínica médica)")
    city: str = Field(..., description="Cidade do negócio")
    description: str = Field(..., description="Breve descrição do negócio")
    phone: str = Field(..., description="Telefone de contato")
    reference_url: str = Field("", description="URL do site de referência (opcional)")


class SiteGeneratorTool(BaseTool):
    name: str = "site_generator"
    description: str = "Gera um código HTML completo e moderno para um site usando Anthropic Claude e faz o mock do deploy para Vercel."
    args_schema: type[BaseModel] = SiteGeneratorInput

    def _run(
        self, business_name: str, category: str, city: str, description: str, phone: str, reference_url: str = ""
    ) -> str:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return "Error: ANTHROPIC_API_KEY environment variable is not set."

        prompt = f"""
        Você é um web designer especializado em sites para pequenos negócios locais.
        Crie um site HTML completo, moderno e responsivo para o seguinte cliente:

        DADOS DO CLIENTE:
        - Nome do negócio: {business_name}
        - Segmento: {category}
        - Cidade: {city}
        - Descrição: {description}
        - Telefone: {phone}

        SEÇÕES OBRIGATÓRIAS:
        1. Header: logo + nome do negócio + menu de navegação
        2. Hero: título impactante + subtítulo + CTA principal (botão WhatsApp)
        3. Sobre: breve apresentação do negócio
        4. Serviços/Produtos: grid com 3-6 itens do nicho
        5. Depoimentos: 3 depoimentos fictícios
        6. Contato: formulário simples + telefone + endereço
        7. Footer: redes sociais + copyright

        REGRAS TÉCNICAS:
        - HTML5 semântico em arquivo único (CSS no <style> e JS no <script>)
        - Mobile-first, responsivo com CSS Grid/Flexbox
        - Cores que transmitam confiança para o segmento
        - Google Fonts via CDN
        - Sem dependências externas além de Google Fonts
        - Imagens do Unsplash para placeholders

        Retorne APENAS o código HTML completo.
        """

        try:
            # Consult ChromaDB for builder knowledge
            rag_context = ""
            try:
                chroma_client = chromadb.PersistentClient(path="./chroma_db")
                collection = chroma_client.get_collection(name="builder_knowledge")

                # Search based on the category and general best practices
                results = collection.query(query_texts=[category, "guideline"], n_results=3)

                if results["documents"] and results["documents"][0]:
                    rag_context = "\nCONHECIMENTO EXTRAÍDO (RAG / Templates / Diretrizes):\n" + "\n---\n".join(
                        results["documents"][0]
                    )
                    prompt += f"\n\n{rag_context}\n"
            except Exception as e:
                logging.warning(f"Failed to query ChromaDB: {e}")

            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
            )
            html = resp.content[0].text.strip()

            if html.startswith("```"):
                html = re.sub(r"^```(?:html)?\n?", "", html)
                html = re.sub(r"\n?```$", "", html)

            # Mock deployment to Vercel/Local
            slug = business_name.lower().replace(" ", "-")
            local_url = f"file:///tmp/sites/{slug}/index.html"

            return f"Site gerado com sucesso! (Tamanho: {len(html)} bytes)\nURL de preview: {local_url}"
        except Exception as e:
            return f"Error generating site: {str(e)}"

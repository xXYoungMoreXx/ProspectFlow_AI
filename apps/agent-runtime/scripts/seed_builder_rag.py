import json
import os

import chromadb

# Initialize ChromaDB client
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(name="builder_knowledge")

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, "..", "..", ".."))

docs_path = os.path.join(root_dir, "docs", "builder")
templates_path = os.path.join(root_dir, "packages", "templates")

documents = []
metadatas = []
ids = []

# Index docs
for filename in os.listdir(docs_path):
    if filename.endswith(".md"):
        filepath = os.path.join(docs_path, filename)
        with open(filepath, encoding="utf-8") as f:
            content = f.read()
            documents.append(content)
            metadatas.append({"source": filename, "type": "guideline"})
            ids.append(f"doc_{filename}")

# Index templates
if os.path.exists(templates_path):
    for template_dir in os.listdir(templates_path):
        meta_path = os.path.join(templates_path, template_dir, "metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
                documents.append(f"Template {template_dir}: {json.dumps(meta)}")
                metadatas.append({"source": template_dir, "type": "template", "serviceType": meta.get("serviceType")})
                ids.append(f"template_{template_dir}")

# S3-09: Niche-specific knowledge per SPEC-06 (restaurante, clínica, salão, advogado, academia)
NICHE_KNOWLEDGE = {
    "restaurante": {
        "id": "niche_restaurante",
        "text": (
            "Template T001-landing-page para RESTAURANTE. "
            "Seções: Hero com foto dos pratos, Cardápio (PDF ou inline), Endereço + Google Maps, "
            "Horário de funcionamento, WhatsApp para reservas/delivery, Avaliações Google. "
            "Cores: quentes (vermelho, laranja, dourado). Fonte: serifada para elegância. "
            "CTAs: 'Fazer Reserva', 'Pedir Delivery', 'Ver Cardápio'. "
            "Integração iFood/Rappi via link. Galeria de fotos com lazy-load. "
            "Schema.org Restaurant para SEO. Mobile-first obrigatório."
        ),
        "metadata": {"niche": "restaurante", "template": "T001-landing-page", "type": "niche_knowledge"},
    },
    "clinica": {
        "id": "niche_clinica",
        "text": (
            "Template para CLÍNICA / CONSULTÓRIO MÉDICO. "
            "Seções: Especialidades, Corpo clínico com fotos e CRMs, Agendamento online (CalCom/Doctoralia), "
            "Convênios aceitos, Localização + estacionamento, Depoimentos. "
            "Cores: azul/branco (confiança). Fonte: sans-serif limpa. "
            "CTAs: 'Agendar Consulta', 'Falar com Recepção'. "
            "LGPD: cookie consent + política de privacidade obrigatórios para dados de saúde. "
            "Schema.org MedicalClinic + Physician para SEO."
        ),
        "metadata": {"niche": "clinica", "template": "T001-landing-page", "type": "niche_knowledge"},
    },
    "salao": {
        "id": "niche_salao",
        "text": (
            "Template para SALÃO DE BELEZA / BARBEARIA. "
            "Seções: Serviços + preços, Galeria antes/depois, Equipe com fotos, "
            "Agendamento (WhatsApp ou Booksy), Localização, Instagram feed. "
            "Cores: Rosa/dourado (salão feminino) ou preto/branco/caramelo (barbearia). "
            "CTAs: 'Agendar Horário', 'Ver Portfólio'. "
            "Instagram embed ou grid de fotos dos trabalhos. "
            "Schema.org HairSalon ou BarberShop."
        ),
        "metadata": {"niche": "salao", "template": "T001-landing-page", "type": "niche_knowledge"},
    },
    "advogado": {
        "id": "niche_advogado",
        "text": (
            "Template para ESCRITÓRIO DE ADVOCACIA. "
            "Seções: Áreas de atuação, Sócios com OAB e fotos profissionais, "
            "Casos de sucesso (sem detalhes sigilosos), Contato + formulário, Blog jurídico. "
            "Cores: azul escuro, cinza, branco (seriedade). Fonte: serifada. "
            "IMPORTANTE: Não usar 'resultados garantidos' (veda OAB). "
            "CTAs: 'Consulta Gratuita', 'Falar com Advogado'. "
            "Schema.org LegalService + Attorney."
        ),
        "metadata": {"niche": "advogado", "template": "T001-landing-page", "type": "niche_knowledge"},
    },
    "academia": {
        "id": "niche_academia",
        "text": (
            "Template para ACADEMIA / STUDIO FITNESS. "
            "Seções: Modalidades (musculação, yoga, crossfit...), Planos e preços, "
            "Professores com certificações, Estrutura/equipamentos em fotos, "
            "Depoimentos de alunos, Horários de aulas, Trial gratuito. "
            "Cores: vibrante (laranja, verde, preto). Fonte: bold sans-serif. "
            "CTAs: 'Aula Experimental Grátis', 'Ver Planos'. "
            "Vídeo de ambiente da academia na hero. "
            "Schema.org SportsActivityLocation."
        ),
        "metadata": {"niche": "academia", "template": "T001-landing-page", "type": "niche_knowledge"},
    },
}

for niche_data in NICHE_KNOWLEDGE.values():
    documents.append(niche_data["text"])
    metadatas.append(niche_data["metadata"])
    ids.append(niche_data["id"])

print(f"Added {len(NICHE_KNOWLEDGE)} niche knowledge entries.")

# Upsert into ChromaDB
if documents:
    collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
    print(f"Successfully indexed {len(documents)} items into builder_knowledge.")
else:
    print("No documents found to index.")

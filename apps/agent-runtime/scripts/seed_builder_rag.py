import os
import json
import chromadb
from chromadb.config import Settings

# Initialize ChromaDB client
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(name="builder_knowledge")

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, '..', '..', '..'))

docs_path = os.path.join(root_dir, 'docs', 'builder')
templates_path = os.path.join(root_dir, 'packages', 'templates')

documents = []
metadatas = []
ids = []

# Index docs
for filename in os.listdir(docs_path):
    if filename.endswith(".md"):
        filepath = os.path.join(docs_path, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            documents.append(content)
            metadatas.append({"source": filename, "type": "guideline"})
            ids.append(f"doc_{filename}")

# Index templates
if os.path.exists(templates_path):
    for template_dir in os.listdir(templates_path):
        meta_path = os.path.join(templates_path, template_dir, 'metadata.json')
        if os.path.exists(meta_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
                documents.append(f"Template {template_dir}: {json.dumps(meta)}")
                metadatas.append({"source": template_dir, "type": "template", "serviceType": meta.get('serviceType')})
                ids.append(f"template_{template_dir}")

# Upsert into ChromaDB
if documents:
    collection.upsert(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    print(f"Successfully indexed {len(documents)} items into builder_knowledge.")
else:
    print("No documents found to index.")

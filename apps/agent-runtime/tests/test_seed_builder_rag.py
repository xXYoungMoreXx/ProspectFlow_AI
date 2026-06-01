import os
import unittest

import chromadb

# This test requires a pre-seeded ChromaDB at chroma_db/.
# In CI, ChromaDB is not seeded — skip unless the directory exists.
CHROMA_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chroma_db")
CHROMA_AVAILABLE = os.path.isdir(CHROMA_DB_PATH)


@unittest.skipUnless(CHROMA_AVAILABLE, "chroma_db/ not found — run seed_builder_rag.py first")
class TestSeedBuilderRag(unittest.TestCase):
    def test_chromadb_query_finds_t001(self):
        client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

        collections = [c.name for c in client.list_collections()]
        self.assertIn("builder_knowledge", collections)

        collection = client.get_collection(name="builder_knowledge")

        results = collection.query(
            query_texts=["landing page restaurante"],
            n_results=3,
        )

        documents_text = " ".join(results["documents"][0])
        self.assertIn("T001-landing-page", documents_text)


if __name__ == "__main__":
    unittest.main()

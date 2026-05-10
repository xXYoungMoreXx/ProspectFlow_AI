import unittest
import chromadb
import os

class TestSeedBuilderRag(unittest.TestCase):
    def test_chromadb_query_finds_t001(self):
        # Path to chroma_db, assuming it's in the apps/agent-runtime dir
        # If running from root, it will be apps/agent-runtime/chroma_db
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'chroma_db')
        
        client = chromadb.PersistentClient(path=db_path)
        
        # Verify collection exists
        collections = [c.name for c in client.list_collections()]
        self.assertIn("builder_knowledge", collections)
        
        collection = client.get_collection(name="builder_knowledge")
        
        # Query
        results = collection.query(
            query_texts=["landing page restaurante"],
            n_results=3
        )
        
        # Check if T001 is in results
        documents_text = " ".join(results['documents'][0])
        self.assertIn("T001-landing-page", documents_text)

if __name__ == '__main__':
    unittest.main()

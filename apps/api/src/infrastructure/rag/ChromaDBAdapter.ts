import { config } from "../../config.js";

export interface DocumentPayload {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface QueryResult {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  distance: number;
}

/**
 * RAG Adapter using ChromaDB HTTP API.
 * Communicates with ChromaDB to manage knowledge bases via collections.
 */
export class ChromaDBAdapter {
  private get baseUrl(): string {
    return config.CHROMADB_URL.replace(/\/$/, "") + "/api/v1";
  }

  /**
   * Ensures a collection exists, returning its ID.
   */
  async getOrCreateCollection(name: string): Promise<string> {
    // 1. Try to create the collection
    const createRes = await fetch(`${this.baseUrl}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, get_or_create: true }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(
        `ChromaDB Error creating collection [${createRes.status}]: ${err}`,
      );
    }

    const data = (await createRes.json()) as { id: string; name: string };
    return data.id;
  }

  /**
   * Adds or updates documents in a collection.
   * Assumes ChromaDB has a default embedding function configured,
   * so we pass raw documents instead of pre-computed embeddings.
   */
  async upsertDocuments(
    collectionName: string,
    docs: DocumentPayload[],
  ): Promise<void> {
    const collectionId = await this.getOrCreateCollection(collectionName);

    const ids = docs.map((d) => d.id);
    const documents = docs.map((d) => d.text);
    const metadatas = docs.map((d) => d.metadata || {});

    const res = await fetch(
      `${this.baseUrl}/collections/${collectionId}/upsert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          documents,
          metadatas,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `ChromaDB Error upserting documents [${res.status}]: ${err}`,
      );
    }
  }

  /**
   * Queries the collection for nearest neighbors to the query text.
   */
  async query(
    collectionName: string,
    queryText: string,
    nResults: number = 5,
  ): Promise<QueryResult[]> {
    const collectionId = await this.getOrCreateCollection(collectionName);

    const res = await fetch(
      `${this.baseUrl}/collections/${collectionId}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_texts: [queryText],
          n_results: nResults,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `ChromaDB Error querying documents [${res.status}]: ${err}`,
      );
    }

    const data = (await res.json()) as any;

    // ChromaDB returns results in arrays of arrays (since we can query multiple texts at once)
    const ids = data.ids[0] || [];
    const documents = data.documents[0] || [];
    const metadatas = data.metadatas[0] || [];
    const distances = data.distances[0] || [];

    const results: QueryResult[] = [];
    for (let i = 0; i < ids.length; i++) {
      results.push({
        id: ids[i],
        document: documents[i],
        metadata: metadatas[i] || {},
        distance: distances[i],
      });
    }

    return results;
  }

  /**
   * Lists all documents in a collection (up to limit).
   */
  async listDocuments(
    collectionName: string,
    limit = 100,
  ): Promise<QueryResult[]> {
    let collectionId: string;
    try {
      collectionId = await this.getOrCreateCollection(collectionName);
    } catch {
      return [];
    }

    const res = await fetch(`${this.baseUrl}/collections/${collectionId}/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      ids: string[];
      documents: string[];
      metadatas: Record<string, unknown>[];
    };

    return (data.ids ?? []).map((id, i) => ({
      id,
      document: data.documents?.[i] ?? "",
      metadata: data.metadatas?.[i] ?? {},
      distance: 0,
    }));
  }

  /**
   * Deletes a specific document from a collection.
   */
  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    const collectionId = await this.getOrCreateCollection(collectionName);

    const res = await fetch(
      `${this.baseUrl}/collections/${collectionId}/delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [docId] }),
      },
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(
        `ChromaDB Error deleting document [${res.status}]: ${err}`,
      );
    }
  }

  /**
   * Deletes a collection completely.
   */
  async deleteCollection(name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/collections/${name}`, {
      method: "DELETE",
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(
        `ChromaDB Error deleting collection [${res.status}]: ${err}`,
      );
    }
  }
}

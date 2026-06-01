import { ulid } from "ulid";
import type { AgentRepository } from "../../domain/agent/AgentRepository.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type {
  ChromaDBAdapter,
  QueryResult,
} from "../../infrastructure/rag/ChromaDBAdapter.js";
import type { BullMQAdapter } from "../../infrastructure/queue/BullMQAdapter.js";

// ── List documents ────────────────────────────────────────────────────────────

export class ListRagDocumentsHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly rag: ChromaDBAdapter,
  ) {}

  async execute(
    agentId: string,
    operatorId: string,
  ): Promise<Result<QueryResult[], Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    if (!agent.ragEnabled || !agent.ragCollection) {
      return ok([]);
    }
    const docs = await this.rag.listDocuments(agent.ragCollection);
    return ok(docs);
  }
}

// ── Upload document (async embedding via BullMQ) ──────────────────────────────

export interface UploadRagDocumentResult {
  jobId: string;
  docId: string;
  filename: string;
}

export class UploadRagDocumentHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly queue: BullMQAdapter,
  ) {}

  async execute(
    agentId: string,
    operatorId: string,
    filename: string,
    content: string,
    correlationId: string,
  ): Promise<Result<UploadRagDocumentResult, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const docId = ulid();
    const collectionName = agent.ragCollection ?? `agent_${agentId}`;

    // Enqueue embedding job — RAG worker picks it up and upserts to ChromaDB
    const jobId = await this.queue.enqueueAgentTask(
      "rag.embed_document",
      {
        agentId,
        operatorId,
        docId,
        collectionName,
        filename,
        content,
      },
      correlationId,
    );

    return ok({ jobId, docId, filename });
  }
}

// ── Delete document ───────────────────────────────────────────────────────────

export class DeleteRagDocumentHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly rag: ChromaDBAdapter,
  ) {}

  async execute(
    agentId: string,
    docId: string,
    operatorId: string,
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    if (!agent.ragEnabled || !agent.ragCollection) {
      return err(new Error("RAG is not enabled for this agent"));
    }
    await this.rag.deleteDocument(agent.ragCollection, docId);
    return ok(undefined);
  }
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface RagQueryResult {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  score: number;
}

export class QueryRagHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly rag: ChromaDBAdapter,
  ) {}

  async execute(
    agentId: string,
    operatorId: string,
    queryText: string,
    topK = 5,
  ): Promise<Result<RagQueryResult[], Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    if (!agent.ragEnabled || !agent.ragCollection) {
      return err(new Error("RAG is not enabled for this agent"));
    }

    const results = await this.rag.query(agent.ragCollection, queryText, topK);

    return ok(
      results.map((r) => ({
        id: r.id,
        document: r.document,
        metadata: r.metadata,
        score: 1 - r.distance, // ChromaDB distance → similarity score
      })),
    );
  }
}

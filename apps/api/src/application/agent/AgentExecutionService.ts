import type { Job } from 'bullmq';
import type { AgentRepository } from '../../domain/agent/AgentRepository.js';
import type { LLMRouter, LLMCompletionRequest } from '../../infrastructure/llm/LLMRouter.js';
import type { BullMQAdapter } from '../../infrastructure/queue/BullMQAdapter.js';
import type { ChromaDBAdapter } from '../../infrastructure/rag/ChromaDBAdapter.js';
import { agentTokensConsumedTotal } from '../../infrastructure/metrics/registry.js';

/**
 * AgentExecutionService — Core orchestration worker that processes
 * agent tasks from the BullMQ `agent-tasks` queue.
 *
 * Lifecycle:
 *   1. Receive job from queue (agentId, taskType, payload)
 *   2. Load Agent aggregate from DB
 *   3. Validate agent status (must be ACTIVE) and token budget
 *   4. Optionally enrich context via RAG (ChromaDB)
 *   5. Execute LLM call via CompositeLLMRouter
 *   6. Consume tokens from budget
 *   7. Record task completion event
 *   8. Persist updated agent state
 */

export interface AgentTaskPayload {
  agentId: string;
  operatorId: string;
  taskType: string;
  userPrompt: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTaskResult {
  agentId: string;
  taskType: string;
  output: string;
  tokensUsed: number;
  durationMs: number;
  ragContextUsed: boolean;
}

export class AgentExecutionService {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly llm: LLMRouter,
    private readonly rag: ChromaDBAdapter,
    private readonly queue: BullMQAdapter,
  ) {}

  /**
   * Initializes the BullMQ worker to process agent-tasks.
   * Call once during application bootstrap.
   */
  start(): void {
    this.queue.createWorker('agent-tasks', (job: Job) => this.processTask(job));
    console.info('[AgentExecutionService] Worker started on queue: agent-tasks');
  }

  private async processTask(job: Job): Promise<void> {
    const payload = job.data as AgentTaskPayload;
    const startTime = performance.now();

    // 1. Load Agent
    const agent = await this.agentRepo.findById(payload.agentId, payload.operatorId);
    if (!agent) {
      throw new Error(`Agent ${payload.agentId} not found for operator ${payload.operatorId}`);
    }

    // 2. Validate status
    if (agent.status !== 'ACTIVE') {
      throw new Error(`Agent ${agent.name} is ${agent.status}, cannot execute tasks`);
    }

    // 3. Build messages array
    const messages: LLMCompletionRequest['messages'] = [];

    // System prompt from agent config
    if (agent.llmConfig.systemPrompt) {
      messages.push({ role: 'system', content: agent.llmConfig.systemPrompt });
    }

    // 4. RAG enrichment (if enabled)
    let ragContextUsed = false;
    if (agent.ragEnabled && agent.ragCollection) {
      try {
        const ragResults = await this.rag.query(
          agent.ragCollection,
          payload.userPrompt,
          agent.ragTopK,
        );

        if (ragResults.length > 0) {
          const contextBlock = ragResults
            .map((r, i) => `[Source ${i + 1}]: ${r.document}`)
            .join('\n\n');

          messages.push({
            role: 'system',
            content: `Relevant context from knowledge base:\n\n${contextBlock}\n\nUse this context to inform your response when relevant.`,
          });
          ragContextUsed = true;
        }
      } catch (error) {
        // RAG failure is non-fatal — log and continue without context
        console.warn(`[AgentExecutionService] RAG query failed for agent ${agent.id}:`, error);
      }
    }

    // 5. Add user prompt
    messages.push({ role: 'user', content: payload.userPrompt });

    // 6. Execute LLM call
    const llmResponse = await this.llm.complete({
      provider: agent.llmConfig.provider,
      model: agent.llmConfig.model,
      baseUrl: agent.llmConfig.baseUrl,
      apiKeyRef: agent.llmConfig.apiKeyRef,
      messages,
      temperature: agent.llmConfig.temperature,
      maxTokens: agent.llmConfig.maxTokens,
    });

    // 7. Consume tokens from budget
    const budgetResult = agent.consumeTokens(llmResponse.tokensUsed);
    if (budgetResult.isErr()) {
      // Token budget exhausted — pause agent automatically
      agent.pause('Token budget exhausted');
      await this.agentRepo.save(agent);
      throw new Error(`Agent ${agent.name}: ${budgetResult.error.message}`);
    }

    // 8. Record completion
    const durationMs = Math.round(performance.now() - startTime);
    agent.recordTaskCompleted(payload.taskType, durationMs, llmResponse.tokensUsed);
    
    agentTokensConsumedTotal.inc(
      { persona: agent.persona, provider: agent.llmConfig.provider },
      llmResponse.tokensUsed
    );

    // 9. Persist updated agent state
    await this.agentRepo.save(agent);

    // 10. Update job progress for observability
    await job.updateProgress({
      output: llmResponse.content.slice(0, 500),
      tokensUsed: llmResponse.tokensUsed,
      durationMs,
      ragContextUsed,
    });

    console.info(
      `[AgentExecutionService] Task completed — agent=${agent.name} type=${payload.taskType} tokens=${llmResponse.tokensUsed} duration=${durationMs}ms`,
    );
  }
}

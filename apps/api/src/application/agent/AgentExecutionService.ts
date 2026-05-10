import type { Job } from 'bullmq';
import type { AgentRepository } from '../../domain/agent/AgentRepository.js';
import type { BullMQAdapter } from '../../infrastructure/queue/BullMQAdapter.js';
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

    // 3. Delegate to Python Runtime
    const runtimeUrl = process.env['PYTHON_RUNTIME_URL'] || 'http://localhost:8001';
    
    try {
      const response = await fetch(`${runtimeUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: payload.taskType,
          agent_id: payload.agentId,
          correlation_id: payload.correlationId,
          payload: {
            ...payload.metadata,
            user_message: payload.userPrompt,
            llm_config: agent.llmConfig,
            rag_enabled: agent.ragEnabled,
            rag_collection: agent.ragCollection,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Python Runtime returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as any;
      
      // Handle HITL Pause
      if (result.status === 'pending_hitl') {
        agent.pause('Awaiting human approval (HITL)');
        await this.agentRepo.save(agent);
        await job.updateProgress({ status: 'pending_hitl', error: result.error });
        throw new Error(`Agent Task paused for HITL: ${result.error}`);
      }
      
      // Simulate token consumption (CrewAI metrics are not directly returned in this mock, but we can assume usage)
      // In a real app, the Python backend would return exact token usage in the response payload.
      const simulatedTokens = 500;
      const budgetResult = agent.consumeTokens(simulatedTokens);
      if (budgetResult.isErr()) {
        agent.pause('Token budget exhausted');
        await this.agentRepo.save(agent);
        throw new Error(`Agent ${agent.name}: ${budgetResult.error.message}`);
      }

      // 4. Record completion
      const durationMs = Math.round(performance.now() - startTime);
      agent.recordTaskCompleted(payload.taskType, durationMs, simulatedTokens);
      
      agentTokensConsumedTotal.inc(
        { persona: agent.persona, provider: agent.llmConfig.provider },
        simulatedTokens
      );

      // 5. Persist updated agent state
      await this.agentRepo.save(agent);

      // 6. Update job progress for observability
      await job.updateProgress({
        output: result.result?.raw_output || result.result?.html || result.result?.audit_report,
        tokensUsed: simulatedTokens,
        durationMs,
        ragContextUsed: agent.ragEnabled,
      });

      console.info(
        `[AgentExecutionService] Task completed — agent=${agent.name} type=${payload.taskType} duration=${durationMs}ms`,
      );
    } catch (error) {
      console.error(`[AgentExecutionService] Failed to execute task for agent ${agent.id}:`, error);
      throw error;
    }
  }
}

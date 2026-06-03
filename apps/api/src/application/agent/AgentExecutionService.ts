import type { Job } from "bullmq";
import { ulid } from "ulid";
import type { AgentRepository } from "../../domain/agent/AgentRepository.js";
import type { BullMQAdapter } from "../../infrastructure/queue/BullMQAdapter.js";
import type { LeadRepository } from "../../domain/lead/LeadRepository.js";
import type { HITLApprovalRepository } from "../../domain/hitl/HITLApprovalRepository.js";
import type { ProjectRepository } from "../../domain/project/ProjectRepository.js";
import { Lead } from "../../domain/lead/Lead.js";
import { HITLApproval } from "../../domain/hitl/HITLApproval.js";
import { HITLLevel } from "../../domain/hitl/HITLLevel.js";
import { HITLActionType } from "../../domain/hitl/HITLActionType.js";
import { HITLTimeouts } from "../../domain/hitl/HITLTimeouts.js";
import { agentTokensConsumedTotal } from "../../infrastructure/metrics/registry.js";

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

interface HunterLeadOutput {
  name?: string;
  address?: string;
  phone?: string;
  rating?: number;
  total_ratings?: number;
  place_id?: string;
  score?: number;
}

export class AgentExecutionService {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly queue: BullMQAdapter,
    private readonly leadRepo?: LeadRepository,
    private readonly hitlRepo?: HITLApprovalRepository,
    private readonly projectRepo?: ProjectRepository,
  ) {}

  /**
   * Initializes the BullMQ worker to process agent-tasks.
   * Call once during application bootstrap.
   */
  start(): void {
    this.queue.createWorker("agent-tasks", (job: Job) => this.processTask(job));
    console.info(
      "[AgentExecutionService] Worker started on queue: agent-tasks",
    );
  }

  private async processTask(job: Job): Promise<void> {
    const payload = job.data as AgentTaskPayload;
    const startTime = performance.now();

    // 1. Load Agent
    const agent = await this.agentRepo.findById(
      payload.agentId,
      payload.operatorId,
    );
    if (!agent) {
      throw new Error(
        `Agent ${payload.agentId} not found for operator ${payload.operatorId}`,
      );
    }

    // 2. Validate status
    if (agent.status !== "ACTIVE") {
      throw new Error(
        `Agent ${agent.name} is ${agent.status}, cannot execute tasks`,
      );
    }

    // 3. Delegate to Python Runtime
    const runtimeUrl =
      process.env["PYTHON_RUNTIME_URL"] || "http://localhost:8001";

    try {
      const response = await fetch(`${runtimeUrl}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Python Runtime returned ${response.status}: ${await response.text()}`,
        );
      }

      const result = (await response.json()) as any;

      // Handle HITL Pause
      if (result.status === "pending_hitl") {
        agent.pause("Awaiting human approval (HITL)");
        await this.agentRepo.save(agent);
        await job.updateProgress({
          status: "pending_hitl",
          error: result.error,
        });
        throw new Error(`Agent Task paused for HITL: ${result.error}`);
      }

      // Simulate token consumption (CrewAI metrics are not directly returned in this mock, but we can assume usage)
      // In a real app, the Python backend would return exact token usage in the response payload.
      const simulatedTokens = 500;
      const budgetResult = agent.consumeTokens(simulatedTokens);
      if (budgetResult.isErr()) {
        agent.pause("Token budget exhausted");
        await this.agentRepo.save(agent);
        throw new Error(`Agent ${agent.name}: ${budgetResult.error.message}`);
      }

      // 4. Record completion
      const durationMs = Math.round(performance.now() - startTime);
      agent.recordTaskCompleted(payload.taskType, durationMs, simulatedTokens);

      agentTokensConsumedTotal.inc(
        { persona: agent.persona, provider: agent.llmConfig.provider },
        simulatedTokens,
      );

      // 5. Persist updated agent state
      await this.agentRepo.save(agent);

      // 6. Post-process: persist hunter leads + create HITL
      if (payload.taskType === "hunter.search" && result.result?.raw_output) {
        await this.persistHunterLeads(
          payload.agentId,
          payload.operatorId,
          payload.correlationId,
          result.result.raw_output as string,
        );
      }

      // Post-process: builder.generate completed → store artifact + HITL APPROVE_STAGING
      if (
        payload.taskType === "builder.generate" &&
        result.status === "completed" &&
        this.hitlRepo &&
        this.projectRepo
      ) {
        await this.createBuilderStagingHITL(
          payload,
          result.result as { html?: string; previewUrl?: string } | null,
        );
      }

      // 7. Update job progress for observability
      await job.updateProgress({
        output:
          result.result?.raw_output ||
          result.result?.html ||
          result.result?.audit_report,
        tokensUsed: simulatedTokens,
        durationMs,
        ragContextUsed: agent.ragEnabled,
      });

      console.info(
        `[AgentExecutionService] Task completed — agent=${agent.name} type=${payload.taskType} duration=${durationMs}ms`,
      );
    } catch (error) {
      console.error(
        `[AgentExecutionService] Failed to execute task for agent ${agent.id}:`,
        error,
      );
      throw error;
    }
  }

  // S1-10: Parse Hunter output → persist leads as PROSPECTED + create HITL batch
  private async persistHunterLeads(
    agentId: string,
    operatorId: string,
    _correlationId: string,
    rawOutput: string,
  ): Promise<void> {
    if (!this.leadRepo || !this.hitlRepo) return;

    let leads: HunterLeadOutput[] = [];
    try {
      // Hunter returns JSON array (may be wrapped in markdown code block)
      const match = rawOutput.match(/\[[\s\S]*\]/);
      if (match) {
        leads = JSON.parse(match[0]) as HunterLeadOutput[];
      }
    } catch {
      console.warn(
        "[AgentExecutionService] Hunter output is not valid JSON, skipping persistence",
      );
      return;
    }

    if (!leads.length) return;

    const savedLeadIds: string[] = [];

    for (const raw of leads) {
      const contactName = raw.name ?? "Unknown";
      if (!contactName || contactName.length < 1) continue;

      // Mask PII for HITL payload
      const maskedPhone = raw.phone
        ? raw.phone.replace(/(\+?\d{2,3})(\d+)(\d{4})$/, "$1***$3")
        : undefined;

      const leadResult = Lead.create({
        id: ulid(),
        operatorId,
        assignedAgentId: agentId,
        contact: {
          name: contactName,
          phone: raw.phone,
          company: contactName,
        },
        source: "GOOGLE_MAPS",
      });

      if (leadResult.isErr()) continue;

      const lead = leadResult.value;
      if (raw.score !== undefined) {
        lead.qualify(Math.min(raw.score * 10, 100), agentId);
      }

      try {
        await this.leadRepo.save(lead);
        savedLeadIds.push(lead.id);
      } catch {
        // deduplicate — skip if already exists
      }

      // Build PII-masked payload for HITL preview
      const previewPayload: Record<string, unknown> = {
        leadId: lead.id,
        name: `${contactName.slice(0, 3)}***`,
        phone: maskedPhone,
        address: raw.address,
        rating: raw.rating,
        totalRatings: raw.total_ratings,
        score: raw.score,
      };

      const hitlResult = HITLApproval.create({
        id: ulid(),
        operatorId,
        agentId,
        hitlLevel: HITLLevel.HITL_1,
        actionType: HITLActionType.APPROVE_LEAD_LIST,
        contextType: "LEAD",
        contextId: lead.id,
        payloadPreview: previewPayload,
        timeoutMinutes: HITLTimeouts[HITLActionType.APPROVE_LEAD_LIST],
      });

      if (hitlResult.isOk()) {
        await this.hitlRepo.save(hitlResult.value);
      }
    }

    console.info(
      `[AgentExecutionService] Hunter persisted ${savedLeadIds.length} leads for operator=${operatorId}`,
    );
  }

  private async createBuilderStagingHITL(
    payload: AgentTaskPayload,
    builderResult: { html?: string; previewUrl?: string } | null,
  ): Promise<void> {
    const projectId = payload.metadata?.["projectId"] as string | undefined;
    if (!projectId || !this.projectRepo || !this.hitlRepo) return;

    const project = await this.projectRepo.findById(
      projectId,
      payload.operatorId,
    );
    if (!project) {
      console.warn(
        `[AgentExecutionService] builder.generate: project ${projectId} not found, skipping HITL`,
      );
      return;
    }

    if (builderResult?.html) {
      project.storeBuildArtifact(builderResult.html);
      await this.projectRepo.save(project);
    }

    const hitlResult = HITLApproval.create({
      id: ulid(),
      operatorId: payload.operatorId,
      agentId: payload.agentId,
      hitlLevel: HITLLevel.HITL_1,
      actionType: HITLActionType.APPROVE_STAGING,
      contextType: "PROJECT",
      contextId: projectId,
      payloadPreview: {
        projectId,
        sitePreviewUrl: builderResult?.previewUrl ?? null,
        buildCompletedAt: new Date().toISOString(),
      },
      timeoutMinutes: HITLTimeouts[HITLActionType.APPROVE_STAGING],
    });

    if (hitlResult.isOk()) {
      await this.hitlRepo.save(hitlResult.value);
      console.info(
        `[AgentExecutionService] HITL APPROVE_STAGING created for project=${projectId}`,
      );
    }
  }
}

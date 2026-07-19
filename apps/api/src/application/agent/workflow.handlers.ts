import { eq, and, inArray } from "drizzle-orm";
import {
  workflowDefinitions,
  subAgents,
} from "../../infrastructure/db/schema.js";
import {
  validateWorkflowDAG,
  type WorkflowDefinition,
} from "../../domain/agent/WorkflowDefinition.js";
import { ValidationError, NotFoundError } from "../../domain/shared/Result.js";

type Db = any;
type AgentRepo = any;

export class SaveWorkflowHandler {
  constructor(
    private readonly database: Db,
    private readonly agentRepo: AgentRepo,
  ) {}

  async execute(cmd: {
    agentId: string;
    workflow: WorkflowDefinition;
    operatorId: string;
    organizationId?: string;
  }) {
    const agent = await this.agentRepo.findById(
      cmd.agentId,
      cmd.operatorId,
      cmd.organizationId ?? "org_mvp"
    );
    if (!agent) {
      throw new NotFoundError("Agent", cmd.agentId);
    }

    validateWorkflowDAG(cmd.workflow);

    const subAgentIds = cmd.workflow.nodes.map((n) => n.subAgentId);
    if (subAgentIds.length > 0) {
      const found = (await this.database
        .select({ id: subAgents.id })
        .from(subAgents)
        .where(
          and(
            eq(subAgents.agentId, cmd.agentId),
            inArray(subAgents.id, subAgentIds),
          ),
        )
        .execute()) as Array<{ id: string }>;
      if (found.length !== subAgentIds.length) {
        throw new ValidationError(
          "Um ou mais sub-agentes não pertencem a este agente",
          "workflow",
        );
      }
    }

    const [saved] = (await this.database
      .insert(workflowDefinitions)
      .values({
        agentId: cmd.agentId,
        definition: cmd.workflow as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: workflowDefinitions.agentId,
        set: {
          definition: cmd.workflow as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })
      .returning()
      .execute()) as unknown[];

    return { data: saved };
  }
}

export class GetWorkflowHandler {
  constructor(
    private readonly database: Db,
    private readonly agentRepo: AgentRepo,
  ) {}

  async execute(cmd: {
    agentId: string;
    operatorId: string;
    organizationId?: string;
  }) {
    const agent = await this.agentRepo.findById(
      cmd.agentId,
      cmd.operatorId,
      cmd.organizationId ?? "org_mvp"
    );
    if (!agent) {
      throw new NotFoundError("Agent", cmd.agentId);
    }

    const [row] = (await this.database
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.agentId, cmd.agentId))
      .limit(1)
      .execute()) as Array<Record<string, unknown>>;

    return { data: (row?.["definition"] as WorkflowDefinition) ?? null };
  }
}

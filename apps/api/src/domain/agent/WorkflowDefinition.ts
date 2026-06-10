import { ValidationError } from "../shared/Result.js";

export interface WorkflowNode {
  subAgentId: string;
  executionMode: "sequential" | "parallel";
  parallelGroup?: number;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowDefinition {
  agentId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalTimeoutSeconds: number;
  maxParallelWorkers: number;
  onFailure: "STOP" | "CONTINUE" | "ESCALATE_HITL";
}

export function validateWorkflowDAG(def: WorkflowDefinition): void {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const adj = new Map<string, string[]>();

  for (const edge of def.edges) {
    const neighbors = adj.get(edge.from) ?? [];
    neighbors.push(edge.to);
    adj.set(edge.from, neighbors);
  }

  function dfs(node: string): void {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        throw new ValidationError(
          `Workflow tem ciclo: ${node} → ${neighbor}`,
          "workflow",
        );
      }
    }
    inStack.delete(node);
  }

  for (const node of def.nodes) {
    if (!visited.has(node.subAgentId)) dfs(node.subAgentId);
  }
}

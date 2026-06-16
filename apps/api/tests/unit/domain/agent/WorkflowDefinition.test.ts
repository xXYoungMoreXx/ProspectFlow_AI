import { describe, it, expect } from "vitest";
import {
  validateWorkflowDAG,
  type WorkflowDefinition,
} from "../../../../src/domain/agent/WorkflowDefinition.js";
import { ValidationError } from "../../../../src/domain/shared/Result.js";

const make = (
  nodes: string[],
  edges: [string, string][],
): WorkflowDefinition => ({
  agentId: "a1",
  nodes: nodes.map((id) => ({
    subAgentId: id,
    executionMode: "sequential" as const,
    position: { x: 0, y: 0 },
  })),
  edges: edges.map(([from, to]) => ({ from, to })),
  globalTimeoutSeconds: 300,
  maxParallelWorkers: 3,
  onFailure: "STOP",
});

describe("validateWorkflowDAG()", () => {
  it("passes for linear A→B→C", () => {
    expect(() =>
      validateWorkflowDAG(
        make(
          ["A", "B", "C"],
          [
            ["A", "B"],
            ["B", "C"],
          ],
        ),
      ),
    ).not.toThrow();
  });
  it("passes for parallel fan-in (A,B)→C", () => {
    expect(() =>
      validateWorkflowDAG(
        make(
          ["A", "B", "C"],
          [
            ["A", "C"],
            ["B", "C"],
          ],
        ),
      ),
    ).not.toThrow();
  });
  it("throws ValidationError for direct cycle A→B→A", () => {
    expect(() =>
      validateWorkflowDAG(
        make(
          ["A", "B"],
          [
            ["A", "B"],
            ["B", "A"],
          ],
        ),
      ),
    ).toThrow(ValidationError);
  });
  it("throws ValidationError for indirect cycle A→B→C→A", () => {
    expect(() =>
      validateWorkflowDAG(
        make(
          ["A", "B", "C"],
          [
            ["A", "B"],
            ["B", "C"],
            ["C", "A"],
          ],
        ),
      ),
    ).toThrow(ValidationError);
  });
  it("passes for empty workflow", () => {
    expect(() => validateWorkflowDAG(make([], []))).not.toThrow();
  });
});

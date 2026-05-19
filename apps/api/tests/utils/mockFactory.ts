import { vi } from "vitest";

export const createMockRepo = <T extends Record<string, any>>(
  methods: (keyof T)[],
) => {
  const mock: any = {};
  for (const method of methods) {
    mock[method] = vi.fn();
  }
  return mock as {
    [K in keyof T]: T[K] extends (...args: any[]) => any
      ? ReturnType<typeof vi.fn>
      : never;
  };
};

export const createMockHitlRepo = () =>
  createMockRepo(["save", "findById", "findPending", "findByOperator"]);

export const createMockLeadRepo = () =>
  createMockRepo(["save", "findById", "findList"]);

export const createMockDealRepo = () =>
  createMockRepo(["save", "findById", "findMany"]);

export const createMockProjectRepo = () =>
  createMockRepo(["save", "findById", "findMany"]);

export const createMockAuthRepo = () => createMockRepo(["save", "findByEmail"]);

export const createMockAgentRepo = () =>
  createMockRepo(["save", "findById", "findMany"]);

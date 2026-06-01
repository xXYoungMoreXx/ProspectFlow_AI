import { describe, it, expect } from "vitest";
import { Project } from "./Project.js";
import { randomUUID } from "node:crypto";

function makeProject(
  overrides: Partial<Parameters<typeof Project.create>[0]> = {},
) {
  return Project.create({
    id: randomUUID(),
    dealId: randomUUID(),
    operatorId: randomUUID(),
    briefing: {},
    ...overrides,
  });
}

describe("Project", () => {
  describe("create()", () => {
    it("creates with status PLANNING and emits project.started", () => {
      const r = makeProject();
      expect(r.isOk()).toBe(true);
      const project = r.unwrap();
      expect(project.status).toBe("PLANNING");
      expect(project.revisionCount).toBe(0);
      const events = project.clearDomainEvents();
      expect(events[0]!.eventType).toBe("project.started");
    });
  });

  describe("markReadyForReview()", () => {
    it("transitions to REVIEW and sets deliverable URL", () => {
      const project = makeProject().unwrap();
      project.clearDomainEvents();
      project.markReadyForReview("https://preview.example.com");
      expect(project.status).toBe("REVIEW");
      expect(project.deliverableUrl).toBe("https://preview.example.com");
      const events = project.clearDomainEvents();
      expect(events[0]!.eventType).toBe("project.ready_for_review");
    });
  });

  describe("deliver()", () => {
    it("transitions to DELIVERED with Lighthouse scores", () => {
      const project = makeProject().unwrap();
      project.clearDomainEvents();
      project.deliver("https://site.example.com", {
        performance: 90,
        accessibility: 100,
        seo: 92,
        bestPractices: 95,
      });
      expect(project.status).toBe("DELIVERED");
      expect(project.lighthouse.performance).toBe(90);
      expect(project.lighthouse.accessibility).toBe(100);
      const events = project.clearDomainEvents();
      expect(events[0]!.eventType).toBe("project.delivered");
    });
  });

  describe("requestRevision()", () => {
    it("transitions to REVISION and increments count", () => {
      const project = makeProject().unwrap();
      project.clearDomainEvents();
      const r = project.requestRevision("Fix mobile layout");
      expect(r.isOk()).toBe(true);
      expect(project.status).toBe("REVISION");
      expect(project.revisionCount).toBe(1);
      const events = project.clearDomainEvents();
      expect(events[0]!.eventType).toBe("project.revision_requested");
    });

    it("allows up to 3 revisions", () => {
      const project = makeProject().unwrap();
      project.requestRevision("Rev 1");
      project.requestRevision("Rev 2");
      expect(project.requestRevision("Rev 3").isOk()).toBe(true);
      expect(project.revisionCount).toBe(3);
    });

    it("fails on 4th revision (max is 3)", () => {
      const project = makeProject().unwrap();
      project.requestRevision("1");
      project.requestRevision("2");
      project.requestRevision("3");
      expect(project.requestRevision("4").isErr()).toBe(true);
    });

    it("fails on CANCELLED project", () => {
      const project = Project.reconstitute({
        id: randomUUID(),
        dealId: randomUUID(),
        operatorId: randomUUID(),
        status: "CANCELLED",
        briefing: {},
        deliverableMeta: {},
        lighthouse: {},
        revisionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(project.requestRevision("rev").isErr()).toBe(true);
    });
  });
});

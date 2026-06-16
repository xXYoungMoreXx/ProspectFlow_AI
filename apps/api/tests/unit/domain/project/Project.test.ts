import { describe, it, expect } from "vitest";
import { Project } from "../../../../src/domain/project/Project.js";

describe("Project Entity", () => {
  it("should create a valid project and emit started event", () => {
    const result = Project.create({
      id: "proj-1",
      dealId: "deal-1",
      operatorId: "op-1",
      briefing: {},
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const project = result.value;
      expect(project.status).toBe("PLANNING");
      expect(project.revisionCount).toBe(0);
      expect(project.domainEvents.length).toBe(1);
      expect(project.domainEvents[0].eventType).toBe("project.started");
    }
  });

  it("should mark project ready for review", () => {
    const project = Project.create({
      id: "proj-1",
      dealId: "deal-1",
      operatorId: "op-1",
      briefing: {},
    }).unwrap();

    project.clearDomainEvents();

    project.markReadyForReview("https://preview.vercel.app");
    expect(project.status).toBe("REVIEW");
    expect(project.deliverableUrl).toBe("https://preview.vercel.app");
    expect(project.domainEvents.length).toBe(1);
    expect(project.domainEvents[0].eventType).toBe("project.ready_for_review");
  });

  it("should handle delivery and scores", () => {
    const project = Project.create({
      id: "proj-1",
      dealId: "deal-1",
      operatorId: "op-1",
      briefing: {},
    }).unwrap();

    project.clearDomainEvents();

    project.deliver("https://final.vercel.app", {
      performance: 98,
      accessibility: 100,
      seo: 95,
      bestPractices: 100,
    });

    expect(project.status).toBe("DELIVERED");
    expect(project.deliverableUrl).toBe("https://final.vercel.app");
    expect(project.lighthouse.performance).toBe(98);
    expect(project.domainEvents.length).toBe(1);
    expect(project.domainEvents[0].eventType).toBe("project.delivered");
  });

  describe("storeMockup()", () => {
    it("should persist mockupHtml and mockupUrl", () => {
      const project = Project.create({
        id: "proj-1",
        dealId: "deal-1",
        operatorId: "op-1",
        briefing: {},
      }).unwrap();

      project.storeMockup(
        "<html>mockup</html>",
        "https://example.com/mockup.html",
      );

      expect(project.mockupHtml).toBe("<html>mockup</html>");
      expect(project.mockupUrl).toBe("https://example.com/mockup.html");
    });

    it("should overwrite previous mockup values", () => {
      const project = Project.create({
        id: "proj-2",
        dealId: "deal-2",
        operatorId: "op-1",
        briefing: {},
      }).unwrap();

      project.storeMockup("<html>v1</html>", "https://example.com/v1.html");
      project.storeMockup("<html>v2</html>", "https://example.com/v2.html");

      expect(project.mockupHtml).toBe("<html>v2</html>");
      expect(project.mockupUrl).toBe("https://example.com/v2.html");
    });

    it("should have undefined mockupHtml and mockupUrl before storeMockup is called", () => {
      const project = Project.create({
        id: "proj-3",
        dealId: "deal-3",
        operatorId: "op-1",
        briefing: {},
      }).unwrap();

      expect(project.mockupHtml).toBeUndefined();
      expect(project.mockupUrl).toBeUndefined();
    });
  });

  it("should request revision and increment counter", () => {
    const project = Project.create({
      id: "proj-1",
      dealId: "deal-1",
      operatorId: "op-1",
      briefing: {},
    }).unwrap();

    project.markReadyForReview("https://preview.vercel.app");
    project.clearDomainEvents();

    const revisionResult = project.requestRevision("Needs more blue color");
    expect(revisionResult.isOk()).toBe(true);
    expect(project.status).toBe("REVISION");
    expect(project.revisionCount).toBe(1);
    expect(project.domainEvents.length).toBe(1);
    expect(project.domainEvents[0].eventType).toBe(
      "project.revision_requested",
    );
  });
});

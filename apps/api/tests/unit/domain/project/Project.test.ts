import { describe, it, expect } from 'vitest';
import { Project } from '../../../../src/domain/project/Project.js';

describe('Project Entity', () => {
  it('should create a valid project and emit started event', () => {
    const result = Project.create({
      id: 'proj-1',
      dealId: 'deal-1',
      operatorId: 'op-1',
      briefing: {},
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const project = result.value;
      expect(project.status).toBe('PLANNING');
      expect(project.revisionCount).toBe(0);
      expect(project.domainEvents.length).toBe(1);
      expect(project.domainEvents[0].eventType).toBe('project.started');
    }
  });

  it('should mark project ready for review', () => {
    const project = Project.create({
      id: 'proj-1',
      dealId: 'deal-1',
      operatorId: 'op-1',
      briefing: {},
    }).unwrap();

    project.clearDomainEvents();

    project.markReadyForReview('https://preview.vercel.app');
    expect(project.status).toBe('REVIEW');
    expect(project.deliverableUrl).toBe('https://preview.vercel.app');
    expect(project.domainEvents.length).toBe(1);
    expect(project.domainEvents[0].eventType).toBe('project.ready_for_review');
  });

  it('should handle delivery and scores', () => {
    const project = Project.create({
      id: 'proj-1',
      dealId: 'deal-1',
      operatorId: 'op-1',
      briefing: {},
    }).unwrap();

    project.clearDomainEvents();

    project.deliver('https://final.vercel.app', {
      performance: 98,
      accessibility: 100,
      seo: 95,
      bestPractices: 100,
    });

    expect(project.status).toBe('DELIVERED');
    expect(project.deliverableUrl).toBe('https://final.vercel.app');
    expect(project.lighthouse.performance).toBe(98);
    expect(project.domainEvents.length).toBe(1);
    expect(project.domainEvents[0].eventType).toBe('project.delivered');
  });

  it('should request revision and increment counter', () => {
    const project = Project.create({
      id: 'proj-1',
      dealId: 'deal-1',
      operatorId: 'op-1',
      briefing: {},
    }).unwrap();

    project.markReadyForReview('https://preview.vercel.app');
    project.clearDomainEvents();

    const revisionResult = project.requestRevision('Needs more blue color');
    expect(revisionResult.isOk()).toBe(true);
    expect(project.status).toBe('REVISION');
    expect(project.revisionCount).toBe(1);
    expect(project.domainEvents.length).toBe(1);
    expect(project.domainEvents[0].eventType).toBe('project.revision_requested');
  });
});

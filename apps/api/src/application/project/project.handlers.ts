import type { ProjectRepository, ProjectFilters, ProjectListResult } from '../../domain/project/ProjectRepository.js';
import { NotFoundError, ok, err, type Result } from '../../domain/shared/Result.js';
import type { Project } from '../../domain/project/Project.js';

export class GetProjectsHandler {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(filters: ProjectFilters): Promise<ProjectListResult> {
    return this.repo.findMany(filters);
  }
}

export class GetProjectByIdHandler {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(projectId: string, operatorId: string): Promise<Result<Project, NotFoundError>> {
    const project = await this.repo.findById(projectId, operatorId);
    if (!project) return err(new NotFoundError('Project', projectId));
    return ok(project);
  }
}

export class RequestRevisionHandler {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(projectId: string, operatorId: string, notes: string): Promise<Result<Project, Error>> {
    const project = await this.repo.findById(projectId, operatorId);
    if (!project) return err(new NotFoundError('Project', projectId));

    const result = project.requestRevision(notes);
    if (result.isErr()) return result;

    await this.repo.save(project);
    return ok(project);
  }
}

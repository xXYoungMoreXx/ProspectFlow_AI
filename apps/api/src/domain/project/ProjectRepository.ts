import type { Project } from "./Project.js";
import type { ProjectStatus } from "@agentepro/shared-types";

export interface ProjectFilters {
  operatorId: string;
  organizationId: string;
  status?: ProjectStatus;
  dealId?: string;
  cursor?: string;
  limit?: number;
}

export interface ProjectListResult {
  projects: Project[];
  total: number;
  nextCursor: string | null;
}

export interface ProjectRepository {
  findById(
    id: string,
    operatorId: string,
    organizationId: string,
  ): Promise<Project | null>;
  findMany(filters: ProjectFilters): Promise<ProjectListResult>;
  save(project: Project): Promise<void>;
}

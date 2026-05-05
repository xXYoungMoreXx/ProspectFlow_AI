export interface AuditEntry {
  id: string;
  actor: 'operator' | 'agent' | 'system';
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  ipAddress?: string;
  correlationId: string;
  causationId?: string;
}

/**
 * Port — Audit log persistence (append-only).
 * No update or delete operations allowed.
 */
export interface AuditLogRepository {
  append(entry: AuditEntry): Promise<void>;
  findByResource(resourceType: string, resourceId: string): Promise<AuditEntry[]>;
  findByCorrelation(correlationId: string): Promise<AuditEntry[]>;
}

import { ulid } from 'ulid';
import type { DomainEventBase } from '@agentepro/shared-types';

/**
 * Base class for Domain Events.
 * All events are immutable and carry tracing metadata.
 */
export function createDomainEvent<T extends Record<string, unknown>>(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: T,
  correlationId?: string,
  causationId?: string,
): DomainEventBase & { payload: T } {
  return Object.freeze({
    eventId: ulid(),
    eventType,
    aggregateType,
    aggregateId,
    occurredAt: new Date().toISOString(),
    correlationId: correlationId ?? ulid(),
    causationId,
    payload: Object.freeze(payload),
  });
}

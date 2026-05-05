import type { DomainEventBase } from '@agentepro/shared-types';

/**
 * Base class for Aggregate Roots.
 * Aggregates collect domain events during their lifecycle.
 * Events are cleared after being dispatched.
 */
export abstract class AggregateRoot {
  private _domainEvents: DomainEventBase[] = [];

  get domainEvents(): ReadonlyArray<DomainEventBase> {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEventBase): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): DomainEventBase[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}

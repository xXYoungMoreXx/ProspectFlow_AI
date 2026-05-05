import { Queue, Worker, type Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import type { DomainEventBase } from '@agentepro/shared-types';

export interface QueueConfig {
  connection: RedisOptions;
}

/**
 * BullMQ Adapter — publishes domain events and manages task queues.
 * Queues: agent-tasks, hitl-expiration, email-sending, site-building
 */
export class BullMQAdapter {
  private readonly queues: Map<string, Queue> = new Map();

  constructor(private readonly config: QueueConfig) {}

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.config.connection });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async publishEvent(event: DomainEventBase): Promise<void> {
    const queue = this.getQueue('domain-events');
    await queue.add(event.eventType, event, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async enqueueAgentTask(taskType: string, payload: Record<string, unknown>, correlationId: string): Promise<string> {
    const queue = this.getQueue('agent-tasks');
    const job = await queue.add(taskType, { taskType, payload, correlationId }, {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
    });
    return job.id ?? '';
  }

  async enqueueHITLExpiration(approvalId: string, delayMs: number): Promise<void> {
    const queue = this.getQueue('hitl-expiration');
    await queue.add('expire', { approvalId }, {
      delay: delayMs,
      removeOnComplete: true,
      attempts: 1,
    });
  }

  async enqueueEmail(to: string, subject: string, body: string): Promise<void> {
    const queue = this.getQueue('email-sending');
    await queue.add('send', { to, subject, body }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  createWorker(queueName: string, processor: (job: Job) => Promise<void>): Worker {
    return new Worker(queueName, processor, {
      connection: this.config.connection,
      concurrency: 5,
    });
  }

  async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}

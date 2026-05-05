import type { Job } from 'bullmq';
import { hitlApprovals } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { BullMQAdapter } from './BullMQAdapter.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';

export class HITLExpirationWorker {
  constructor(
    private readonly queueAdapter: BullMQAdapter,
    private readonly db: PostgresJsDatabase<typeof schema>
  ) {}

  start() {
    this.queueAdapter.createWorker('hitl-expiration', async (job: Job<{ approvalId: string }>) => {
      const { approvalId } = job.data;
      console.info(`[HITLExpirationWorker] Processing HITL expiration check for ${approvalId}`);

      // Check if it is still PENDING
      const [approval] = await this.db
        .select()
        .from(hitlApprovals)
        .where(
          and(
            eq(hitlApprovals.id, approvalId),
            eq(hitlApprovals.status, 'PENDING')
          )
        )
        .limit(1);

      if (!approval) {
        console.debug(`[HITLExpirationWorker] Approval ${approvalId} not found or already processed. Skipping.`);
        return;
      }

      // Automatically reject
      await this.db
        .update(hitlApprovals)
        .set({ status: 'REJECTED', decidedAt: new Date() })
        .where(eq(hitlApprovals.id, approvalId));

      console.info(`[HITLExpirationWorker] HITL approval ${approvalId} automatically REJECTED due to timeout.`);
      
      // TODO: Here we could dispatch a domain event (HITLRejectedEvent) 
      // so the respective Agent/Workflow knows it timed out.
    });
    
    console.info('[HITLExpirationWorker] Started listening to hitl-expiration queue');
  }
}

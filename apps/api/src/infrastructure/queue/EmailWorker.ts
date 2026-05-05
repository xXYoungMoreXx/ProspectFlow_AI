import type { Job } from 'bullmq';
import type { BullMQAdapter } from './BullMQAdapter.js';
import type { EmailAdapter } from '../messaging/EmailAdapter.js';

/**
 * EmailWorker — Processes email-sending queue jobs.
 *
 * Consumes jobs from the `email-sending` queue and delegates
 * to the EmailAdapter (Brevo/SMTP) for actual delivery.
 * Includes basic retry and error handling via BullMQ's built-in
 * backoff strategy (exponential, 3 attempts).
 */
export class EmailWorker {
  constructor(
    private readonly queue: BullMQAdapter,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  start(): void {
    this.queue.createWorker('email-sending', (job: Job) => this.processEmail(job));
    console.info('[EmailWorker] Worker started on queue: email-sending');
  }

  private async processEmail(job: Job): Promise<void> {
    const { to, subject, body } = job.data as {
      to: string;
      subject: string;
      body: string;
    };

    if (!to || !subject) {
      throw new Error('Email job missing required fields: to, subject');
    }

    const startTime = performance.now();

    try {
      await this.emailAdapter.sendEmail({
        to: [{ email: to }],
        subject,
        htmlContent: body,
      });
      const durationMs = Math.round(performance.now() - startTime);
      console.info(`[EmailWorker] Email sent to=${to} subject="${subject}" duration=${durationMs}ms`);
    } catch (error: any) {
      console.error(`[EmailWorker] Failed to send email to=${to}:`, error.message);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }
}

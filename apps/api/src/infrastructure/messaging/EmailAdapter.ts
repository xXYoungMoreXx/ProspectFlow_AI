import { config } from '../../config.js';

export interface EmailPayload {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
}

/**
 * Email Adapter using Brevo (formerly Sendinblue) HTTP API.
 * Uses native Node.js fetch to avoid extra dependencies.
 */
export class EmailAdapter {
  private readonly BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

  private get headers(): Record<string, string> {
    if (!config.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured.');
    return {
      'accept': 'application/json',
      'api-key': config.BREVO_API_KEY,
      'content-type': 'application/json',
    };
  }

  /**
   * Sends a transactional email.
   */
  async sendEmail(payload: EmailPayload): Promise<{ messageId: string }> {
    const body = {
      sender: {
        email: config.EMAIL_FROM_ADDRESS,
        name: config.EMAIL_FROM_NAME,
      },
      to: payload.to,
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      textContent: payload.textContent,
      replyTo: payload.replyTo,
    };

    const response = await fetch(this.BREVO_API_URL, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Brevo API Error [${response.status}]: ${err}`);
    }

    const data = await response.json() as { messageId: string };
    return { messageId: data.messageId };
  }
}

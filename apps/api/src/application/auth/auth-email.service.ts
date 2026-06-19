import type { BullMQAdapter } from "../../infrastructure/queue/BullMQAdapter.js";
import { config } from "../../config.js";

export class AuthEmailService {
  constructor(private readonly queue: BullMQAdapter) {}

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${config.FRONTEND_URL}/verify-email?token=${token}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bem-vindo ao Hefesto, ${name}!</h2>
        <p>Por favor, verifique seu endereço de e-mail clicando no link abaixo:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verificar E-mail</a>
        </p>
        <p>Ou cole este link no seu navegador:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Se você não criou esta conta, pode ignorar este e-mail.</p>
      </div>
    `;

    await this.queue.enqueueEmail(
      email,
      "Verifique seu e-mail - Hefesto",
      htmlContent,
    );
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${config.FRONTEND_URL}/reset-password?token=${token}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Olá, ${name}!</h2>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Hefesto.</p>
        <p>Clique no link abaixo para criar uma nova senha:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Redefinir Senha</a>
        </p>
        <p>Ou cole este link no seu navegador:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Se você não solicitou isso, pode ignorar este e-mail. Este link expirará em 1 hora.</p>
      </div>
    `;

    await this.queue.enqueueEmail(
      email,
      "Redefinição de senha - Hefesto",
      htmlContent,
    );
  }
}

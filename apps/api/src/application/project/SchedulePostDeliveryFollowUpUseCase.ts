import type { BullMQAdapter } from "../../infrastructure/queue/BullMQAdapter.js";

export interface SchedulePostDeliveryFollowUpCommand {
  projectId: string;
  operatorId: string;
  correlationId: string;
  deliveredAt: Date;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class SchedulePostDeliveryFollowUpUseCase {
  constructor(private readonly queue: BullMQAdapter) {}

  async execute(command: SchedulePostDeliveryFollowUpCommand): Promise<void> {
    // Enqueue follow-up 7 dias — "Seu site está no ar há uma semana"
    await this.queue.enqueueAgentTaskDelayed(
      "closer.follow_up_delivery_7d",
      {
        projectId: command.projectId,
        operatorId: command.operatorId,
        message: "Seu site está no ar há uma semana! Tudo funcionando bem?",
      },
      command.correlationId,
      SEVEN_DAYS_MS,
    );

    // Enqueue pesquisa NPS 30 dias
    await this.queue.enqueueAgentTaskDelayed(
      "closer.follow_up_nps_30d",
      {
        projectId: command.projectId,
        operatorId: command.operatorId,
        message:
          "Olá! Seu site está no ar há um mês. Em uma escala de 0 a 10, quanto você nos recomendaria?",
      },
      command.correlationId,
      THIRTY_DAYS_MS,
    );
  }
}

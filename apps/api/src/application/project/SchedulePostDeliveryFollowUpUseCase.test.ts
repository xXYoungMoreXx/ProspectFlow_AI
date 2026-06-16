import { describe, it, expect, vi } from "vitest";
import { SchedulePostDeliveryFollowUpUseCase } from "../../../src/application/project/SchedulePostDeliveryFollowUpUseCase.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe("SchedulePostDeliveryFollowUpUseCase", () => {
  it("enfileira follow-up 7d e NPS 30d com delays corretos", async () => {
    const mockQueue = {
      enqueueAgentTaskDelayed: vi.fn().mockResolvedValue("job-id"),
    };

    const useCase = new SchedulePostDeliveryFollowUpUseCase(mockQueue as any);

    await useCase.execute({
      projectId: "proj-1",
      operatorId: "op-1",
      correlationId: "corr-1",
      deliveredAt: new Date("2026-07-01T10:00:00Z"),
    });

    expect(mockQueue.enqueueAgentTaskDelayed).toHaveBeenCalledTimes(2);

    const calls = mockQueue.enqueueAgentTaskDelayed.mock.calls;
    expect(calls[0]![0]).toBe("closer.follow_up_delivery_7d");
    expect(calls[0]![2]).toBe("corr-1");
    expect(calls[0]![3]).toBe(SEVEN_DAYS_MS);

    expect(calls[1]![0]).toBe("closer.follow_up_nps_30d");
    expect(calls[1]![2]).toBe("corr-1");
    expect(calls[1]![3]).toBe(THIRTY_DAYS_MS);
  });
});

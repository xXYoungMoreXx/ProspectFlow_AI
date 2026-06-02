import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import {
  NotFoundError,
  ValidationError,
  DomainError,
} from "../../domain/shared/Result.js";
import { type Result, ok, err } from "../../domain/shared/Result.js";
import type { Redis } from "ioredis";

export interface ExtractBriefingCommand {
  briefingId: string;
  operatorId: string;
  correlationId: string;
}

export interface ExtractBriefingResult {
  briefingId: string;
  transcript: string;
}

export class ExtractBriefingUseCase {
  constructor(
    private readonly repo: BriefingRepository,
    private readonly redis: Redis,
  ) {}

  async execute(
    cmd: ExtractBriefingCommand,
  ): Promise<Result<ExtractBriefingResult, Error>> {
    const briefing = await this.repo.findById(cmd.briefingId, cmd.operatorId);
    if (!briefing) {
      return err(new NotFoundError("Briefing", cmd.briefingId));
    }

    if (briefing.status !== "IN_PROGRESS") {
      return err(
        new DomainError(
          "INVALID_STATE",
          `Cannot extract: briefing status is ${briefing.status}, expected IN_PROGRESS`,
        ),
      );
    }

    const rawEntries = await this.redis.lrange(
      `whatsapp:transcript:${cmd.briefingId}`,
      0,
      -1,
    );

    if (rawEntries.length === 0) {
      return err(
        new ValidationError("No transcript found in Redis for this briefing"),
      );
    }

    const transcript = rawEntries
      .map((raw: string) => {
        try {
          const parsed = JSON.parse(raw) as {
            from: string;
            body: string;
            timestamp: string;
          };
          return `[${parsed.timestamp}] ${parsed.from}: ${parsed.body}`;
        } catch {
          return raw;
        }
      })
      .join("\n");

    return ok({ briefingId: cmd.briefingId, transcript });
  }
}

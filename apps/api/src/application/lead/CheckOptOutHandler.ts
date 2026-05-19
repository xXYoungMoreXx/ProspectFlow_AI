import { ok, type Result } from "../../domain/shared/Result.js";
import type { OptOutRepository } from "../../domain/lead/OptOutRepository.js";
import { createHash } from "crypto";

export class CheckOptOutHandler {
  constructor(private readonly optOutRepository: OptOutRepository) {}

  async execute(input: {
    operatorId: string;
    phoneRaw?: string;
    emailRaw?: string;
  }): Promise<Result<boolean, Error>> {
    const phoneHash = input.phoneRaw
      ? createHash("sha256").update(input.phoneRaw).digest("hex")
      : undefined;
    const emailHash = input.emailRaw
      ? createHash("sha256").update(input.emailRaw).digest("hex")
      : undefined;

    const isBlocked = await this.optOutRepository.isBlocked(
      input.operatorId,
      phoneHash,
      emailHash,
    );

    return ok(isBlocked);
  }
}

import * as jose from "jose";
import {
  ValidationError,
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import { ContractAcceptance } from "../../domain/deal/ContractAcceptance.js";
import type { ContractAcceptanceRepository } from "../../domain/deal/ContractAcceptanceRepository.js";
import type { DealRepository } from "../../domain/deal/DealRepository.js";

export class RecordContractAcceptanceHandler {
  constructor(
    private readonly acceptanceRepository: ContractAcceptanceRepository,
    private readonly dealRepository: DealRepository,
    private readonly jwtSecret: string,
  ) {}

  async execute(input: {
    token: string;
    dealId: string;
    ipRaw: string;
    userAgent: string;
    sessionId: string;
    contractText: string;
  }): Promise<Result<void, ValidationError | NotFoundError>> {
    try {
      // 1. Validate JWT
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jose.jwtVerify(input.token, secret);

      if (payload["dealId"] !== input.dealId) {
        return err(new ValidationError("Token does not match dealId"));
      }

      // 2. Check Idempotency (VULN-001)
      const existing = await this.acceptanceRepository.findByDealId(
        input.dealId,
      );
      if (existing) {
        return err(new ValidationError("Deal already accepted"));
      }

      // 3. Validate Deal Status (VULN-002)
      // Since this is a public route via token, we use an internal find method
      const deal = await this.dealRepository.findByIdInternal(input.dealId);
      if (!deal) return err(new NotFoundError("Deal", input.dealId));

      if (deal.status !== "PROPOSED" && deal.status !== "NEGOTIATING") {
        return err(
          new ValidationError(`Invalid deal status for acceptance: ${deal.status}`),
        );
      }

      // 4. Create Acceptance Domain Object
      const id = crypto.randomUUID();
      const acceptanceResult = ContractAcceptance.recordAcceptance({
        id,
        dealId: input.dealId,
        ipRaw: input.ipRaw,
        userAgent: input.userAgent,
        sessionId: input.sessionId,
        contractText: input.contractText,
      });

      if (acceptanceResult.isErr()) {
        return err(acceptanceResult.error);
      }

      const acceptance = acceptanceResult.value;

      // 5. Verify contract hash matches what was in the token
      if (acceptance.contractHash !== payload["contractHash"]) {
        return err(
          new ValidationError(
            "Contract text does not match the proposal signed hash",
          ),
        );
      }

      // 6. Transition Deal State & Save (Atomic via Domain)
      const closeResult = deal.close();
      if (closeResult.isErr()) return err(closeResult.error);

      // 7. Save both to Persistence
      await this.dealRepository.save(deal);
      await this.acceptanceRepository.save(acceptance);

      return ok(undefined);
    } catch (e) {
      if (e instanceof jose.errors.JWTExpired) {
        return err(
          new ValidationError(
            "Proposal link has expired. Please request a new one.",
          ),
        );
      }
      return err(
        new ValidationError(
          `Failed to record acceptance: ${(e as Error).message}`,
        ),
      );
    }
  }
}

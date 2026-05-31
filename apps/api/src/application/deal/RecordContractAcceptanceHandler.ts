import * as jose from "jose";
import {
  ValidationError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import { ContractAcceptance } from "../../domain/deal/ContractAcceptance.js";
import type { ContractAcceptanceRepository } from "../../domain/deal/ContractAcceptanceRepository.js";

export class RecordContractAcceptanceHandler {
  constructor(
    private readonly acceptanceRepository: ContractAcceptanceRepository,
    private readonly jwtSecret: string,
  ) {}

  async execute(input: {
    token: string;
    dealId: string;
    ipRaw: string;
    userAgent: string;
    sessionId: string;
    contractText: string;
  }): Promise<Result<void, ValidationError>> {
    try {
      // 0. Check for existing acceptance (Idempotency/Replay Prevention)
      const existing = await this.acceptanceRepository.findByDealId(
        input.dealId,
      );
      if (existing) {
        return err(new ValidationError("This deal has already been accepted."));
      }

      // 1. Validate JWT
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jose.jwtVerify(input.token, secret);

      if (payload["dealId"] !== input.dealId) {
        return err(new ValidationError("Token does not match dealId"));
      }

      // 2. Create Acceptance Domain Object
      // Using a random UUID since the route handler isn't generating it, or we could pass one
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

      // 3. Verify contract hash matches what was in the token
      if (acceptance.contractHash !== payload["contractHash"]) {
        return err(
          new ValidationError(
            "Contract text does not match the proposal signed hash",
          ),
        );
      }

      // 4. Save to Repository (Append Only)
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
      // VULN-007: Sanitize error message to prevent leaking sensitive input in logs
      // if this error is subsequently logged by the global handler.
      return err(new ValidationError("Failed to record acceptance"));
    }
  }
}

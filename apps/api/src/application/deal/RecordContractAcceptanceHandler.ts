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
      // 1. Validate JWT
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jose.jwtVerify(input.token, secret);

      if (payload["dealId"] !== input.dealId) {
        return err(new ValidationError("Token does not match dealId"));
      }

      // 1.5 Payload Size Check (Defense in Depth)
      if (input.contractText.length > 100000) {
        return err(new ValidationError("Contract text is too large (max 100k)"));
      }

      // 2. Idempotency Check
      const existing = await this.acceptanceRepository.findByDealId(input.dealId);
      if (existing) {
        return err(new ValidationError("This deal has already been accepted."));
      }

      // 3. Create Acceptance Domain Object
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
      return err(
        new ValidationError(
          `Failed to record acceptance: ${(e as Error).message}`,
        ),
      );
    }
  }
}

import * as jose from "jose";
import {
  ValidationError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";

export class GenerateProposalLinkHandler {
  constructor(
    private readonly jwtSecret: string,
    private readonly baseUrl: string,
  ) {}

  async execute(input: {
    dealId: string;
    contractHash: string;
  }): Promise<Result<string, ValidationError>> {
    if (!input.dealId) return err(new ValidationError("dealId is required"));
    if (!input.contractHash)
      return err(new ValidationError("contractHash is required"));

    try {
      const secret = new TextEncoder().encode(this.jwtSecret);

      const jwt = await new jose.SignJWT({
        dealId: input.dealId,
        contractHash: input.contractHash,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("48h")
        .sign(secret);

      const url = `${this.baseUrl}/deals/${input.dealId}/proposal?token=${jwt}`;

      return ok(url);
    } catch (e) {
      return err(
        new ValidationError(
          `Failed to generate proposal link: ${(e as Error).message}`,
        ),
      );
    }
  }
}

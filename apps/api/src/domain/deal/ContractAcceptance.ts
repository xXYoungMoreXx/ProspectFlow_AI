import { createHash } from "crypto";
import { ValidationError, ok, err, type Result } from "../shared/Result.js";

export interface ContractAcceptanceProps {
  id: string;
  dealId: string;
  contractHash: string;
  acceptedAt: Date;
  ipHash: string;
  userAgentHash: string;
  sessionId: string;
  createdAt: Date;
}

export class ContractAcceptance {
  private constructor(private readonly props: ContractAcceptanceProps) {}

  /**
   * Reconstitutes an existing ContractAcceptance from persistence.
   */
  static reconstitute(props: ContractAcceptanceProps): ContractAcceptance {
    return new ContractAcceptance(props);
  }

  /**
   * Records a new contract acceptance, hashing PII data securely.
   */
  static recordAcceptance(input: {
    id: string;
    dealId: string;
    ipRaw: string;
    userAgent: string;
    sessionId: string;
    contractText: string;
  }): Result<ContractAcceptance, ValidationError> {
    if (!input.dealId) return err(new ValidationError("dealId is required"));
    if (!input.contractText)
      return err(new ValidationError("contractText is required"));

    const contractHash = createHash("sha256")
      .update(input.contractText)
      .digest("hex");
    const ipHash = createHash("sha256").update(input.ipRaw).digest("hex");
    const userAgentHash = createHash("sha256")
      .update(input.userAgent)
      .digest("hex");

    const now = new Date();

    return ok(
      new ContractAcceptance({
        id: input.id,
        dealId: input.dealId,
        contractHash,
        ipHash,
        userAgentHash,
        sessionId: input.sessionId,
        acceptedAt: now,
        createdAt: now,
      }),
    );
  }

  get id(): string {
    return this.props.id;
  }
  get dealId(): string {
    return this.props.dealId;
  }
  get contractHash(): string {
    return this.props.contractHash;
  }
  get acceptedAt(): Date {
    return this.props.acceptedAt;
  }
  get ipHash(): string {
    return this.props.ipHash;
  }
  get userAgentHash(): string {
    return this.props.userAgentHash;
  }
  get sessionId(): string {
    return this.props.sessionId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON() {
    return { ...this.props };
  }
}

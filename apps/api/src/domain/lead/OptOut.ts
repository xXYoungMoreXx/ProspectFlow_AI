import { createHash } from "crypto";
import { ValidationError, ok, err, type Result } from "../shared/Result.js";

export interface OptOutProps {
  id: string;
  operatorId: string;
  phoneHash: string | null;
  emailHash: string | null;
  optedOutAt: Date;
}

export class OptOut {
  private constructor(private readonly props: OptOutProps) {}

  static reconstitute(props: OptOutProps): OptOut {
    return new OptOut(props);
  }

  static addToBlocklist(input: {
    id: string;
    operatorId: string;
    phoneRaw?: string;
    emailRaw?: string;
  }): Result<OptOut, ValidationError> {
    if (!input.phoneRaw && !input.emailRaw) {
      return err(
        new ValidationError(
          "At least one of phone or email must be provided to opt out",
        ),
      );
    }

    const phoneHash = input.phoneRaw
      ? createHash("sha256").update(input.phoneRaw).digest("hex")
      : null;
    const emailHash = input.emailRaw
      ? createHash("sha256").update(input.emailRaw).digest("hex")
      : null;

    return ok(
      new OptOut({
        id: input.id,
        operatorId: input.operatorId,
        phoneHash,
        emailHash,
        optedOutAt: new Date(),
      }),
    );
  }

  get id(): string {
    return this.props.id;
  }
  get operatorId(): string {
    return this.props.operatorId;
  }
  get phoneHash(): string | null {
    return this.props.phoneHash;
  }
  get emailHash(): string | null {
    return this.props.emailHash;
  }
  get optedOutAt(): Date {
    return this.props.optedOutAt;
  }

  toJSON() {
    return { ...this.props };
  }
}

import { eq, and, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import { OptOut } from "../../../domain/lead/OptOut.js";
import type { OptOutRepository } from "../../../domain/lead/OptOutRepository.js";

export class DrizzleOptOutRepository implements OptOutRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async save(optOut: OptOut): Promise<void> {
    const json = optOut.toJSON();

    await this.db
      .insert(schema.prospectOptouts)
      .values({
        id: json.id,
        operatorId: json.operatorId,
        phoneHash: json.phoneHash,
        emailHash: json.emailHash,
        optedOutAt: json.optedOutAt,
      })
      .onConflictDoNothing(); // OptOut may already exist, ignore duplicates
  }

  async isBlocked(
    operatorId: string,
    phoneHash?: string,
    emailHash?: string,
  ): Promise<boolean> {
    if (!phoneHash && !emailHash) return false;

    const conditions = [];
    if (phoneHash)
      conditions.push(eq(schema.prospectOptouts.phoneHash, phoneHash));
    if (emailHash)
      conditions.push(eq(schema.prospectOptouts.emailHash, emailHash));

    const [row] = await this.db
      .select({ id: schema.prospectOptouts.id })
      .from(schema.prospectOptouts)
      .where(
        and(
          eq(schema.prospectOptouts.operatorId, operatorId),
          or(...conditions),
        ),
      )
      .limit(1);

    return !!row;
  }
}

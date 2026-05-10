import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema.js';
import { ContractAcceptance, type ContractAcceptanceProps } from '../../../domain/deal/ContractAcceptance.js';
import type { ContractAcceptanceRepository } from '../../../domain/deal/ContractAcceptanceRepository.js';

export class DrizzleContractAcceptanceRepository implements ContractAcceptanceRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async save(acceptance: ContractAcceptance): Promise<void> {
    const json = acceptance.toJSON();

    await this.db.insert(schema.contractAcceptances).values({
      id: json.id,
      dealId: json.dealId,
      contractHash: json.contractHash,
      acceptedAt: json.acceptedAt,
      ipHash: json.ipHash,
      userAgentHash: json.userAgentHash,
      sessionId: json.sessionId,
      createdAt: json.createdAt,
    });
    // Deliberately not using onConflictDoUpdate to enforce append-only
  }

  async findByDealId(dealId: string): Promise<ContractAcceptance | null> {
    const [row] = await this.db
      .select()
      .from(schema.contractAcceptances)
      .where(eq(schema.contractAcceptances.dealId, dealId))
      .limit(1);

    if (!row) return null;

    const props: ContractAcceptanceProps = {
      id: row.id,
      dealId: row.dealId,
      contractHash: row.contractHash,
      acceptedAt: row.acceptedAt,
      ipHash: row.ipHash,
      userAgentHash: row.userAgentHash,
      sessionId: row.sessionId,
      createdAt: row.createdAt,
    };

    return ContractAcceptance.reconstitute(props);
  }
}

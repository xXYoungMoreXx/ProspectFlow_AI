import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import { SettingsCrypto } from "../../secrets/SettingsCrypto.js";

export type SettingCategory =
  | "llm_providers"
  | "messaging"
  | "integrations"
  | "system";

export interface SettingEntry {
  id: string;
  operatorId: string;
  category: SettingCategory;
  key: string;
  value: string;
  isSecret: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSettingInput {
  key: string;
  value: string;
  category: SettingCategory;
  isSecret?: boolean;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export class DrizzleSettingsRepository {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly crypto: SettingsCrypto,
  ) {}

  async upsert(operatorId: string, input: UpsertSettingInput): Promise<SettingEntry> {
    const valueToStore = input.isSecret
      ? this.crypto.encrypt(input.value)
      : input.value;

    const [row] = await this.db
      .insert(schema.systemSettings)
      .values({
        operatorId,
        category: input.category,
        key: input.key,
        value: valueToStore,
        isSecret: input.isSecret ?? false,
        isActive: input.isActive ?? true,
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [schema.systemSettings.operatorId, schema.systemSettings.key],
        set: {
          value: valueToStore,
          category: input.category,
          isSecret: input.isSecret ?? false,
          isActive: input.isActive ?? true,
          metadata: input.metadata ?? {},
          updatedAt: new Date(),
        },
      })
      .returning();

    return this.toEntry(row!);
  }

  async upsertBatch(
    operatorId: string,
    inputs: UpsertSettingInput[],
  ): Promise<SettingEntry[]> {
    const results: SettingEntry[] = [];
    for (const input of inputs) {
      const entry = await this.upsert(operatorId, input);
      results.push(entry);
    }
    return results;
  }

  async getByKey(
    operatorId: string,
    key: string,
  ): Promise<SettingEntry | null> {
    const rows = await this.db
      .select()
      .from(schema.systemSettings)
      .where(
        and(
          eq(schema.systemSettings.operatorId, operatorId),
          eq(schema.systemSettings.key, key),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toEntry(row);
  }

  /**
   * Get the raw decrypted value — used internally by CompositeSecretsProvider.
   * Never expose this through the API.
   */
  async getDecryptedValue(
    operatorId: string,
    key: string,
  ): Promise<string | undefined> {
    const rows = await this.db
      .select()
      .from(schema.systemSettings)
      .where(
        and(
          eq(schema.systemSettings.operatorId, operatorId),
          eq(schema.systemSettings.key, key),
          eq(schema.systemSettings.isActive, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) return undefined;

    const row = rows[0];
    if (!row) return undefined;
    return row.isSecret ? this.crypto.decrypt(row.value) : row.value;
  }

  /**
   * Get decrypted value without operator context — scans all operators.
   * Used by CompositeSecretsProvider for single-operator localhost mode.
   */
  async getDecryptedValueGlobal(key: string): Promise<string | undefined> {
    const rows = await this.db
      .select()
      .from(schema.systemSettings)
      .where(
        and(
          eq(schema.systemSettings.key, key),
          eq(schema.systemSettings.isActive, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) return undefined;

    const row = rows[0];
    if (!row) return undefined;
    return row.isSecret ? this.crypto.decrypt(row.value) : row.value;
  }

  async listByCategory(
    operatorId: string,
    category: SettingCategory,
  ): Promise<SettingEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.systemSettings)
      .where(
        and(
          eq(schema.systemSettings.operatorId, operatorId),
          eq(schema.systemSettings.category, category),
        ),
      )
      .orderBy(schema.systemSettings.key);

    return rows.map((r) => this.toEntry(r));
  }

  async listAll(operatorId: string): Promise<SettingEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.operatorId, operatorId))
      .orderBy(schema.systemSettings.category, schema.systemSettings.key);

    return rows.map((r) => this.toEntry(r));
  }

  async deleteByKey(operatorId: string, key: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.systemSettings)
      .where(
        and(
          eq(schema.systemSettings.operatorId, operatorId),
          eq(schema.systemSettings.key, key),
        ),
      )
      .returning();

    return result.length > 0;
  }

  private toEntry(row: typeof schema.systemSettings.$inferSelect): SettingEntry {
    return {
      id: row.id,
      operatorId: row.operatorId,
      category: row.category,
      key: row.key,
      // Secrets are masked in the entry — use getDecryptedValue() for raw value
      value: row.isSecret
        ? SettingsCrypto.mask(this.crypto.decrypt(row.value))
        : row.value,
      isSecret: row.isSecret,
      isActive: row.isActive,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

import { DrizzleSettingsRepository } from "../db/repositories/DrizzleSettingsRepository.js";

export interface SecretsProvider {
  getSecret(operatorId: string, key: string): Promise<string | undefined>;
  getSecretGlobal(key: string): Promise<string | undefined>;
  get(operatorId: string, key: string): Promise<string>;
  get(key: string): Promise<string>;
  getOptional(operatorId: string, key: string): Promise<string | undefined>;
  getOptional(key: string): Promise<string | undefined>;
  invalidate(operatorId: string, key: string): void;
  invalidate(key: string): void;
}

export class CompositeSecretsProvider implements SecretsProvider {
  private cache = new Map<string, string>();

  constructor(private readonly settingsRepo: DrizzleSettingsRepository) {}

  async getSecret(operatorId: string, key: string): Promise<string | undefined> {
    const cacheKey = `${operatorId}:${key}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const envValue = process.env[key.toUpperCase()];
    if (envValue) {
      this.cache.set(cacheKey, envValue);
      return envValue;
    }

    const dbValue = await this.settingsRepo.getDecryptedValue(operatorId, key);
    if (dbValue) {
      this.cache.set(cacheKey, dbValue);
    }
    return dbValue;
  }

  async getSecretGlobal(key: string): Promise<string | undefined> {
    const envValue = process.env[key.toUpperCase()];
    if (envValue) return envValue;

    return this.settingsRepo.getDecryptedValueGlobal(key);
  }

  async get(operatorIdOrKey: string, key?: string): Promise<string> {
    let val: string | undefined;
    if (key) {
      val = await this.getSecret(operatorIdOrKey, key);
    } else {
      val = await this.getSecretGlobal(operatorIdOrKey);
    }
    if (!val) throw new Error(`Secret not found`);
    return val;
  }

  async getOptional(operatorIdOrKey: string, key?: string): Promise<string | undefined> {
    if (key) {
      return this.getSecret(operatorIdOrKey, key);
    } else {
      return this.getSecretGlobal(operatorIdOrKey);
    }
  }

  invalidate(operatorIdOrKey: string, key?: string): void {
    if (key) {
      this.cache.delete(`${operatorIdOrKey}:${key}`);
    } else {
      for (const k of this.cache.keys()) {
        if (k.endsWith(`:${operatorIdOrKey}`)) {
          this.cache.delete(k);
        }
      }
    }
  }
}

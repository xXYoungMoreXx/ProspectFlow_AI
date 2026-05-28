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

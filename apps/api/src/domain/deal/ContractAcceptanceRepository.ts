import type { ContractAcceptance } from './ContractAcceptance.js';

export interface ContractAcceptanceRepository {
  /**
   * Saves a new ContractAcceptance. This is an append-only operation.
   */
  save(acceptance: ContractAcceptance): Promise<void>;
  
  /**
   * Retrieves an acceptance by deal ID.
   */
  findByDealId(dealId: string): Promise<ContractAcceptance | null>;
}

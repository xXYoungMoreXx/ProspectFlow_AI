import type { OptOut } from './OptOut.js';

export interface OptOutRepository {
  /**
   * Saves a new OptOut record.
   */
  save(optOut: OptOut): Promise<void>;
  
  /**
   * Checks if a specific phone or email is opted out for the given operator.
   */
  isBlocked(operatorId: string, phoneHash?: string, emailHash?: string): Promise<boolean>;
}

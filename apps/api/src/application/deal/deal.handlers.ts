import type { DealRepository, DealFilters, DealListResult } from '../../domain/deal/DealRepository.js';
import { NotFoundError, ok, err, type Result } from '../../domain/shared/Result.js';
import type { Deal } from '../../domain/deal/Deal.js';

export class GetDealsHandler {
  constructor(private readonly repo: DealRepository) {}

  async execute(filters: DealFilters): Promise<DealListResult> {
    return this.repo.findMany(filters);
  }
}

export class GetDealByIdHandler {
  constructor(private readonly repo: DealRepository) {}

  async execute(dealId: string, operatorId: string): Promise<Result<Deal, NotFoundError>> {
    const deal = await this.repo.findById(dealId, operatorId);
    if (!deal) return err(new NotFoundError('Deal', dealId));
    return ok(deal);
  }
}

export class CancelDealHandler {
  constructor(private readonly repo: DealRepository) {}

  async execute(dealId: string, operatorId: string, reason: string): Promise<Result<Deal, Error>> {
    const deal = await this.repo.findById(dealId, operatorId);
    if (!deal) return err(new NotFoundError('Deal', dealId));

    const result = deal.cancel(reason);
    if (result.isErr()) return result;

    await this.repo.save(deal);
    return ok(deal);
  }
}

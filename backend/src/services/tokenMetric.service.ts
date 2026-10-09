import { TokenMetric, TokenMetricCreationAttributes } from '../models/TokenMetric';

export class TokenMetricService {
  public async logMetric(data: TokenMetricCreationAttributes): Promise<TokenMetric> {
    return TokenMetric.create(data);
  }

  public async getSummary(): Promise<any> {
    const totalTokensConsumed = await TokenMetric.sum('tokensConsumed');
    const totalTokensSaved = await TokenMetric.sum('tokensSaved');
    const totalRequests = await TokenMetric.count();

    return {
      totalRequests,
      totalTokensConsumed: totalTokensConsumed || 0,
      totalTokensSaved: totalTokensSaved || 0,
    };
  }

  public async getRecentMetrics(limit = 100): Promise<TokenMetric[]> {
    return TokenMetric.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}

export const tokenMetricService = new TokenMetricService();

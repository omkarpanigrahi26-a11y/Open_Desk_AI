import { Op } from 'sequelize';
import { TokenMetric, TierType } from '../../models/TokenMetric';
import { tier1LightService, Tier1ExecutionResult } from './tier1Light.service';
import { tier2ModerateService, Tier2ExecutionResult } from './tier2Moderate.service';
import { tier3ComplexService, Tier3ExecutionResult } from './tier3Complex.service';

export interface DispatchResponse {
  query: string;
  tierUsed: TierType;
  tokensConsumed: number;
  tokensSaved: number;
  latencyMs: number;
  result: Tier1ExecutionResult | Tier2ExecutionResult | Tier3ExecutionResult;
  metricId?: string;
}

export interface SavingsMetrics {
  totalTokensSavedToday: number;
  totalTokensConsumedToday: number;
  allTimeTokensSaved: number;
  allTimeTokensConsumed: number;
  percentageSaved: number;
  estimatedUsdSavings: number;
  tierDistribution: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

export class ClassifierService {
  // Standard cloud reasoning cost baseline ($3.00 per 1M tokens)
  private readonly costPerMillionTokensUsd = 3.00;

  /**
   * Deterministically inspects prompt text to classify into Tier 1, Tier 2, or Tier 3.
   */
  public classifyQuery(query: string): TierType {
    const q = query.trim().toLowerCase();

    // 1. Tier 1: OS Operations & Hardware Telemetry (Deterministic)
    const isTier1 =
      /\b(?:kill|terminate|stop)\s+(?:process\s+|pid\s+)?\d+\b/i.test(q) ||
      /\b(?:check|show|get|view|display)?\s*\b(?:cpu|ram|memory|hardware)\b(?:\s+(?:stats|load|usage|metrics))?|\bsystem\s+(?:stats|load|usage|metrics|telemetry|info)\b/i.test(q) ||
      /\b(?:open|explore)\s+(?:directory|folder|dir)\b/i.test(q) ||
      /\b(?:make|create|new|mkdir)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory|dir)\b/i.test(q) ||
      /^(?:search\s+and\s+|find\s+and\s+)?(?:launch|start|open|run)\s+[a-z0-9_.-]+$/i.test(q) ||
      /\b(?:find|search|locate)\s+file\s+/i.test(q);

    if (isTier1) {
      return 'Tier 1';
    }

    // 2. Tier 2: Offline contextual queries (Local Ollama)
    const isTier2 =
      q.includes('summarize') ||
      q.includes('parse log') ||
      q.includes('extract errors') ||
      q.includes('inspect ast') ||
      q.includes('memory leak analysis') ||
      q.includes('explain function') ||
      q.includes('find bugs in log');

    if (isTier2) {
      return 'Tier 2';
    }

    // 3. Tier 3: Complex Multi-file refactoring, algorithms, architectural patches
    return 'Tier 3';
  }

  /**
   * Estimates baseline tokens that would have been charged by a cloud reasoning LLM.
   */
  private estimateCloudBaselineTokens(query: string, outputLength = 250): number {
    const promptTokens = Math.ceil(query.length / 3.8);
    const completionTokens = Math.ceil(outputLength / 3.8);
    return Math.max(120, promptTokens + completionTokens);
  }

  /**
   * Dispatches the query to the designated tier, records token metrics, and persists to MySQL.
   */
  public async dispatch(
    query: string,
    options?: {
      apiKey?: string;
      aiProvider?: string;
      model?: string;
      ollamaUrl?: string;
      ownerName?: string;
    }
  ): Promise<DispatchResponse> {
    const tier = this.classifyQuery(query);
    let executionResult: Tier1ExecutionResult | Tier2ExecutionResult | Tier3ExecutionResult;
    let tokensConsumed = 0;
    let tokensSaved = 0;
    let latencyMs = 0;

    switch (tier) {
      case 'Tier 1': {
        const res = await tier1LightService.execute(query);
        executionResult = res;
        tokensConsumed = 0;
        tokensSaved = this.estimateCloudBaselineTokens(query, res.output.length);
        latencyMs = res.latencyMs;
        break;
      }

      case 'Tier 2': {
        const res = await tier2ModerateService.execute(query);
        if (res.success) {
          executionResult = res;
          tokensConsumed = res.tokensConsumed;
          tokensSaved = this.estimateCloudBaselineTokens(query, res.response.length);
          latencyMs = res.latencyMs;
        } else {
          // If local Ollama is offline or unavailable, seamlessly fallback to Tier 3 companion
          const fallbackRes = await tier3ComplexService.execute(query, options);
          executionResult = fallbackRes;
          tokensConsumed = fallbackRes.tokensConsumed;
          tokensSaved = this.estimateCloudBaselineTokens(query, fallbackRes.response.length);
          latencyMs = fallbackRes.latencyMs;
        }
        break;
      }

      case 'Tier 3':
      default: {
        const res = await tier3ComplexService.execute(query, options);
        executionResult = res;
        tokensConsumed = res.tokensConsumed;
        tokensSaved = 0;
        latencyMs = res.latencyMs;
        break;
      }
    }

    // Persist to MySQL via Sequelize
    let metricRecord: TokenMetric | null = null;
    try {
      metricRecord = await TokenMetric.create({
        query,
        tierUsed: tier,
        tokensConsumed,
        tokensSaved,
        latencyMs,
      });
    } catch (dbError: any) {
      console.warn('[ClassifierService] Failed to persist TokenMetric to MySQL:', dbError.message || dbError);
    }

    return {
      query,
      tierUsed: tier,
      tokensConsumed,
      tokensSaved,
      latencyMs,
      result: executionResult,
      metricId: metricRecord?.id,
    };
  }

  /**
   * Computes dynamic aggregated savings metrics from MySQL.
   */
  public async getSavingsMetrics(): Promise<SavingsMetrics> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayRecords, allRecords] = await Promise.all([
      TokenMetric.findAll({
        where: {
          createdAt: {
            [Op.gte]: startOfDay,
          },
        },
      }),
      TokenMetric.findAll({
        attributes: ['tierUsed', 'tokensConsumed', 'tokensSaved'],
      }),
    ]);

    const totalTokensSavedToday = todayRecords.reduce((acc, r) => acc + (r.tokensSaved || 0), 0);
    const totalTokensConsumedToday = todayRecords.reduce((acc, r) => acc + (r.tokensConsumed || 0), 0);

    const allTimeTokensSaved = allRecords.reduce((acc, r) => acc + (r.tokensSaved || 0), 0);
    const allTimeTokensConsumed = allRecords.reduce((acc, r) => acc + (r.tokensConsumed || 0), 0);

    const totalCalculated = allTimeTokensSaved + allTimeTokensConsumed;
    const percentageSaved = totalCalculated > 0
      ? Number(((allTimeTokensSaved / totalCalculated) * 100).toFixed(1))
      : 0;

    const estimatedUsdSavings = Number(
      ((allTimeTokensSaved / 1000000) * this.costPerMillionTokensUsd).toFixed(4)
    );

    const tierDistribution = {
      tier1: allRecords.filter((r) => r.tierUsed === 'Tier 1').length,
      tier2: allRecords.filter((r) => r.tierUsed === 'Tier 2').length,
      tier3: allRecords.filter((r) => r.tierUsed === 'Tier 3').length,
    };

    return {
      totalTokensSavedToday,
      totalTokensConsumedToday,
      allTimeTokensSaved,
      allTimeTokensConsumed,
      percentageSaved,
      estimatedUsdSavings,
      tierDistribution,
    };
  }
}

export const classifierService = new ClassifierService();

import { Request, Response } from 'express';
import { tokenMetricService } from '../services/tokenMetric.service';

export class TokenMetricController {
  public async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await tokenMetricService.getSummary();
      res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async getRecent(req: Request, res: Response): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 100;
      const metrics = await tokenMetricService.getRecentMetrics(limit);
      res.status(200).json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const { query, tierUsed, tokensConsumed, tokensSaved, latencyMs } = req.body;
      if (!query || !tierUsed) {
        res.status(400).json({ success: false, message: 'query and tierUsed are required' });
        return;
      }

      const metric = await tokenMetricService.logMetric({
        query,
        tierUsed,
        tokensConsumed: Number(tokensConsumed) || 0,
        tokensSaved: Number(tokensSaved) || 0,
        latencyMs: Number(latencyMs) || 0,
      });

      res.status(201).json({ success: true, data: metric });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const tokenMetricController = new TokenMetricController();

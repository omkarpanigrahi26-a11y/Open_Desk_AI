import { Request, Response } from 'express';
import { classifierService } from '../services/router/classifier.service';

export class DispatchController {
  /**
   * POST /api/dispatch
   * Routes query across the 3-Tier Multi-Agent architecture.
   */
  public async handleDispatch(req: Request, res: Response): Promise<void> {
    try {
      const { query, options } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({
          success: false,
          message: 'Field "query" is required as a non-empty string.',
        });
        return;
      }

      const response = await classifierService.dispatch(query.trim(), options);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      console.error('[DispatchController] Error processing dispatch:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during dispatch.',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dispatch/savings
   * Retrieves dynamic token economy savings metrics.
   */
  public async getSavingsMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await classifierService.getSavingsMetrics();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      console.error('[DispatchController] Error retrieving savings metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error retrieving metrics.',
        error: error.message,
      });
    }
  }
}

export const dispatchController = new DispatchController();

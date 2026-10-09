import { Request, Response } from 'express';
import { testConnection } from '../config/database';

export class HealthController {
  public async getHealth(req: Request, res: Response): Promise<void> {
    const isDbConnected = await testConnection();

    res.status(isDbConnected ? 200 : 503).json({
      status: isDbConnected ? 'healthy' : 'degraded',
      service: 'OpenDesk AI Backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        type: 'MySQL',
        connected: isDbConnected,
      },
    });
  }
}

export const healthController = new HealthController();

import { Request, Response } from 'express';
import { hardwareService } from '../services/telemetry/hardware.service';
import { windowService } from '../services/telemetry/window.service';

export class TelemetryController {
  public async getSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const [hardware, activeWindow] = await Promise.all([
        hardwareService.getHardwareSnapshot(),
        windowService.getActiveWindow(),
      ]);

      res.status(200).json({
        success: true,
        data: {
          hardware,
          activeWindow,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to capture telemetry snapshot',
        error: error.message,
      });
    }
  }

  public async getCpu(req: Request, res: Response): Promise<void> {
    try {
      const cpu = await hardwareService.getCpuMetrics();
      res.status(200).json({ success: true, data: cpu });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async getMemory(req: Request, res: Response): Promise<void> {
    try {
      const memory = await hardwareService.getMemoryMetrics();
      res.status(200).json({ success: true, data: memory });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async getProcesses(req: Request, res: Response): Promise<void> {
    try {
      const topProcesses = await hardwareService.getTopProcesses();
      res.status(200).json({ success: true, data: topProcesses });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async killProcess(req: Request, res: Response): Promise<void> {
    try {
      const pid = Number(req.params.pid);
      if (!pid) {
        res.status(400).json({ success: false, message: 'Valid process PID is required' });
        return;
      }

      const success = await hardwareService.killProcess(pid);
      if (success) {
        res.status(200).json({ success: true, message: `Process PID ${pid} terminated` });
      } else {
        res.status(400).json({ success: false, message: `Could not terminate process PID ${pid}` });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async getActiveWindow(req: Request, res: Response): Promise<void> {
    try {
      const windowContext = await windowService.getActiveWindow();
      res.status(200).json({ success: true, data: windowContext });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const telemetryController = new TelemetryController();

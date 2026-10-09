import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { hardwareService } from '../services/telemetry/hardware.service';
import { windowService } from '../services/telemetry/window.service';

export interface TelemetryPacket {
  type: 'TELEMETRY_UPDATE';
  timestamp: string;
  hardware: any;
  activeWindow: any;
}

export class TelemetryWebSocketManager {
  private wss: WebSocketServer | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isSampling = false;

  /**
   * Initializes the WebSocket server attached to the underlying HTTP server.
   */
  public initialize(server: HttpServer): WebSocketServer {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/telemetry',
    });

    this.wss.on('connection', (ws: WebSocket) => {
      // Send initial packet immediately upon connection
      this.sendSnapshotToClient(ws);

      // Start ticker if not already running
      this.ensureTickerRunning();

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.action === 'kill_process' && message.pid) {
            const success = await hardwareService.killProcess(Number(message.pid));
            ws.send(JSON.stringify({
              type: 'KILL_PROCESS_RESULT',
              pid: message.pid,
              success,
            }));
          }
        } catch {
          // Ignore invalid JSON payloads from clients
        }
      });

      ws.on('close', () => {
        if (this.wss && this.wss.clients.size === 0) {
          this.stopTicker();
        }
      });

      ws.on('error', () => {});
    });

    return this.wss;
  }

  private ensureTickerRunning(): void {
    if (!this.intervalTimer) {
      this.intervalTimer = setInterval(() => {
        this.broadcastMetrics();
      }, 500);
    }
  }

  private stopTicker(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async getTelemetryPayload(): Promise<TelemetryPacket> {
    const [hardware, activeWindow] = await Promise.all([
      hardwareService.getHardwareSnapshot(),
      windowService.getActiveWindow(),
    ]);

    return {
      type: 'TELEMETRY_UPDATE',
      timestamp: new Date().toISOString(),
      hardware,
      activeWindow,
    };
  }

  private async sendSnapshotToClient(ws: WebSocket): Promise<void> {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const payload = await this.getTelemetryPayload();
        ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error('[WebSocket] Error sending snapshot to client:', err);
      }
    }
  }

  private async broadcastMetrics(): Promise<void> {
    if (!this.wss || this.wss.clients.size === 0 || this.isSampling) {
      return;
    }

    this.isSampling = true;
    try {
      const payload = await this.getTelemetryPayload();
      const serialized = JSON.stringify(payload);

      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(serialized);
        }
      });
    } catch (err) {
      console.error('[WebSocket] Broadcast error:', err);
    } finally {
      this.isSampling = false;
    }
  }

  public close(): void {
    this.stopTicker();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const telemetrySocketManager = new TelemetryWebSocketManager();

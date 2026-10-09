import http from 'http';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables before any other imports
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

import app from './app';
import { ensureDatabaseExists, testConnection } from './config/database';
import { syncDatabase } from './models';
import { telemetrySocketManager } from './websocket/telemetrySocket';

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  // 1. Create HTTP server combining Express
  const server = http.createServer(app);

  // 2. Initialize Telemetry WebSocket attached to HTTP server
  telemetrySocketManager.initialize(server);

  // 3. Ensure MySQL database exists (creates it if missing, skips if present)
  await ensureDatabaseExists();

  // 4. Test connection via Sequelize
  const isConnected = await testConnection();

  // 5. Strict DB Sync from environment variable
  if (process.env.DB_SYNC === 'true') {
    if (isConnected) {
      try {
        await syncDatabase();
      } catch (syncError: any) {
        console.error('[Database] Model synchronization failed:', syncError.message || syncError);
      }
    }
  }

  // 6. Start listening on configured port
  server.listen(PORT, () => {
    console.log(`🚀 OpenDesk AI Server running on port ${PORT}`);
    console.log(`🔌 Telemetry WebSocket: ws://localhost:${PORT}/ws/telemetry`);
  });

  // Graceful shutdown
  const handleShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
    telemetrySocketManager.close();

    server.close(() => {
      console.log('[Server] HTTP and WebSocket listeners closed.');
      process.exit(0);
    });

    // Force exit if hanging
    setTimeout(() => {
      console.error('[Server] Forcing shutdown after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[Fatal] Unhandled exception during server bootstrap:', error);
  process.exit(1);
});

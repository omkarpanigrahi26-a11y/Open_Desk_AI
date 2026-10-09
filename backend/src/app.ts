import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes';

const app: Application = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount remaining application routes
app.use('/api', apiRoutes);

// Health endpoint for uptime monitors
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', name: 'OpenDesk AI API' });
});

// Serve frontend production build statically if available
const distPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // Single Page App fallback for HTML navigation
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
} else {
  // Root fallback when static build is not present
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', name: 'OpenDesk AI API' });
  });
}

// Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

export default app;


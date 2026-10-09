import { Request, Response } from 'express';
import { fileCrawlerService } from '../services/indexing/fileCrawler.service';

export class FilesController {
  /**
   * GET /api/files/search?q={query}&limit={10}
   */
  public async search(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.query.q as string) || '';
      const limit = Number(req.query.limit) || 10;

      const files = await fileCrawlerService.searchFiles(query, limit);

      res.status(200).json({
        success: true,
        count: files.length,
        data: files,
      });
    } catch (error: any) {
      console.error('[FilesController] Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search indexed files.',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/files/reindex
   */
  public async reindex(req: Request, res: Response): Promise<void> {
    try {
      const { targetDirectories } = req.body || {};

      // Initiate crawl (can run synchronously or trigger background scan)
      const stats = await fileCrawlerService.crawl(targetDirectories);

      res.status(200).json({
        success: true,
        message: 'File reindexing complete.',
        data: stats,
      });
    } catch (error: any) {
      console.error('[FilesController] Reindexing error:', error);
      res.status(500).json({
        success: false,
        message: 'File reindexing encountered an error.',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/files/status
   */
  public async getStatus(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: fileCrawlerService.getStats(),
    });
  }
}

export const filesController = new FilesController();

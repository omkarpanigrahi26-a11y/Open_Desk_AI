import { Request, Response } from 'express';
import { fileIndexService } from '../services/fileIndex.service';

export class FileIndexController {
  public async getRecent(req: Request, res: Response): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 50;
      const files = await fileIndexService.getRecentFiles(limit);
      res.status(200).json({ success: true, data: files });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async search(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.query.q as string) || '';
      const limit = Number(req.query.limit) || 20;
      const files = await fileIndexService.searchFiles(query, limit);
      res.status(200).json({ success: true, data: files });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async upsert(req: Request, res: Response): Promise<void> {
    try {
      const { filePath, fileName, fileExtension, fileSize, snippetText } = req.body;
      if (!filePath || !fileName || !fileExtension || fileSize == null) {
        res.status(400).json({ success: false, message: 'Missing required file index attributes' });
        return;
      }

      const indexed = await fileIndexService.upsertIndex({
        filePath,
        fileName,
        fileExtension,
        fileSize,
        snippetText,
        lastIndexedAt: new Date(),
      });

      res.status(201).json({ success: true, data: indexed });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const fileIndexController = new FileIndexController();

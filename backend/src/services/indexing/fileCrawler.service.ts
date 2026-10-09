import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Op } from 'sequelize';
import { FileIndex } from '../../models/FileIndex';

export interface CrawlStats {
  isIndexing: boolean;
  foldersScanned: string[];
  totalFilesIndexed: number;
  lastIndexedAt: Date | null;
  lastDurationMs: number;
  lastError: string | null;
}

export class FileCrawlerService {
  private isIndexing = false;
  private readonly supportedExtensions = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.go',
    '.json',
    '.md',
    '.txt',
    '.pdf',
    '.docx',
    '.doc',
    '.pptx',
    '.ppt',
    '.xlsx',
    '.xls',
    '.csv',
    '.sql',
    '.html',
    '.css',
    '.zip',
    '.png',
    '.jpg',
    '.jpeg',
  ]);

  private readonly ignoredDirectories = new Set([
    'node_modules',
    '.git',
    '.svn',
    'dist',
    'build',
    '.next',
    '.vscode',
    'vendor',
    'coverage',
    '__pycache__',
    '.gemini',
    '.cache',
  ]);

  private stats: CrawlStats = {
    isIndexing: false,
    foldersScanned: [],
    totalFilesIndexed: 0,
    lastIndexedAt: null,
    lastDurationMs: 0,
    lastError: null,
  };

  /**
   * Resolves target scan directories (~/Projects, ~/Documents, or custom targets).
   */
  public getDefaultScanDirectories(): string[] {
    const home = os.homedir();
    const configuredPaths = process.env.INDEX_PATHS
      ? process.env.INDEX_PATHS.split(',').map((p) => p.trim())
      : [];

    const defaultPaths = [
      path.join(home, 'Projects'),
      path.join(home, 'Documents'),
    ];

    const targets = configuredPaths.length > 0 ? configuredPaths : defaultPaths;

    // Filter to existing directories
    return targets.map((p) => (p.startsWith('~') ? path.join(home, p.slice(1)) : path.resolve(p)));
  }

  /**
   * Recursively crawls designated folders and synchronizes file metadata and snippets with MySQL.
   */
  public async crawl(targetDirectories?: string[]): Promise<CrawlStats> {
    if (this.isIndexing) {
      return this.stats;
    }

    this.isIndexing = true;
    this.stats.isIndexing = true;
    this.stats.lastError = null;
    const startTime = performance.now();

    const directoriesToScan = targetDirectories && targetDirectories.length > 0
      ? targetDirectories
      : this.getDefaultScanDirectories();

    this.stats.foldersScanned = directoriesToScan;
    let indexedCount = 0;

    try {
      for (const dir of directoriesToScan) {
        try {
          const exists = await fs.stat(dir).catch(() => null);
          if (exists && exists.isDirectory()) {
            indexedCount += await this.scanDirectory(dir);
          }
        } catch (dirErr: any) {
          console.warn(`[FileCrawler] Skipping directory "${dir}":`, dirErr.message);
        }
      }

      this.stats.totalFilesIndexed = indexedCount;
      this.stats.lastIndexedAt = new Date();
      this.stats.lastDurationMs = Math.round(performance.now() - startTime);
    } catch (err: any) {
      this.stats.lastError = err.message || 'Crawl failed';
      console.error('[FileCrawler] Error during file crawling:', err);
    } finally {
      this.isIndexing = false;
      this.stats.isIndexing = false;
    }

    return this.stats;
  }

  /**
   * Recursively scans an individual directory.
   */
  private async scanDirectory(dirPath: string): Promise<number> {
    let count = 0;

    let entries: string[];
    try {
      entries = await fs.readdir(dirPath);
    } catch {
      return count;
    }

    for (const entry of entries) {
      if (this.ignoredDirectories.has(entry) || entry.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry);

      try {
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          count += await this.scanDirectory(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (this.supportedExtensions.has(ext)) {
            await this.indexFile(fullPath, entry, ext, stat.size);
            count++;
          }
        }
      } catch {
        // Skip inaccessible files or broken symlinks
      }
    }

    return count;
  }

  /**
   * Parses text snippets (up to 8KB) and upserts file metadata into MySQL.
   */
  private async indexFile(filePath: string, fileName: string, fileExtension: string, fileSize: number): Promise<void> {
    let snippetText = '';

    try {
      // Read first 8KB for fast snippet text search without memory bloat
      const handle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(Math.min(fileSize, 8192));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      await handle.close();

      snippetText = buffer.toString('utf-8', 0, bytesRead);
    } catch {
      snippetText = '';
    }

    try {
      await FileIndex.upsert({
        filePath,
        fileName,
        fileExtension,
        fileSize,
        snippetText,
        lastIndexedAt: new Date(),
      });
    } catch (dbErr: any) {
      console.warn(`[FileCrawler] Failed to index "${filePath}":`, dbErr.message);
    }
  }

  /**
   * Searches indexed files across fileName and snippetText, supplemented by live whole-PC search.
   */
  public async searchFiles(query: string, limit = 15): Promise<any[]> {
    const trimmed = query.trim();
    let dbResults: any[] = [];

    try {
      if (!trimmed) {
        dbResults = await FileIndex.findAll({
          order: [['lastIndexedAt', 'DESC']],
          limit,
        });
      } else {
        dbResults = await FileIndex.findAll({
          where: {
            [Op.or]: [
              { fileName: { [Op.like]: `%${trimmed}%` } },
              { snippetText: { [Op.like]: `%${trimmed}%` } },
            ],
          },
          order: [['lastIndexedAt', 'DESC']],
          limit,
        });
      }
    } catch {
      dbResults = [];
    }

    if (dbResults.length >= limit) {
      return dbResults;
    }

    // Live Windows PC search fallback
    if (process.platform === 'win32' && trimmed) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const clean = trimmed.replace(/[^a-zA-Z0-9_\-\.]/g, '');
        const psCmd = `powershell -NoProfile -Command "Get-ChildItem -Path $env:USERPROFILE -Filter '*${clean}*' -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First ${limit} FullName, Name, Extension, Length | ConvertTo-Json"`;
        const { stdout } = await execAsync(psCmd, { timeout: 8000 });
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const existingPaths = new Set(dbResults.map((r: any) => r.filePath));
          for (const item of list) {
            if (item && item.FullName && !existingPaths.has(item.FullName)) {
              dbResults.push({
                filePath: item.FullName,
                fileName: item.Name || path.basename(item.FullName),
                fileExtension: item.Extension || path.extname(item.FullName),
                fileSize: item.Length || 0,
                snippetText: '',
                lastIndexedAt: new Date(),
              });
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    return dbResults;
  }

  public getStats(): CrawlStats {
    return { ...this.stats };
  }
}

export const fileCrawlerService = new FileCrawlerService();

import { FileIndex, FileIndexCreationAttributes } from '../models/FileIndex';

export class FileIndexService {
  public async upsertIndex(payload: FileIndexCreationAttributes): Promise<FileIndex> {
    const [record] = await FileIndex.upsert(payload);
    return record;
  }

  public async getRecentFiles(limit = 50): Promise<FileIndex[]> {
    return FileIndex.findAll({
      order: [['lastIndexedAt', 'DESC']],
      limit,
    });
  }

  public async searchFiles(query: string, limit = 20): Promise<FileIndex[]> {
    const { Op } = await import('sequelize');
    return FileIndex.findAll({
      where: {
        [Op.or]: [
          { fileName: { [Op.like]: `%${query}%` } },
          { filePath: { [Op.like]: `%${query}%` } },
          { snippetText: { [Op.like]: `%${query}%` } },
        ],
      },
      limit,
    });
  }
}

export const fileIndexService = new FileIndexService();

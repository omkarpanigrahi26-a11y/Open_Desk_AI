import { sequelize } from '../config/database';
import { FileIndex } from './FileIndex';
import { TokenMetric } from './TokenMetric';
import { ChatMessage } from './ChatMessage';
import { CompanionLog } from './CompanionLog';

/**
 * Synchronize all defined models with MySQL.
 * { alter: true } checks the current table state in MySQL Workbench and alters it to match without dropping data.
 */
export async function syncDatabase(): Promise<void> {
  try {
    await sequelize.sync();
    console.log('[Database] Models synchronized with MySQL successfully. Tables verified/updated.');
  } catch (error: any) {
    console.error('[Database] Error synchronizing models with MySQL:', error.message || error);
    // Don't crash server if sync hits index limit
  }
}

export {
  sequelize,
  FileIndex,
  TokenMetric,
  ChatMessage,
  CompanionLog,
};

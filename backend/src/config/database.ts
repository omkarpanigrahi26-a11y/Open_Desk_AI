import { Sequelize } from 'sequelize';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME || 'opendesk_db';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    idle: 10000,
    acquire: 30000,
  },
  define: {
    timestamps: true,
    underscored: false,
  },
});

/**
 * Checks if the configured MySQL database exists.
 * If not, creates the database automatically before Sequelize initializes.
 */
export async function ensureDatabaseExists(): Promise<boolean> {
  let connection: mysql.Connection | null = null;
  try {
    // Connect to MySQL server without selecting a specific database
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
    });

    const [rows] = (await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    )) as any[];

    if (Array.isArray(rows) && rows.length > 0) {
      // Database already exists
    } else {
      const escapedDbName = dbName.replace(/`/g, '``');
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${escapedDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      console.log(`[Database] Created database "${dbName}".`);
    }

    return true;
  } catch (error: any) {
    console.error(`[Database] Error verifying/creating database "${dbName}":`, error.message || error);
    return false;
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
}

/**
 * Validates active connection to MySQL instance.
 */
export async function testConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    return true;
  } catch (error: any) {
    console.error(`[Database] Connection failure (${dbHost}:${dbPort}/${dbName}):`, error.message || error);
    return false;
  }
}


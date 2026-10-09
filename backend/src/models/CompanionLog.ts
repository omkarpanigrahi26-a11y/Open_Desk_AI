import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface CompanionLogAttributes {
  id: string;
  ownerName: string;
  userSpeech: string;
  agentReply: string;
  tierUsed?: string;
  latencyMs?: number;
}

export class CompanionLog extends Model<CompanionLogAttributes> implements CompanionLogAttributes {
  declare id: string;
  declare ownerName: string;
  declare userSpeech: string;
  declare agentReply: string;
  declare tierUsed?: string;
  declare latencyMs?: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CompanionLog.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    ownerName: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'Omkar',
    },
    userSpeech: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    agentReply: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tierUsed: {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: 'Voice Companion',
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'CompanionLogs',
    timestamps: true,
  }
);

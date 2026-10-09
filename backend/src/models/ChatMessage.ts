import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface ChatMessageAttributes {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sessionDate: string; // Format: DD-MM-YYYY
  tierUsed?: string;
  latencyMs?: number;
  tokensConsumed?: number;
  tokensSaved?: number;
}

export class ChatMessage extends Model<ChatMessageAttributes> implements ChatMessageAttributes {
  declare id: string;
  declare sender: 'user' | 'assistant';
  declare text: string;
  declare sessionDate: string;
  declare tierUsed?: string;
  declare latencyMs?: number;
  declare tokensConsumed?: number;
  declare tokensSaved?: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ChatMessage.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    sender: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sessionDate: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    tierUsed: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    tokensConsumed: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    tokensSaved: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'ChatMessages',
    timestamps: true,
    indexes: [
      {
        fields: ['sessionDate'],
      },
    ],
  }
);

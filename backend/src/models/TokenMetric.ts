import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type TierType = 'Tier 1' | 'Tier 2' | 'Tier 3';

export interface TokenMetricAttributes {
  id: string;
  query: string;
  tierUsed: TierType;
  tokensConsumed: number;
  tokensSaved: number;
  latencyMs: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TokenMetricCreationAttributes
  extends Optional<TokenMetricAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class TokenMetric
  extends Model<TokenMetricAttributes, TokenMetricCreationAttributes>
  implements TokenMetricAttributes
{
  declare id: string;
  declare query: string;
  declare tierUsed: TierType;
  declare tokensConsumed: number;
  declare tokensSaved: number;
  declare latencyMs: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TokenMetric.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    query: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tierUsed: {
      type: DataTypes.ENUM('Tier 1', 'Tier 2', 'Tier 3'),
      allowNull: false,
    },
    tokensConsumed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    tokensSaved: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'token_metrics',
    indexes: [
      {
        fields: ['tierUsed'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

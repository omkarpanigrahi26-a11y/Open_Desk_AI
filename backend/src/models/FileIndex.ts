import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface FileIndexAttributes {
  id: string;
  filePath: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  snippetText?: string | null;
  lastIndexedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FileIndexCreationAttributes
  extends Optional<FileIndexAttributes, 'id' | 'snippetText' | 'createdAt' | 'updatedAt'> {}

export class FileIndex
  extends Model<FileIndexAttributes, FileIndexCreationAttributes>
  implements FileIndexAttributes
{
  declare id: string;
  declare filePath: string;
  declare fileName: string;
  declare fileExtension: string;
  declare fileSize: number;
  declare snippetText: string | null;
  declare lastIndexedAt: Date;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FileIndex.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    filePath: {
      type: DataTypes.STRING(512),
      allowNull: false,
      unique: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fileExtension: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    snippetText: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    lastIndexedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'file_indices',
    indexes: [
      {
        fields: ['fileName'],
      },
      {
        fields: ['fileExtension'],
      },
    ],
  }
);

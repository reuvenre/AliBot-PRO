import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [path.join(__dirname, '**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
  ssl:
    process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

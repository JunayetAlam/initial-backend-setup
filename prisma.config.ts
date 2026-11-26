import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './src/prisma/database-url.js';

// Same precedence as ConfigModule in app.module.ts: the first file wins.
dotenv.config({
  path: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
  quiet: true,
});

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not env('DATABASE_URL'): `prisma generate` must work without a database.
    url: resolveDatabaseUrl((key) => process.env[key]),
  },
});

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // generate/validate do not need a live database, so fall back to a placeholder URL
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/pocketbank',
  },
});

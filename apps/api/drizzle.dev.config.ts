import { defineConfig } from 'drizzle-kit';

const dbFile = process.env.DB_FILE_NAME ?? 'file:savings-dev.db';
const dbUrl = process.env.DATABASE_URL ?? dbFile;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  // Use sqlite dialect; libsql HTTP endpoints (including D1) are treated as sqlite
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl,
  },
});

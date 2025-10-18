import { defineConfig, Config } from 'drizzle-kit';

// 環境変数を厳格に扱い、意図しないデータベースへマイグレーションを実行しないための設定です。
//
// 適用される方針:
// - `DATABASE_URL` が設定されている場合はそれを使用します（通常は CI / 本番の流れ）。
// - `DATABASE_URL` が未設定の場合でも、ローカル DB ファイルを使用できるのは次の両方が満たされたときのみです:
//     - `DB_FILE_NAME` が設定されている
//     - `ALLOW_LOCAL_DB` が 'true' に設定されている
//   これにより CI 等で予期せぬローカルファイルに対してマイグレーションが走るのを防ぎます。
//
// GitHub Actions / CI では必ず `DATABASE_URL` を Secret として設定してください。
const databaseUrl = process.env.DATABASE_URL;
const dbFile = process.env.DB_FILE_NAME; // 暗黙的にファイルをデフォルト指定しない
const allowLocal = String(process.env.ALLOW_LOCAL_DB ?? '').toLowerCase() === 'true';

// 誤った実行を防ぐためのチェック。
if (!databaseUrl) {
  if (!dbFile || !allowLocal) {
    // `DATABASE_URL` が無く、かつローカル DB の使用が明示的に許可されていない場合は早期に失敗させます。
    // これにより CI や開発環境で意図しない DB に対してマイグレーションが実行されるのを防ぎます。
    throw new Error(
      'Database configuration error: DATABASE_URL is not set. To run locally only, set DB_FILE_NAME and ALLOW_LOCAL_DB=true. For CI/production set DATABASE_URL.'
    );
  }
}

const dbUrl = databaseUrl ?? dbFile!; // allowLocal が true の場合、dbFile は保証されます

// Cloudflare D1 の databaseId（任意）。環境変数で上書き可能です。
const defaultDatabaseId = process.env.D1_DATABASE_ID ?? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  // libSQL の HTTP エンドポイント（D1 を含む）も sqlite として扱われます
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl,
    // `DATABASE_URL` が使われている場合のみ `databaseId` を設定します（ツールによってはターゲット識別に役立ちます）。
    databaseId: databaseUrl ? defaultDatabaseId : undefined,
  },
});

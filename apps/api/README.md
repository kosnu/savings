```txt
npm install
npm run dev
```

```txt
npm run deploy
```

## ローカルと本番の起動方法（dotenv を使わない）

このリポジトリは dotenv に依存せず、wrangler
の設定ファイルで環境ごとの変数を管理します。

- ローカル（Miniflare / wrangler dev）:

  開発用の設定は `wrangler.dev.toml`
  に定義しています。ローカルで起動するにはプロジェクトの `apps/api`
  に移動してから:

  ```bash
  npm ci
  npm run dev:local
  ```

  `wrangler dev --config wrangler.dev.toml` を実行すると `vars` に定義した値が
  Worker に注入されます。必要に応じて `wrangler.dev.toml`
  を編集してローカル用の値を調整してください。

- 本番（Cloudflare Workers）:

  本番向けの設定は `wrangler.toml` に置き、Secrets や本番値は Cloudflare
  ダッシュボードまたは `wrangler secret put` で設定してください。

  ```bash
  npm ci
  npm run deploy:prod
  ```

  `wrangler deploy --config wrangler.toml`
  は本番設定を使ってデプロイします。秘匿情報は `wrangler secret put`
  でアップロードしてください。

この方法により、プロジェクト内に平文の .env
を置くことなく、ローカルと本番で異なる設定を安全に扱えます。

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

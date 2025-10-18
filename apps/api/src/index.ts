import { Hono } from 'hono'
import { touch } from './sampleDbAccess';

const app = new Hono()

app.get('/', async (c) => {
  // Worker 環境では c.env を渡すことで D1 binding が使われます
  console.log('c.env:', c.env);

  try {
    await touch(c.env as any);
  } catch (e) {
    // ログは wrangler/miniflare のコンソールに出力されます
    console.error('touch failed:', e);
    return c.text('touch failed: ' + String(e), 500)
  }
  return c.text('Hello Hono!')
})

export default app

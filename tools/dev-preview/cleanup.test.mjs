import assert from "node:assert/strict"
import { test } from "node:test"

import { cleanupPreview, runCleanup } from "./cleanup.mjs"
import { previewName } from "./preview.mjs"

const env = {
  PR_NUMBER: "1927",
  PREVIEW_BRANCH: "feature/preview",
  GITHUB_REPOSITORY: "kosnu/savings",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: "fixture-secret",
}
const legacy = previewName(env.PREVIEW_BRANCH)
const pr = {
  number: 1927,
  state: "closed",
  head: {
    ref: env.PREVIEW_BRANCH,
    sha: "b".repeat(40),
    repo: { full_name: env.GITHUB_REPOSITORY },
  },
  base: { ref: "main" },
}
function fixture({
  state = pr,
  others = [],
  names = ["pr-1927", legacy, "pr-1928", "burneto", "burneto-dev"],
} = {}) {
  const resources = new Set(names)
  const calls = []
  const results = []
  const get = async (path) => (path.includes("?") ? others : state)
  const fetcher = async (url, options) => {
    const parsed = new URL(url)
    const base = `/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/workers/burneto-dev/previews`
    assert.equal(parsed.origin, "https://api.cloudflare.com")
    assert.equal(options.headers.Authorization, "Bearer fixture-secret")
    assert.equal(options.redirect, "error")
    assert.ok(options.signal)
    calls.push({ method: options.method, url })
    if (options.method === "DELETE") {
      assert.equal(parsed.search, "")
      const name = parsed.pathname.slice(base.length + 1)
      assert.ok(["pr-1927", legacy].includes(name))
      resources.delete(name)
      return Response.json({ success: true, errors: [], messages: [] })
    }
    assert.equal(options.method, "GET")
    assert.equal(parsed.pathname, base)
    const needle = parsed.searchParams.get("name")
    return Response.json({
      success: true,
      errors: [],
      result: [...resources].filter((name) => name.includes(needle)).map((name) => ({ name })),
      result_info: { total_pages: 1 },
    })
  }
  const report = (name, result) => results.push({ name, result })
  return { resources, calls, get, fetcher, report, results }
}

test("close/merge後、PR Previewと対応legacyだけを削除し親・本番・別PRは維持", async () => {
  const f = fixture()
  await cleanupPreview(env, f.get, f.fetcher, f.report)
  assert.deepEqual([...f.resources], ["pr-1928", "burneto", "burneto-dev"])
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 2)
  assert.ok(f.results.every((r) => r.result === "Preview 削除成功"))
  await cleanupPreview(env, f.get, f.fetcher, f.report)
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 2)
  assert.ok(f.results.slice(2).every((r) => r.result.includes("不在")))
})

test("正常応答の errors:null でも対象だけを削除し、不在確認まで完了する", async () => {
  const f = fixture()
  const fetcher = async (url, options) => {
    const response = await f.fetcher(url, options)
    return Response.json({ ...(await response.json()), errors: null })
  }
  await cleanupPreview(env, f.get, fetcher, f.report)
  assert.deepEqual([...f.resources], ["pr-1928", "burneto", "burneto-dev"])
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 2)
  assert.ok(f.results.every((r) => r.result === "Preview 削除成功"))
  await cleanupPreview(env, f.get, fetcher, f.report)
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 2)
  assert.ok(f.results.slice(2).every((r) => r.result.includes("不在")))
})

test("GET/DELETE のエラー配列・不正 errors・失敗応答を成功扱いしない", async () => {
  const invalid = [
    { success: true, errors: [{ message: "fixture-secret" }] },
    ...[undefined, {}, "", false, 0].map((errors) => ({ success: true, errors })),
    { success: false, errors: null },
    { errors: null },
    { success: "true", errors: null },
    null,
  ]
  for (const method of ["GET", "DELETE"]) {
    for (const body of invalid) {
      const f = fixture()
      const fetcher = async (url, options) =>
        options.method === method ? Response.json(body) : f.fetcher(url, options)
      await assert.rejects(
        cleanupPreview(env, f.get, fetcher, f.report),
        (error) => !error.message.includes("fixture-secret"),
      )
      assert.equal(f.results.length, 1)
      assert.ok(f.results[0].result.includes("失敗"))
      assert.ok(f.resources.has("pr-1927"))
    }
    const f = fixture()
    await assert.rejects(
      cleanupPreview(env, f.get, async (url, options) =>
        options.method === method
          ? Response.json({ success: true, errors: null }, { status: 500 })
          : f.fetcher(url, options),
      ),
      /500/u,
    )
  }
})

test("不在と似た名前は正常終了、部分一致の別Previewを削除しない", async () => {
  const f = fixture({ names: ["pr-19270", `${legacy}-other`] })
  await cleanupPreview(env, f.get, f.fetcher, f.report)
  assert.ok(f.results.every((r) => r.result.includes("不在")))
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 0)
})

test("reopen中はCloudflareへアクセスせず、同じbranchの他PRはlegacyだけを保護", async () => {
  const open = fixture({ state: { ...pr, state: "open" } })
  await cleanupPreview(env, open.get, open.fetcher, open.report)
  assert.equal(open.calls.length, 0)
  const shared = fixture({ others: [{ ...pr, number: 1928, state: "open" }] })
  await cleanupPreview(env, shared.get, shared.fetcher, shared.report)
  assert.ok(!shared.resources.has("pr-1927"))
  assert.ok(shared.resources.has(legacy))
  assert.ok(shared.results[1].result.includes("保護"))
})

test("GitHub open一覧の2ページ目も確認する", async () => {
  const f = fixture()
  const paths = []
  const get = async (path) => {
    paths.push(path)
    if (!path.includes("?")) return pr
    if (path.endsWith("page=1"))
      return Array.from({ length: 100 }, (_, i) => ({
        ...pr,
        number: i + 1,
        head: { ...pr.head, ref: `other/${i}` },
      }))
    return [{ ...pr, number: 1928 }]
  }
  await cleanupPreview(env, get, f.fetcher, f.report)
  assert.ok(paths.some((path) => path.endsWith("page=2")))
  assert.ok(f.resources.has(legacy))
})

test("Cloudflare一覧の2ページ目の完全一致だけを削除する", async () => {
  const f = fixture({ names: ["pr-1927"] })
  const fetcher = async (url, options) => {
    const u = new URL(url)
    if (
      options.method === "GET" &&
      u.searchParams.get("name") === "pr-1927" &&
      u.searchParams.get("page") === "1" &&
      f.resources.has("pr-1927")
    ) {
      return Response.json({
        success: true,
        errors: [],
        result: [{ name: "pr-19270" }],
        result_info: { total_pages: 2 },
      })
    }
    return f.fetcher(url, options)
  }
  await cleanupPreview(env, f.get, fetcher, f.report)
  assert.ok(!f.resources.has("pr-1927"))
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 1)
})

test("DELETE404は再照会で不在を確認した場合だけ成功", async () => {
  for (const missing of [true, false]) {
    const f = fixture({ names: ["pr-1927"] })
    const fetcher = async (url, options) => {
      if (options.method !== "DELETE") return f.fetcher(url, options)
      if (missing) f.resources.delete("pr-1927")
      return Response.json(
        { success: false, errors: [{ code: 1000 }], messages: [] },
        { status: 404 },
      )
    }
    if (missing) await cleanupPreview(env, f.get, fetcher, f.report)
    else await assert.rejects(cleanupPreview(env, f.get, fetcher, f.report), /404/u)
  }
})

test("認証・API・通信・JSON・pagination・削除未反映を成功へ丸めず、秘密本文を表示しない", async () => {
  for (const response of [
    () =>
      Response.json({ success: false, errors: [{ message: "fixture-secret" }] }, { status: 401 }),
    () => Response.json({ success: false, errors: [] }, { status: 403 }),
    () => Response.json({ success: false, errors: [] }, { status: 404 }),
    () => Response.json({ success: false, errors: [] }, { status: 429 }),
    () => Response.json({ success: false, errors: [] }, { status: 500 }),
    () => Response.json({ success: false, errors: [] }),
    () => Response.json({ success: true, errors: [], result: {} }),
    () =>
      Response.json({ success: true, errors: [], result: [], result_info: { total_pages: "2" } }),
    () => new Response("invalid-json"),
    () => {
      throw new Error("Network unavailable")
    },
  ]) {
    const f = fixture()
    await assert.rejects(
      cleanupPreview(env, f.get, response, f.report),
      (error) => !error.message.includes("fixture-secret"),
    )
  }
  const f = fixture()
  await assert.rejects(
    cleanupPreview(
      env,
      f.get,
      async (url, options) =>
        options.method === "DELETE"
          ? Response.json({ success: true, errors: [] })
          : f.fetcher(url, options),
      f.report,
    ),
    /存在/u,
  )
})

test("不正PR・account・branch・fork・GitHub照会失敗では削除しない", async () => {
  for (const patch of [
    { PR_NUMBER: "../other" },
    { PREVIEW_BRANCH: "" },
    { PREVIEW_BRANCH: "bad\nbranch" },
    { CLOUDFLARE_ACCOUNT_ID: "../production" },
    { CLOUDFLARE_API_TOKEN: "" },
  ]) {
    const f = fixture()
    await assert.rejects(cleanupPreview({ ...env, ...patch }, f.get, f.fetcher))
    assert.equal(f.calls.length, 0)
  }
  const f = fixture({ state: { ...pr, head: { ...pr.head, repo: { full_name: "fork/savings" } } } })
  await assert.rejects(cleanupPreview(env, f.get, f.fetcher))
  await assert.rejects(
    cleanupPreview(
      env,
      async () => {
        throw new Error("GitHub unavailable")
      },
      f.fetcher,
    ),
  )
  assert.equal(f.calls.length, 0)
})

test("Actions Summary は対象ごとの成功・不在・部分失敗を区別する", async () => {
  const f = fixture({ names: ["pr-1927"] })
  let summary = ""
  await runCleanup(env, f.get, f.fetcher, (value) => {
    summary += value
  })
  assert.match(summary, /PR: #1927/u)
  assert.match(summary, /親 Worker: burneto-dev/u)
  assert.match(summary, /pr-1927: Preview 削除成功/u)
  assert.ok(summary.includes(`${legacy}: Preview は不在`))
  summary = ""
  await assert.rejects(
    runCleanup(
      env,
      f.get,
      async (url, options) =>
        new URL(url).searchParams.get("name") === legacy
          ? Response.json({ success: false, errors: [] }, { status: 403 })
          : f.fetcher(url, options),
      (value) => {
        summary += value
      },
    ),
  )
  assert.match(summary, /pr-1927: Preview は不在/u)
  assert.ok(summary.includes(`${legacy}: 失敗`))
  assert.doesNotMatch(summary, /fixture-secret/u)
})

test("配信中close → 後処理 → 置き換わった古い配信要求の順でもPreviewを残さない", async () => {
  const { resolveLifecycle, reconcilePR } = await import("./lifecycle.mjs")
  const { authorize, deploymentRequest } = await import("./authorize.mjs")
  const context = {
    ...env,
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REF: "refs/heads/main",
  }
  let current = { ...structuredClone(pr), state: "open", labels: [{ name: "preview" }] }
  const event = {
    number: 1927,
    action: "labeled",
    label: { name: "preview" },
    pull_request: structuredClone(current),
  }
  const get = async (path) => (path.includes("?") ? [] : structuredClone(current))
  const f = fixture({ names: [] })
  const resolved = await resolveLifecycle(event, context, get)
  assert.equal(resolved.deploy, true)
  const request = deploymentRequest(
    event,
    context.GITHUB_EVENT_NAME,
    context.GITHUB_REF,
    env.GITHUB_REPOSITORY,
  )
  await authorize({ ...request, branch: resolved.branch }, env.GITHUB_REPOSITORY, get)
  // 配信側がrevalidationを通過した後、アップロード完了前にPRがcloseする。
  current.state = "closed"
  f.resources.add("pr-1927")
  assert.deepEqual(await reconcilePR(context, get), { closed: true })
  await cleanupPreview(context, get, f.fetcher, f.report)
  assert.ok(!f.resources.has("pr-1927"))
  // concurrency pendingの終了通知が古いlabel要求に置き換わっても削除経路へ進む。
  assert.equal((await resolveLifecycle(event, context, get)).deploy, false)
  await cleanupPreview(context, get, f.fetcher, f.report)
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 1)
  // 削除承認待ち中のreopenも、削除直前の照会で保護する。
  current.state = "open"
  f.resources.add("pr-1927")
  await cleanupPreview(context, get, f.fetcher, f.report)
  assert.ok(f.resources.has("pr-1927"))
})

test("parent未作成は不在で成功、parentがある一覧404はAPI障害として失敗", async () => {
  for (const parentExists of [false, true]) {
    const f = fixture()
    const fetcher = async (url, options) => {
      assert.equal(options.method, "GET")
      const path = new URL(url).pathname
      if (path.endsWith("/workers/workers"))
        return Response.json({
          success: true,
          errors: [],
          result: parentExists ? [{ name: "burneto-dev" }] : [{ name: "burneto" }],
        })
      return Response.json({ success: false, errors: [] }, { status: 404 })
    }
    if (parentExists) await assert.rejects(cleanupPreview(env, f.get, fetcher), /404/u)
    else {
      await cleanupPreview(env, f.get, fetcher, f.report)
      assert.ok(f.results.every((r) => r.result.includes("不在")))
    }
  }
})

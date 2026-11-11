import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

import { reportRelease, resolveRelease } from "./release.mjs"

const sha = "a".repeat(40)
const read = (name) =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8")
const deploy = read("deploy_production.yaml")
const route = read("release_production.yaml")

function fixture() {
  const release = {
    id: 1,
    tag_name: "v0.1.0",
    published_at: "2026-11-03T00:00:00Z",
    draft: false,
    prerelease: false,
    html_url: "https://github.com/kosnu/savings/releases/tag/v0.1.0",
    body: "変更内容\n\nFixes #1",
  }
  const calls = []
  const context = {
    repo: { owner: "kosnu", repo: "savings" },
    ref: "refs/heads/main",
    sha,
    runId: 9,
    serverUrl: "https://github.com",
    payload: { release },
  }
  const github = {
    rest: {
      repos: {
        getRelease: async (args) => {
          calls.push(["getRelease", args])
          return { data: release }
        },
        getCommit: async (args) => {
          calls.push(["getCommit", args])
          return { data: { sha } }
        },
        compareCommitsWithBasehead: async (args) => {
          calls.push(["compare", args])
          return { data: { merge_base_commit: { sha } } }
        },
        updateRelease: async (args) => {
          calls.push(["updateRelease", args])
          release.body = args.body
        },
      },
      actions: { createWorkflowDispatch: async (args) => calls.push(["dispatch", args]) },
    },
  }
  const core = {
    summary: {
      addRaw(value) {
        calls.push(["summary", value])
        return this
      },
      async write() {},
    },
  }
  return {
    release,
    calls,
    github,
    context,
    core,
    releaseId: "1",
    expectedSha: sha,
    runAttempt: "2",
  }
}

function script(yaml, name) {
  const section = yaml.slice(yaml.indexOf(`      - name: ${name}`))
  return section.match(/script: \|\n((?: {12}.*\n|\n)+)/)[1].replace(/^ {12}/gm, "")
}

// GitHub API は fixture。実 Actions の起動・承認・配信はこのテストでは実行しない。
test("Release 公開 script から main への dispatch と実際の検証 script を接続する", async () => {
  const f = fixture()
  await vm.runInNewContext(`(async () => {${script(route, "Dispatch release commit")}})`, f)()
  const dispatch = f.calls.find(([name]) => name === "dispatch")[1]
  assert.equal(dispatch.ref, "main")
  assert.equal(dispatch.workflow_id, "deploy_production.yaml")
  assert.equal(dispatch.inputs.release_id, "1")
  assert.equal(dispatch.inputs.expected_sha, sha)
  // 実行定義の main が先へ進んでも配信対象は公開時 SHA のままにする。
  f.context.sha = "b".repeat(40)
  const outputs = {}
  const execute = new (Object.getPrototypeOf(async () => {}).constructor)(
    "github",
    "context",
    "core",
    "process",
    script(deploy, "Validate published release"),
  )
  await execute(
    f.github,
    f.context,
    {
      setOutput: (key, value) => {
        outputs[key] = value
      },
    },
    {
      env: {
        GITHUB_WORKSPACE: fileURLToPath(new URL("../../", import.meta.url)),
        RELEASE_ID: dispatch.inputs.release_id,
        EXPECTED_SHA: dispatch.inputs.expected_sha,
      },
    },
  )
  assert.equal(outputs.sha, sha)
  assert.equal(outputs.url, f.release.html_url)
  assert.deepEqual(f.calls.find(([name]) => name === "getCommit")[1], {
    ...f.context.repo,
    ref: "refs/tags/v0.1.0",
  })
  assert.deepEqual(f.calls.find(([name]) => name === "compare")[1], {
    ...f.context.repo,
    basehead: `${sha}...main`,
  })
  const report = new (Object.getPrototypeOf(async () => {}).constructor)(
    "github",
    "context",
    "core",
    "process",
    script(deploy, "Report deployment result"),
  )
  await report(f.github, f.context, f.core, {
    env: {
      GITHUB_WORKSPACE: fileURLToPath(new URL("../../", import.meta.url)),
      RELEASE_ID: dispatch.inputs.release_id,
      EXPECTED_SHA: outputs.sha,
      API_RESULT: "success",
      WEB_RESULT: "failure",
      GITHUB_RUN_ATTEMPT: "2",
    },
  })
  assert.ok(f.release.body.includes("Production deployment: 未完了"))
  assert.ok(f.release.body.includes(`/commit/${sha}`))
  assert.ok(f.release.body.includes("/actions/runs/9/attempts/2"))
})

for (const [name, change] of [
  [
    "main 以外からの起動",
    (f) => {
      f.context.ref = "refs/tags/v0.1.0"
    },
  ],
  [
    "Release ID の欠落",
    (f) => {
      f.releaseId = ""
    },
  ],
  [
    "SHA の欠落",
    (f) => {
      f.expectedSha = ""
    },
  ],
  [
    "Draft",
    (f) => {
      f.release.draft = true
    },
  ],
  [
    "プレリリース",
    (f) => {
      f.release.prerelease = true
    },
  ],
  [
    "未公開 Release",
    (f) => {
      f.release.published_at = null
    },
  ],
  [
    "正式版ではないタグ",
    (f) => {
      f.release.tag_name = "v1.0.0-rc.1"
    },
  ],
  [
    "不正なバージョン",
    (f) => {
      f.release.tag_name = "v01.0.0"
    },
  ],
  [
    "公開後のタグ移動",
    (f) => {
      f.github.rest.repos.getCommit = async () => ({ data: { sha: "b".repeat(40) } })
    },
  ],
  [
    "main に未包含の commit",
    (f) => {
      f.github.rest.repos.compareCommitsWithBasehead = async () => ({
        data: { merge_base_commit: { sha: "b".repeat(40) } },
      })
    },
  ],
  [
    "Release 削除・API 障害",
    (f) => {
      f.github.rest.repos.getRelease = async () => {
        throw new Error("404")
      }
    },
  ],
]) {
  test(`${String(name)}を拒否し配信対象を返さない`, async () => {
    const f = fixture()
    change(f)
    await assert.rejects(resolveRelease(f))
    assert.ok(f.calls.every(([method]) => !["dispatch", "updateRelease"].includes(method)))
  })
}

test("target_commitish が移動する main でもタグの commit を採用する", async () => {
  const f = fixture()
  f.release.target_commitish = "main"
  assert.equal((await resolveRelease(f)).sha, sha)
})

for (const [apiResult, webResult, result] of [
  ["success", "success", "success"],
  ["failure", "skipped", "未完了"],
  ["success", "failure", "未完了"],
  ["success", "cancelled", "未完了"],
]) {
  test(`DB ${apiResult} / Web ${webResult} を Release に対応付ける`, async () => {
    const f = fixture()
    await reportRelease({ ...f, apiResult, webResult })
    assert.ok(f.release.body.startsWith("変更内容\n\nFixes #1"))
    assert.ok(f.release.body.includes(`Production deployment: ${result}`))
    assert.ok(f.release.body.includes(`/commit/${sha}`))
    assert.ok(f.release.body.includes("/actions/runs/9/attempts/2"))
    assert.ok(f.release.body.includes(`Database: ${apiResult}`))
    assert.ok(f.release.body.includes(`Web: ${webResult}`))
    await reportRelease({ ...f, apiResult: "success", webResult: "success" })
    assert.equal(f.release.body.match(/production-deployment:start/g).length, 1)
    assert.ok(f.release.body.includes("Production deployment: success"))
  })
}

test("結果報告の API 障害を成功へ丸めず summary を残す", async () => {
  const f = fixture()
  f.github.rest.repos.updateRelease = async () => {
    throw new Error("403")
  }
  await assert.rejects(reportRelease({ ...f, apiResult: "success", webResult: "success" }))
  assert.ok(f.calls.some(([name]) => name === "summary"))
})

// 静的検査は SHA の受け渡し・依存・権限を確認し、実配信の成功を保証しない。
test("正式公開だけを受け付け、DB 成功後に同じ SHA の Web を配信する", () => {
  assert.match(route, /release:\n    types: \[published\]/)
  assert.match(
    route,
    /if: github.event.release.draft == false && github.event.release.prerelease == false/,
  )
  assert.doesNotMatch(route, /checkout@|secrets\./)
  assert.match(deploy, /group: burneto-production-release\n  cancel-in-progress: false/)
  assert.match(deploy, /if: github.ref == 'refs\/heads\/main'/)
  const api = deploy.split("\n  deploy-api:\n")[1].split("\n  deploy-web:\n")[0]
  const web = deploy.split("\n  deploy-web:\n")[1].split("\n  report:\n")[0]
  assert.match(api, /needs: release/)
  assert.match(web, /needs: \[release, deploy-api\]/)
  for (const job of [api, web]) {
    assert.match(job, /environment:\n      name: production/)
    assert.match(job, /ref: \$\{\{ needs.release.outputs.sha \}\}/)
    assert.match(job, /EXPECTED_SHA: \$\{\{ needs.release.outputs.sha \}\}/)
    assert.ok(
      job.indexOf("Recheck release after environment approval") <
        job.indexOf("Checkout release commit"),
    )
    assert.doesNotMatch(job, /(?:contents|actions): write|continue-on-error:|always\(\)/)
  }
  assert.match(web, /SENTRY_RELEASE: \$\{\{ needs.release.outputs.sha \}\}/)
  assert.match(deploy, /if: always\(\) && needs.release.result == 'success'/)
  const report = deploy.split("\n  report:\n")[1]
  assert.match(report, /contents: write/)
  assert.doesNotMatch(report, /ref: \$\{\{ needs.release.outputs.sha \}\}|secrets\.|pnpm/)
})

// CLI 引数の静的な接続検査。Hosted DB への接続や migration の適用は行わない。
test("本番 DB push はリンク先と非対話実行を明示する", () => {
  const api = deploy.split("\n  deploy-api:\n")[1].split("\n  deploy-web:\n")[0]
  assert.match(
    api,
    /name: Push Database Migrations\n        run: supabase db push --linked --yes\n        working-directory: apps\/api/,
  )
})

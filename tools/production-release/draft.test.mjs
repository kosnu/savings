import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { draftRelease, nextVersion } from "./draft.mjs"

const base = "a".repeat(40),
  sha = "b".repeat(40)
const commit = (message) => ({ commit: { message }, parents: [{ sha: base }] })

for (const [previous, messages, expected] of [
  [undefined, [], "v0.1.0"],
  ["v0.1.0", ["fix: 金額計算を修正する"], "v0.1.1"],
  ["v0.1.5", ["feat(payments): 検索を追加する", "fix: 表示を修正する"], "v0.2.0"],
  ["v0.4.7", ["refactor!: 旧APIを廃止する"], "v0.5.0"],
  ["v1.2.3", ["feat: 機能を追加する"], "v1.3.0"],
  ["v1.2.3", ["feat: 機能を追加する", "fix!: 保存形式を変更する"], "v2.0.0"],
  ["v1.2.3", ["chore: 依存を更新する\n\nBREAKING CHANGE: 旧形式を受け付けない"], "v2.0.0"],
  ["v1.2.3", ["fix: 修正する\n\nBREAKING-CHANGE: 互換性を変える"], "v2.0.0"],
  ["v1.2.3", ["docs: 手順を整理する", "ci: 配信を改善する", "perf: 処理を速める"], "v1.2.4"],
  ["v1.2.3", [], null],
]) {
  test(`${String(previous)} から ${String(expected)} を提案する`, () => {
    assert.equal(nextVersion(previous, messages.map(commit)), expected)
  })
}

test("通常 merge は PR title を読み、squash と同じ番号になる", () => {
  const merge = {
    ...commit("Merge pull request #1 from feature\n\nfeat: 検索を追加する"),
    parents: [{ sha: base }, { sha }],
  }
  assert.equal(nextVersion("v1.2.3", [merge]), "v1.3.0")
  assert.equal(
    nextVersion("v1.2.3", [{ ...merge, commit: { message: "feat: 検索を追加する" } }]),
    "v1.3.0",
  )
})

test("未知の commit は推測せず停止し、人が番号を明示した場合だけ進む", () => {
  const commits = [commit("Update app")]
  assert.throws(() => nextVersion("v0.1.0", commits))
  assert.equal(nextVersion("v0.1.0", commits, "v0.2.0"), "v0.2.0")
  assert.equal(nextVersion("v0.9.0", commits, "v1.0.0"), "v1.0.0")
  for (const value of [
    "v0.1.0",
    "v0.0.9",
    "v01.2.0",
    "v1.0.0-rc.1",
    "v1.0.0\n",
    "main",
    "v9007199254740992.0.0",
  ]) {
    assert.throws(() => nextVersion("v0.1.0", commits, value))
  }
})

function fixture() {
  const releases = [
    {
      id: 1,
      tag_name: "v0.1.0",
      draft: false,
      prerelease: false,
      published_at: "2026-11-01T00:00:00Z",
    },
  ]
  const f = {
    context: { repo: { owner: "kosnu", repo: "savings" }, ref: "refs/heads/main", sha },
    releases,
    commits: [commit("feat: 検索を追加する")],
    calls: [],
    currentSha: sha,
  }
  const repos = {
    listReleases: "releases",
    getCommit: async () => ({ data: { sha: base } }),
    compareCommitsWithBasehead: async (args) => {
      f.calls.push(["compare", args])
      return {
        data: {
          merge_base_commit: { sha: base },
          commits: f.commits.slice((args.page - 1) * 100, args.page * 100),
          total_commits: f.commits.length,
        },
      }
    },
    generateReleaseNotes: async (args) => {
      f.calls.push(["notes", args])
      return { data: { body: "## What's Changed\n- 検索 #1" } }
    },
    getBranch: async () => ({ data: { commit: { sha: f.currentSha } } }),
    getRelease: async ({ release_id }) => ({
      data: releases.find((release) => release.id === release_id),
    }),
    createRelease: async (args) => {
      f.calls.push(["create", args])
      const release = {
        ...args,
        id: 2,
        html_url: "https://github.com/kosnu/savings/releases/tag/untagged-example",
      }
      releases.push(release)
      return { data: release }
    },
    updateRelease: async (args) => {
      f.calls.push(["update", args])
      const release = releases.find((item) => item.id === args.release_id)
      Object.assign(release, args)
      return { data: release }
    },
  }
  f.github = {
    paginate: async () => releases,
    rest: {
      repos,
      git: {
        getRef: async () => {
          throw Object.assign(new Error("Not found"), { status: 404 })
        },
      },
    },
  }
  return f
}

// GitHub API は fixture。実 Draft の作成・タグ作成・公開・配信は実行しない。
test("前回正式版から固定 SHA の Draft を作り、同じ Draft を人の追記を保って更新する", async () => {
  const f = fixture()
  const release = await draftRelease(f)
  assert.equal(release.tag_name, "v0.2.0")
  assert.equal(release.target_commitish, sha)
  assert.equal(release.draft, true)
  assert.equal(release.prerelease, false)
  assert.ok(release.body.includes("前回正式版: v0.1.0"))
  assert.deepEqual(f.calls.find(([name]) => name === "notes")[1], {
    ...f.context.repo,
    tag_name: "v0.2.0",
    target_commitish: sha,
    previous_tag_name: "v0.1.0",
  })
  release.body += "\n担当者のDB確認と復旧方法"
  await draftRelease(f)
  assert.equal(f.calls.filter(([name]) => name === "create").length, 1)
  assert.ok(release.body.endsWith("担当者のDB確認と復旧方法"))
  const update = f.calls.find(([name]) => name === "update")[1]
  assert.ok(!Object.hasOwn(update, "draft"))
  assert.ok(!Object.hasOwn(update, "prerelease"))
  assert.equal(release.body.match(/production-release-draft:start/g).length, 1)
})

test("正式版がない初回は v0.1.0、Draft とプレリリースは採番元にしない", async () => {
  const f = fixture()
  f.releases.splice(0, 1, { id: 3, tag_name: "v9.0.0", draft: false, prerelease: true })
  assert.equal((await draftRelease(f)).tag_name, "v0.1.0")
  assert.ok(!Object.hasOwn(f.calls.find(([name]) => name === "notes")[1], "previous_tag_name"))
})

test("番号順で最新の正式版を選び、比較の全ページから最も大きい変更を採用する", async () => {
  const f = fixture()
  f.releases.unshift({ ...f.releases[0], id: 3, tag_name: "v0.0.9" })
  f.commits = [
    ...Array.from({ length: 100 }, () => commit("fix: 修正する")),
    commit("feat: 機能を追加する"),
  ]
  assert.equal((await draftRelease(f)).tag_name, "v0.2.0")
  assert.equal(f.calls.filter(([name]) => name === "compare").length, 2)
})

for (const [name, change] of [
  [
    "main 以外",
    (f) => {
      f.context.ref = "refs/heads/feature"
    },
  ],
  [
    "未知の commit",
    (f) => {
      f.commits = [commit("Update app")]
    },
  ],
  [
    "既存タグ",
    (f) => {
      f.github.rest.git.getRef = async () => ({ data: { ref: "refs/tags/v0.2.0" } })
    },
  ],
  [
    "タグ照会の障害",
    (f) => {
      f.github.rest.git.getRef = async () => {
        throw Object.assign(new Error("Forbidden"), { status: 403 })
      }
    },
  ],
  [
    "別の担当者の Draft",
    (f) => {
      f.releases.push({ id: 2, tag_name: "v0.2.0", draft: true, body: "手動の候補" })
    },
  ],
  [
    "前回と異なる履歴",
    (f) => {
      f.github.rest.repos.compareCommitsWithBasehead = async () => ({
        data: { merge_base_commit: { sha } },
      })
    },
  ],
  [
    "ノート生成の障害",
    (f) => {
      f.github.rest.repos.generateReleaseNotes = async () => {
        throw new Error("503")
      }
    },
  ],
]) {
  test(`${String(name)}では Draft を書き込まない`, async () => {
    const f = fixture()
    change(f)
    await assert.rejects(draftRelease(f))
    assert.ok(f.calls.every(([method]) => !["create", "update"].includes(method)))
  })
}

test("過去 run の再実行と、公開済みから変更なしの場合は Draft を更新しない", async () => {
  const f = fixture()
  f.currentSha = "c".repeat(40)
  assert.equal(await draftRelease(f), null)
  f.currentSha = sha
  f.commits = []
  assert.equal(await draftRelease(f), null)
  assert.ok(f.calls.every(([method]) => !["create", "update"].includes(method)))
})

test("公開済みに変わった候補を再度 Draft に戻さない", async () => {
  const f = fixture()
  const release = await draftRelease(f)
  f.github.rest.repos.getRelease = async () => ({ data: { ...release, draft: false } })
  await assert.rejects(draftRelease(f))
  assert.ok(!f.calls.some(([method]) => method === "update"))
})

test("コード変更なしでも v1.0.0 への手動移行を準備できる", async () => {
  const f = fixture()
  f.context.sha = base
  f.currentSha = base
  f.commits = []
  const release = await draftRelease({ ...f, requestedVersion: "v1.0.0" })
  assert.equal(release.tag_name, "v1.0.0")
  assert.equal(release.target_commitish, base)
  assert.equal(release.draft, true)
})

test("workflow の実 script は main の helper から公開しない Draft 作成へ接続する", async () => {
  const f = fixture()
  const yaml = readFileSync(
    new URL("../../.github/workflows/draft_production_release.yaml", import.meta.url),
    "utf8",
  )
  assert.match(yaml, /push:\n    branches: \[main\]/)
  assert.match(yaml, /if: github.ref == 'refs\/heads\/main'/)
  assert.doesNotMatch(
    yaml,
    /pull_request_target|secrets\.|environment:|createWorkflowDispatch|publish: true/,
  )
  const source = yaml.match(/script: \|\n((?: {12}.*\n|\n)+)/)[1].replace(/^ {12}/gm, "")
  const execute = new (Object.getPrototypeOf(async () => {}).constructor)(
    "github",
    "context",
    "core",
    "process",
    source,
  )
  const core = {
    summary: {
      addRaw() {
        return this
      },
      async write() {},
    },
  }
  await execute(f.github, f.context, core, {
    env: {
      GITHUB_WORKSPACE: fileURLToPath(new URL("../../", import.meta.url)),
      REQUESTED_VERSION: "v1.0.0",
    },
  })
  const created = f.calls.find(([method]) => method === "create")[1]
  assert.equal(created.draft, true)
  assert.equal(created.tag_name, "v1.0.0")
  assert.equal(created.target_commitish, sha)
})

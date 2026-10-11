import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { identify, restoreReleaseAgeExclusions, version } from "./migrate.mjs"

test("catalogは固定版だけを受理する", () => {
  assert.equal(version('catalog:\n  vite-plus: "1.1.0-beta.1"\n'), "1.1.0-beta.1")
  assert.throws(() => version("catalog:\n  vite-plus: ^1.1.0\n"))
})

test("公開待機の例外をコメントごと保持し、他の設定を変更しない", () => {
  const original =
    "minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # security\n  - esbuild@0.28.1\nsavePrefix: ''\n"
  const migrated =
    "minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - vite-plus\n  - vitest\nsavePrefix: ''\n"
  assert.equal(restoreReleaseAgeExclusions(original, migrated), original)
  assert.equal(
    restoreReleaseAgeExclusions("savePrefix: ''\n", migrated),
    "minimumReleaseAge: 10080\nsavePrefix: ''\n",
  )
  assert.match(
    restoreReleaseAgeExclusions(original, "savePrefix: ''\n"),
    /# security\n  - esbuild@0.28.1/,
  )
})

test("baseとの差分をGitHub outputへ返し、同じ版なら同期不要と判定する", () => {
  const root = mkdtempSync(join(tmpdir(), "vite-plus-identify-test-"))
  try {
    const catalog = join(root, "pnpm-workspace.yaml"),
      output = join(root, "output")
    writeFileSync(catalog, "catalog:\n  vite-plus: 1.0.0\n")
    const git = (args) => execFileSync("git", args, { cwd: root })
    git(["init", "--quiet"])
    git(["add", "pnpm-workspace.yaml"])
    git([
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "base",
    ])
    identify(root, "HEAD", output)
    assert.equal(readFileSync(output, "utf8"), "changed=false\nversion=1.0.0\n")
    writeFileSync(output, "")
    writeFileSync(catalog, "catalog:\n  vite-plus: 1.1.0\n")
    identify(root, "HEAD", output)
    assert.equal(readFileSync(output, "utf8"), "changed=true\nversion=1.1.0\n")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

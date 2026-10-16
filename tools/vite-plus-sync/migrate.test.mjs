import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, dirname, join } from "node:path"
import test from "node:test"

import { align, identify, restoreReleaseAgeExclusions, version } from "./migrate.mjs"

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

test("一時workspaceから再実行するvpはグローバル版でなく同期対象のCLIを使う", () => {
  const root = mkdtempSync(join(tmpdir(), "vite-plus-align-test-"))
  const previousPath = process.env.PATH
  const write = (path, contents, executable = false) => {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, contents, executable ? { mode: 0o755 } : undefined)
  }
  const script = (body) => `#!${process.execPath}\n${body}\n`
  try {
    for (const path of ["package.json", "apps/web/package.json", "apps/api/package.json"]) {
      write(path, "{}\n")
    }
    write("pnpm-workspace.yaml", "catalog:\n  vite-plus: 1.1.0\n")
    write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n")
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
    write("bin/pnpm", script(""), true)
    write("bin/vp", script("throw new Error('Global vp must not be used')"), true)
    write(
      "node_modules/.bin/vp",
      script(`
        const assert = require('node:assert/strict');
        const { execFileSync } = require('node:child_process');
        const { writeFileSync } = require('node:fs');
        assert.equal(process.env.npm_config_ignore_scripts, 'true');
        if (process.argv[2] === '--nested') {
          writeFileSync(${JSON.stringify(join(root, "nested-vp"))}, process.cwd());
        } else {
          execFileSync('vp', ['--nested'], { stdio: 'inherit' });
        }
      `),
      true,
    )
    write(
      "node_modules/vite-plus/package.json",
      JSON.stringify({
        version: "1.1.0",
        dependencies: { vitest: "5.0.3" },
      }),
    )
    write(
      "node_modules/vite/package.json",
      JSON.stringify({
        name: "@voidzero-dev/vite-plus-core",
        version: "1.1.0",
      }),
    )
    for (const name of ["vitest", "@vitest/browser-playwright", "@vitest/coverage-v8"]) {
      write(`node_modules/${name}/package.json`, JSON.stringify({ version: "5.0.3" }))
    }
    process.env.PATH = [join(root, "bin"), previousPath].filter(Boolean).join(delimiter)
    align(root, "1.1.0")
    assert.match(readFileSync(join(root, "nested-vp"), "utf8"), /vite-plus-sync-/)
    assert.equal(readFileSync(join(root, "apps/api/package.json"), "utf8"), "{}\n")
  } finally {
    if (previousPath === undefined) delete process.env.PATH
    else process.env.PATH = previousPath
    rmSync(root, { recursive: true, force: true })
  }
})

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { deployPreview, deploymentArgs } from "./deploy.mjs"

const legacy = "cf previews deploy [preview-name]\n\nPositionals\n  preview-name  Preview name.\n"
const modern = "cf previews deploy [directory]\n\nOptions\n      --preview-name  Preview name.\n"
const env = { PR_NUMBER: "2138", PREVIEW_NAME: "pr-2138", CLOUDFLARE_API_TOKEN: "token-fixture" }

for (const { label, help, nameArgs } of [
  { label: "旧CLI", help: legacy, nameArgs: ["pr-2138"] },
  { label: "新CLI", help: modern, nameArgs: ["--preview-name", "pr-2138"] },
]) {
  test(`${label}へ同じcanonical名と配信オプションを一度だけ渡す`, () => {
    const calls = []
    const status = deployPreview(env, (command, args, options) => {
      calls.push(args)
      assert.equal(command, "pnpm")
      if (calls.length === 1) {
        assert.deepEqual(args, ["--filter", "web", "exec", "cf", "previews", "deploy", "--help"])
        assert.equal(options.env.CLOUDFLARE_API_TOKEN, undefined)
        assert.equal(options.maxBuffer, 65536)
        assert.equal(options.timeout, 15000)
        return { status: 0, stdout: help }
      }
      assert.deepEqual(args, [
        "--filter",
        "web",
        "exec",
        "cf",
        "previews",
        "deploy",
        ...nameArgs,
        "--prebuilt",
        "--mode",
        "development",
      ])
      assert.equal(options.env.CLOUDFLARE_API_TOKEN, "token-fixture")
      assert.deepEqual(options.stdio, ["ignore", "inherit", "inherit"])
      return { status: 7 }
    })
    assert.equal(status, 7)
    assert.equal(calls.length, 2)
  })
}

test("未知の構文・help失敗・中断・過大出力では配信へ進まず診断を転載しない", () => {
  for (const result of [
    { status: 0, stdout: "cf previews deploy [directory]\n" },
    { status: 0, stdout: "" },
    { status: 0, stdout: `${legacy}${modern}` },
    { status: 1, stdout: modern, stderr: "secret-fixture" },
    { status: null, signal: "SIGTERM", stdout: modern },
    { status: 0, error: new Error("secret-fixture"), stdout: modern },
  ]) {
    let calls = 0
    assert.throws(
      () =>
        deployPreview(env, () => {
          calls++
          return result
        }),
      (error) => {
        assert.doesNotMatch(error.message, /secret-fixture/u)
        return true
      },
    )
    assert.equal(calls, 1)
  }
})

test("名の不一致・空・引数注入をCLI起動前に拒否する", () => {
  for (const input of [
    {},
    { ...env, PREVIEW_NAME: "--worker=burneto" },
    { ...env, PR_NUMBER: "0" },
    { ...env, PREVIEW_NAME: "pr-2139" },
  ]) {
    assert.throws(() => deployPreview(input, () => assert.fail("起動してはいけない")))
  }
})

test("CLI入口はhelpを隠し配信JSONだけをstdoutへ渡す（pnpmはfixture）", () => {
  const dir = mkdtempSync(join(tmpdir(), "preview-cli-test-"))
  try {
    const bin = join(dir, "pnpm")
    writeFileSync(
      bin,
      `#!${process.execPath}\nconst args = process.argv.slice(2); if (args.at(-1) === '--help') { process.stdout.write(${JSON.stringify(modern)}); } else { if (JSON.stringify(args) !== ${JSON.stringify(JSON.stringify(deploymentArgs(modern, env.PREVIEW_NAME)))}) process.exit(9); process.stdout.write('{"type":"preview","preview_name":"pr-2138"}\\n'); }\n`,
    )
    chmodSync(bin, 0o700)
    const result = spawnSync(
      process.execPath,
      [new URL("./deploy.mjs", import.meta.url).pathname],
      {
        env: { ...env, PATH: dir },
        encoding: "utf8",
      },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, '{"type":"preview","preview_name":"pr-2138"}\n')
    assert.equal(result.stderr, "")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("workflowはhelperを信頼済みcheckoutで保存し、PR checkout後も保存先から実行する", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  const copy = yaml.indexOf(
    'cp tools/dev-preview/{preview,report,deploy,authorize}.mjs "$RUNNER_TEMP/preview-control/"',
  )
  const checkout = yaml.indexOf("- name: Checkout validated commit")
  const deploy = yaml.indexOf(
    'node "$RUNNER_TEMP/preview-control/deploy.mjs" > "$RUNNER_TEMP/preview.json"',
  )
  assert.ok(copy > 0 && copy < checkout && checkout < deploy)
  assert.doesNotMatch(yaml, /cf previews deploy "\$PREVIEW_NAME"/u)
})

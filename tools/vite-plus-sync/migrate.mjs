import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const dependencies = [
  "package.json",
  "apps/web/package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
]

export function version(text) {
  const match = text.match(/^  vite-plus: ["']?([0-9]+\.[0-9]+\.[0-9]+(?:-[\w.-]+)?)["']?\s*$/m)
  assert.ok(match, "Vite+ catalog must contain an exact version")
  return match[1]
}

export function restoreReleaseAgeExclusions(original, migrated) {
  const block = /^minimumReleaseAgeExclude:[^\n]*\n(?:[ \t]+[^\n]*\n|[ \t]*\n)*/gm
  const previous = original.match(block)?.[0] ?? ""
  if (block.test(migrated)) return migrated.replace(block, () => previous)
  return previous ? migrated.trimEnd() + "\n" + previous : migrated
}

function gitFile(root, ref) {
  return execFileSync("git", ["show", `${ref}:pnpm-workspace.yaml`], {
    cwd: root,
    encoding: "utf8",
  })
}

export function identify(root, base, output) {
  const target = version(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"))
  appendFileSync(output, `changed=${version(gitFile(root, base)) !== target}\nversion=${target}\n`)
}

export function align(root, target) {
  const run = (command, args, cwd = root, env = process.env) =>
    execFileSync(command, args, { cwd, env, stdio: "inherit" })
  run("pnpm", ["install", "--no-frozen-lockfile", "--ignore-scripts"])
  const installed = JSON.parse(
    readFileSync(join(root, "node_modules/vite-plus/package.json"), "utf8"),
  )
  assert.equal(installed.version, target)

  // ソースのimport移行を避け、依存ファイルだけを公式CLIへ渡す。
  const workspace = mkdtempSync(join(tmpdir(), "vite-plus-sync-"))
  try {
    for (const path of [...dependencies, "apps/api/package.json"]) {
      mkdirSync(dirname(join(workspace, path)), { recursive: true })
      cpSync(join(root, path), join(workspace, path))
    }
    run(join(root, "node_modules/.bin/vp"), ["migrate", "--no-interactive"], workspace, {
      ...process.env,
      // migrateが再実行するvpも、同期対象のローカルCLIへ解決する。
      PATH: [join(root, "node_modules/.bin"), process.env.PATH].filter(Boolean).join(delimiter),
      npm_config_ignore_scripts: "true",
    })
    assert.deepEqual(
      readFileSync(join(root, "apps/api/package.json")),
      readFileSync(join(workspace, "apps/api/package.json")),
    )
    for (const path of dependencies) cpSync(join(workspace, path), join(root, path))
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }

  // migrateが追加する公開待機の例外は、このrepoの既存設定へ戻す。
  const catalog = join(root, "pnpm-workspace.yaml")
  writeFileSync(
    catalog,
    restoreReleaseAgeExclusions(gitFile(root, "HEAD"), readFileSync(catalog, "utf8")),
  )
  run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"])

  const require = createRequire(join(root, "package.json"))
  const vp = require("./node_modules/vite-plus/package.json")
  assert.equal(vp.version, target)
  const bundled = createRequire(require.resolve("./node_modules/vite-plus/package.json"))
  const web = createRequire(join(root, "apps/web/package.json"))
  assert.equal(bundled("vitest/package.json").version, vp.dependencies.vitest)
  for (const name of ["vitest", "@vitest/browser-playwright", "@vitest/coverage-v8"]) {
    assert.equal(web(`${name}/package.json`).version, vp.dependencies.vitest, name)
  }
  const webBundled = createRequire(web.resolve("vite-plus/package.json"))
  assert.equal(webBundled("vite/package.json").version, bundled("vite/package.json").version)
  assert.equal(bundled("vite/package.json").name, "@voidzero-dev/vite-plus-core")
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "identify") {
    identify(process.cwd(), process.env.PR_BASE_SHA, process.env.GITHUB_OUTPUT)
  } else if (process.argv[2] === "align") {
    align(process.cwd(), process.env.TARGET_VERSION)
  } else {
    throw new Error("Expected identify or align")
  }
}

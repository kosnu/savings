import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { definePlugin, defineRule } from "vite-plus/lint/plugins"

const webRoot = fileURLToPath(new URL("../../apps/web/", import.meta.url))
const featuresRoot = resolve(webRoot, "src/features")

const publicImports = defineRule({
  meta: {
    messages: {
      usePublicEntry: "別 feature の内部ファイルです。{{feature}} の公開エントリを使ってください。",
    },
  },
  create(context) {
    const [feature, ...filePath] = relative(featuresRoot, context.filename).split(sep)
    if (feature === ".." || filePath.length === 0) return {}

    function checkImport(source) {
      if (source?.type !== "Literal" || typeof source.value !== "string") return

      const [specifier] = source.value.split(/[?#]/, 1)
      const base = specifier.startsWith("/src/") ? webRoot : dirname(context.filename)
      const path = specifier.startsWith("/src/") ? `.${specifier}` : specifier
      if (!/^\.{1,2}(?:\/|$)/.test(path)) return

      const [targetFeature, ...targetPath] = relative(featuresRoot, resolve(base, path)).split(sep)
      if (targetFeature === ".." || targetFeature === feature || targetPath.length === 0) return
      if (targetPath.length === 1 && /^index(?:\.[jt]sx?)?$/.test(targetPath[0])) return

      context.report({
        node: source,
        messageId: "usePublicEntry",
        data: { feature: targetFeature },
      })
    }

    return {
      ImportDeclaration: (node) => checkImport(node.source),
      ExportNamedDeclaration: (node) => checkImport(node.source),
      ExportAllDeclaration: (node) => checkImport(node.source),
      ImportExpression: (node) => checkImport(node.source),
      TSImportType: (node) => checkImport(node.source),
      TSExternalModuleReference: (node) => checkImport(node.expression),
    }
  },
})

export default definePlugin({
  meta: { name: "feature-boundaries" },
  rules: { "public-imports": publicImports },
})

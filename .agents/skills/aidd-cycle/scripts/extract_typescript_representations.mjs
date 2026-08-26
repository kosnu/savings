#!/usr/bin/env node

import process from "node:process";
import { parseSync } from "oxc-parser";

const FORBIDDEN_MODIFIERS = new Set(["fails", "only", "skip", "todo"]);
const ALLOWED_TEST_MODIFIERS = new Set(["concurrent", "each"]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function children(node) {
  if (!node || typeof node !== "object") return [];
  const result = [];
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "range", "span", "start", "end"].includes(key)) continue;
    if (Array.isArray(value)) {
      result.push(...value.filter((entry) => entry && typeof entry.type === "string"));
    } else if (value && typeof value.type === "string") {
      result.push(value);
    }
  }
  return result;
}

function walk(node, visitor) {
  visitor(node);
  for (const child of children(node)) walk(child, visitor);
}

function bindingNames(pattern, output = []) {
  if (!pattern) return output;
  if (pattern.type === "Identifier") {
    output.push(pattern.name);
  } else if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      bindingNames(property.type === "Property" ? property.value : property.argument, output);
    }
  } else if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) bindingNames(element, output);
  } else if (pattern.type === "AssignmentPattern") {
    bindingNames(pattern.left, output);
  } else if (pattern.type === "RestElement") {
    bindingNames(pattern.argument, output);
  }
  return output;
}

function declarationNames(declaration) {
  if (!declaration) return [];
  if (declaration.type === "TSEnumDeclaration" && declaration.const) return [];
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((entry) => bindingNames(entry.id));
  }
  if (
    [
      "ClassDeclaration",
      "FunctionDeclaration",
      "TSEnumDeclaration",
      "TSModuleDeclaration",
    ].includes(declaration.type) &&
    declaration.id
  ) {
    return [declaration.id.name];
  }
  return [];
}

function runtimeExports(program) {
  const names = [];
  const typeBindings = new Set();
  const valueBindings = new Set();
  const importedBindings = new Set();
  for (const statement of program.body) {
    if (
      ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"].includes(statement.type) ||
      (statement.type === "TSEnumDeclaration" && statement.const)
    ) {
      if (statement.id) typeBindings.add(statement.id.name);
      continue;
    }
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) {
        const localName = specifier.local?.name;
        if (!localName) continue;
        importedBindings.add(localName);
        if (statement.importKind === "type" || specifier.importKind === "type") {
          typeBindings.add(localName);
        } else {
          valueBindings.add(localName);
        }
      }
      continue;
    }
    const declaration = statement.type === "ExportNamedDeclaration"
      ? statement.declaration
      : statement;
    if (!declaration || declaration.declare) continue;
    if (
      ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"].includes(declaration.type) ||
      (declaration.type === "TSEnumDeclaration" && declaration.const)
    ) {
      if (declaration.id) typeBindings.add(declaration.id.name);
    } else {
      for (const name of declarationNames(declaration)) valueBindings.add(name);
    }
  }
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration") {
      // Export locators identify named product representations. Story metadata and
      // other default exports are deliberately outside that inventory.
      continue;
    }
    if (statement.type === "ExportAllDeclaration") {
      fail("wildcard re-exports are unsupported in granular representation files");
    }
    if (statement.type !== "ExportNamedDeclaration") continue;
    if (statement.exportKind === "type") continue;
    if (statement.declaration) {
      if (
        ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"].includes(
          statement.declaration.type,
        ) ||
        (statement.declaration.type === "TSEnumDeclaration" &&
          statement.declaration.const) ||
        statement.declaration.declare
      ) {
        continue;
      }
      const declared = declarationNames(statement.declaration);
      if (declared.length === 0) {
        fail("unsupported export syntax in granular representation file");
      }
      names.push(...declared);
      continue;
    }
    if (
      statement.source &&
      (statement.specifiers ?? []).some((specifier) => specifier.exportKind !== "type")
    ) {
      fail("source re-exports are unsupported in granular representation files");
    }
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.exportKind === "type") continue;
      const exportedName = specifier.exported.name ?? specifier.exported.value;
      if (exportedName === "default") continue;
      if (!statement.source) {
        const localName = specifier.local?.name ?? specifier.local?.value;
        if (typeBindings.has(localName) && !valueBindings.has(localName)) continue;
        if (importedBindings.has(localName)) {
          fail(`import-backed re-export is unsupported: ${localName}`);
        }
        if (!valueBindings.has(localName)) {
          fail(`unresolved local export binding: ${localName}`);
        }
      }
      names.push(exportedName);
    }
  }
  return names;
}

function directRunnerImports(program) {
  const tests = new Set();
  const suites = new Set();
  walk(program, (node) => {
    if (
      node.type === "ImportExpression" &&
      literalString(node.source) === "vite-plus/test"
    ) {
      fail("test runner must not use dynamic imports");
    }
    if (
      node.type === "CallExpression" &&
      node.callee.type === "Identifier" &&
      node.callee.name === "require" &&
      literalString(node.arguments[0]) === "vite-plus/test"
    ) {
      fail("test runner must not use require imports");
    }
  });
  for (const statement of program.body) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.source.value !== "vite-plus/test" ||
      statement.importKind === "type"
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.importKind === "type") {
        continue;
      }
      if (specifier.type !== "ImportSpecifier") {
        fail("test runner must use direct named imports");
      }
      const importedName = specifier.imported.name ?? specifier.imported.value;
      if (
        (["test", "it", "describe"].includes(importedName) ||
          ["test", "it", "describe"].includes(specifier.local.name)) &&
        importedName !== specifier.local.name
      ) {
        fail(`test runner binding must not be aliased: ${importedName}`);
      }
      if (["test", "it"].includes(specifier.local.name)) {
        tests.add(specifier.local.name);
      } else if (specifier.local.name === "describe") {
        suites.add(specifier.local.name);
      }
    }
  }
  return { tests, suites };
}

function propertyChain(expression) {
  const modifiers = [];
  let current = expression;
  while (current?.type === "MemberExpression" && !current.computed) {
    if (current.property.type !== "Identifier") return null;
    modifiers.unshift(current.property.name);
    current = current.object;
  }
  return current?.type === "Identifier"
    ? { base: current.name, modifiers }
    : null;
}

function rejectShadowedBindings(program, runnerNames) {
  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") continue;
    walk(statement, (node) => {
      let names = [];
      if (node.type === "VariableDeclarator") names = bindingNames(node.id);
      if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
        names = node.id ? [node.id.name] : [];
      }
      if (
        ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(
          node.type,
        )
      ) {
        names.push(...node.params.flatMap((parameter) => bindingNames(parameter)));
      }
      for (const name of names) {
        if (runnerNames.has(name)) {
          fail(`ambiguous or shadowed test runner binding: ${name}`);
        }
      }
    });
  }
}

function containsRunnerReference(node, runnerNames) {
  function inspect(current, parent = null, parentKey = null) {
    if (!current || typeof current !== "object") return false;
    if (current.type === "Identifier" && runnerNames.has(current.name)) {
      if (
        parent?.type === "MemberExpression" &&
        parentKey === "property" &&
        !parent.computed
      ) {
        return false;
      }
      if (
        ["Property", "MethodDefinition", "PropertyDefinition"].includes(parent?.type) &&
        parentKey === "key" &&
        !parent.computed
      ) {
        return false;
      }
      return true;
    }
    for (const [key, value] of Object.entries(current)) {
      if (["loc", "range", "span", "start", "end"].includes(key)) continue;
      if (Array.isArray(value)) {
        if (value.some((entry) => inspect(entry, current, key))) return true;
      } else if (inspect(value, current, key)) {
        return true;
      }
    }
    return false;
  }
  return inspect(node);
}

function containsAbruptCompletion(node) {
  function inspect(current) {
    if (!current || typeof current !== "object") return false;
    if (["ReturnStatement", "ThrowStatement"].includes(current.type)) return true;
    if (
      ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ClassDeclaration", "ClassExpression"].includes(
        current.type,
      )
    ) {
      return false;
    }
    return children(current).some((child) => inspect(child));
  }
  return inspect(node);
}

function literalString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "StringLiteral") return node.value;
  return null;
}

function requireLiteralTitle(call, label) {
  const title = literalString(call.arguments[0]);
  if (title === null) fail(`${label} must use a literal string name`);
  return title;
}

function parseTestCall(call, testBindings) {
  let chain = propertyChain(call.callee);
  let eachTable = null;
  if (call.callee.type === "CallExpression") {
    chain = propertyChain(call.callee.callee);
    if (chain?.modifiers.at(-1) === "each") eachTable = call.callee.arguments[0];
  }
  if (!chain || !testBindings.has(chain.base)) return null;
  for (const modifier of chain.modifiers) {
    if (FORBIDDEN_MODIFIERS.has(modifier)) {
      fail(`disabled or focused final test case is forbidden: ${modifier}`);
    }
    if (!ALLOWED_TEST_MODIFIERS.has(modifier)) {
      fail(`unsupported final test modifier: ${modifier}`);
    }
  }
  if (chain.modifiers.includes("each")) {
    if (
      !eachTable ||
      eachTable.type !== "ArrayExpression" ||
      eachTable.elements.length === 0 ||
      eachTable.elements.some((element) => element?.type === "SpreadElement")
    ) {
      fail("final test.each requires a statically non-empty array table");
    }
  }
  const title = requireLiteralTitle(call, "final test case");
  const callback = call.arguments[1];
  if (
    !callback ||
    !["ArrowFunctionExpression", "FunctionExpression"].includes(callback.type)
  ) {
    fail("final test case requires an inline function callback");
  }
  if (
    call.arguments
      .slice(1)
      .some((argument) => containsRunnerReference(argument, testBindings))
  ) {
    fail("final test callback must not reference runner bindings");
  }
  return title;
}

function parseSuiteCall(call, suiteBindings) {
  const chain = propertyChain(call.callee);
  if (!chain || !suiteBindings.has(chain.base)) return null;
  for (const modifier of chain.modifiers) {
    if (FORBIDDEN_MODIFIERS.has(modifier)) {
      fail(`disabled or focused final test suite is forbidden: ${modifier}`);
    }
    fail(`unsupported final test suite modifier: ${modifier}`);
  }
  requireLiteralTitle(call, "final test suite");
  const callback = call.arguments[1];
  if (
    !callback ||
    !["ArrowFunctionExpression", "FunctionExpression"].includes(callback.type) ||
    callback.body.type !== "BlockStatement"
  ) {
    fail("final test suite requires an inline block callback");
  }
  return callback.body.body;
}

function registeredTestCases(program) {
  const { tests, suites } = directRunnerImports(program);
  const runnerNames = new Set([...tests, ...suites]);
  if (runnerNames.size === 0) return [];
  rejectShadowedBindings(program, runnerNames);
  const names = [];

  function inspectStatements(statements) {
    let registrationMayBeTerminated = false;
    for (const statement of statements) {
      if (["ImportDeclaration", "EmptyStatement"].includes(statement.type)) continue;
      if (
        registrationMayBeTerminated &&
        containsRunnerReference(statement, runnerNames)
      ) {
        fail("final test registration must not be unreachable");
      }
      if (
        statement.type === "ExpressionStatement" &&
        statement.expression.type === "CallExpression"
      ) {
        const suiteStatements = parseSuiteCall(statement.expression, suites);
        if (suiteStatements) {
          inspectStatements(suiteStatements);
          continue;
        }
        const testName = parseTestCall(statement.expression, tests);
        if (testName !== null) {
          names.push(testName);
          continue;
        }
      }
      if (containsRunnerReference(statement, runnerNames)) {
        fail("final test registration must be top-level or inside a direct describe callback");
      }
      if (containsAbruptCompletion(statement)) registrationMayBeTerminated = true;
    }
  }

  inspectStatements(program.body);
  return names;
}

let input;
try {
  input = JSON.parse(await new Promise((resolve) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { value += chunk; });
    process.stdin.on("end", () => resolve(value));
  }));
} catch (error) {
  fail(`invalid extractor input: ${error.message}`);
}
if (
  !input ||
  typeof input.text !== "string" ||
  typeof input.path !== "string"
) {
  fail("extractor input requires text and path");
}

const extension = input.path.toLowerCase().match(/\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/)?.[0];
const languageByExtension = new Map([
  [".ts", "ts"], [".mts", "ts"], [".cts", "ts"], [".tsx", "tsx"],
  [".js", "js"], [".mjs", "js"], [".cjs", "js"], [".jsx", "jsx"],
]);
const language = languageByExtension.get(extension);
if (!language) fail(`unsupported granular representation extension: ${input.path}`);

const result = parseSync(input.path, input.text, {
  lang: language,
  sourceType: "module",
  astType: "ts",
  showSemanticErrors: true,
});
if (result.errors.length > 0) fail(result.errors[0].message);
const inventory = {
  schema_version: 1,
  exports: runtimeExports(result.program),
  test_cases: registeredTestCases(result.program),
};
process.stdout.write(`${JSON.stringify(inventory)}\n`);

import { defineConfig } from "vite-plus"

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: false,
    trailingComma: "all",
    ignorePatterns: [
      ".vscode/**",
      "coverage/**",
      "apps/web/coverage/**",
      "dist/**",
      "apps/web/dist/**",
      "node_modules/**",
      "storybook-static/**",
      "apps/web/storybook-static/**",
      "generators/**",
      "apps/web/generators/**",
      "public/mockServiceWorker.js",
      "apps/web/public/mockServiceWorker.js",
    ],
    sortImports: {},
  },
  lint: {
    plugins: ["react", "jsx-a11y", "typescript"],
    jsPlugins: [
      {
        name: "react-hooks-js",
        specifier: "eslint-plugin-react-hooks",
      },
    ],
    categories: {
      correctness: "error",
    },
    rules: {
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "warn",
      "react-hooks-js/refs": "error",
      "react-hooks-js/set-state-in-effect": "error",
      "react-hooks-js/immutability": "error",
      "react/no-array-index-key": "error",
      "jsx_a11y/label-has-associated-control": "error",
      "jsx_a11y/no-autofocus": "off",
      "eslint/eqeqeq": "error",
      "eslint/no-duplicate-imports": "error",
      "typescript/prefer-nullish-coalescing": "error",
      "typescript/prefer-optional-chain": "error",
      "typescript/no-explicit-any": "error",
      "typescript/prefer-ts-expect-error": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],
      "typescript/promise-function-async": "error",
      "typescript/no-base-to-string": "error",
      "typescript/restrict-template-expressions": "error",
      "typescript/prefer-promise-reject-errors": "error",
      "typescript/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "typescript/no-import-type-side-effects": "error",
      "typescript/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
      "typescript/no-non-null-assertion": "error",
    },
    settings: {
      "jsx-a11y": {
        components: {
          "TextField.Root": "input",
          DayPicker: "input",
        },
      },
    },
    ignorePatterns: [
      ".vscode/**",
      "coverage/**",
      "apps/web/coverage/**",
      "dist/**",
      "apps/web/dist/**",
      "node_modules/**",
      "storybook-static/**",
      "apps/web/storybook-static/**",
      "generators/**",
      "apps/web/generators/**",
      "public/mockServiceWorker.js",
      "apps/web/public/mockServiceWorker.js",
    ],
    overrides: [
      {
        files: ["**/*.stories.tsx"],
        rules: {
          "react/rules-of-hooks": "off",
          "typescript/no-floating-promises": "off",
        },
      },
      {
        files: ["src/types/database.types.ts", "apps/web/src/types/database.types.ts"],
        rules: {
          "typescript/no-redundant-type-constituents": "off",
        },
      },
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
          "typescript/no-floating-promises": "off",
          "typescript/no-non-null-assertion": "off",
          "typescript/consistent-type-assertions": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
})

---
applyTo: "apps/web/**"
---

# Copilot Instructions for Web Frontend (apps/web/)

## Rules

- Run Web verification from the repository root with `pnpm run web:lint`, `pnpm run web:format-check`, `pnpm run web:typecheck`, and `pnpm --filter web exec vp test run --project unit --project integration --reporter=dot --silent`.
- Run `pnpm --filter web test:storybook --reporter=dot --silent` only when the change affects `browser-test` tagged stories, `apps/web/.storybook-test/`, or Storybook browser-test configuration.
- Use `pnpm install` from the repository root for installing/updating dependencies.
- Add new components manually, following `apps/web/docs/policies/component-structure.md`.

## References

- `apps/web/README.md`
- `apps/web/docs/adr/feature_directory.md`

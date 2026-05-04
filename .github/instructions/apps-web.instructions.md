---
applyTo: "apps/web/**"
---

# Copilot Instructions for Web Frontend (apps/web/)

## Rules

- Run Web verification from the repository root with `pnpm run web:lint`, `pnpm run web:format-check`, `pnpm run web:typecheck`, and `pnpm run web:test`.
- Use `pnpm install` from the repository root for installing/updating dependencies.
- Generate new components with `pnpm --filter web plop` when possible.

## References

- `apps/web/README.md`
- `apps/web/docs/adr/feature_directory.md`

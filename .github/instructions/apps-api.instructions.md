---
applyTo: "apps/api/**"
---

# Copilot Instructions for API Backend (apps/api/)

## Rules

- Manage migrations in `supabase/migrations/*.sql`.
- JWT auth: use custom middleware (`verify_jwt = false` + Hono middleware with jose library for JWKS validation). Do NOT use Supabase's built-in `verify_jwt = true`.

## References

- `apps/api/README.md`
- `apps/api/docs/architecture.md`

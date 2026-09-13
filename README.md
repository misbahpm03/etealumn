# etealumn

Departmental alumni and academic archive platform — a production-quality web
application with three connected surfaces sharing one backend and PostgreSQL
database:

1. **Public department website** (`/`, `/about`, `/alumni`, …)
2. **Authenticated member portal** (`/portal/*`) — students & alumni
3. **Administrative CMS** (`/admin/*`) — moderators & admins

> Status: **Phase 1 — application foundation.** Routes, layouts, provider
> abstractions, and error/loading foundations only. No database, auth, or
> feature functionality yet.

## Stack

- Next.js (App Router) + React + TypeScript (strict)
- Tailwind CSS
- ESLint
- Supabase-compatible, provider-agnostic architecture (Supabase arrives as the
  first provider implementation in later phases)
- Vercel-compatible deployment

## Getting started

```bash
npm install
cp .env.example .env.local   # optional in Phase 1; required from Phase 3
npm run dev                  # http://localhost:3000
```

Useful commands:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm start           # serve the production build
```

Health check: `GET /api/health` returns `{ "status": "ok", ... }`.

## Project structure

```
src/
  app/                 # Routes (App Router)
    (public)/          # Public website routes + layout
    (portal)/          # Member portal routes + layout
    (admin)/           # Admin CMS routes + layout
    api/health/        # Health-check route
    layout.tsx         # Root layout (fonts, metadata, skip link)
    loading.tsx        # Global loading state
    error.tsx          # Global error boundary
    global-error.tsx   # Root-layout error boundary
    not-found.tsx      # Global 404 page
  components/
    ui/                # Reusable primitives (Button, Card, EmptyState, …)
    layout/            # Shells shared by route groups (headers, sidebars)
  features/
    public/            # Public-surface-only config (navigation)
    portal/            # Portal-only config (navigation)
    admin/             # Admin-only config (navigation)
  lib/                 # Cross-cutting helpers (errors, routes, utils)
  services/            # Application layer + composition root (DI seam)
  repositories/        # Repository *interfaces* (no provider code)
  providers/           # Provider *interfaces*: AuthProvider, StorageProvider
  types/               # Shared domain types & enums (no dependencies)
  validations/         # Pure input-validation helpers (no dependencies)
  config/              # Site metadata, typed env access, storage buckets
```

## Architecture rules

1. **Provider-agnostic.** UI, routes, and services depend on repository/provider
   interfaces — never on Supabase directly. Provider implementations will live
   under `src/infrastructure/<provider>/` in later phases.
2. **No Supabase imports** outside the future infrastructure layer.
3. **Authorization is server-side.** UI role checks are UX only; enforcement
   happens in services + PostgreSQL RLS (from Phase 2/3).
4. **No secrets in client code.** Only `NEXT_PUBLIC_*` vars are browser-safe.
   Service-role keys stay server-side.
5. **Surfaces stay separate.** Public/portal/admin logic lives in its own
   `features/<surface>` slice; only genuinely shared UI goes in
   `components/ui`.
6. **Store storage metadata, not URLs.** Business logic records
   provider/bucket/path; signed URLs are minted at access time.

## Environment variables

| Variable                       | Scope  | Required in |
| ------------------------------ | ------ | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | public | Phase 3+    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| public | Phase 3+    |
| `SUPABASE_SERVICE_ROLE_KEY`    | server | Phase 3+    |
| `NEXT_PUBLIC_SITE_URL`         | public | optional    |

See `.env.example`. Typed access lives in `src/config/env.ts`.

## Phase history

- **Phase 1** — Foundation: scaffold, route structure, layouts, provider
  interfaces, env handling, error/loading/404 foundations. No DB, auth, RLS,
  storage, or feature logic.

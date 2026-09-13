# etealumn

Departmental alumni and academic archive platform — a production-quality web
application with three connected surfaces sharing one backend and PostgreSQL
database:

1. **Public department website** (`/`, `/about`, `/alumni`, …)
2. **Authenticated member portal** (`/portal/*`) — students & alumni
3. **Administrative CMS** (`/admin/*`) — moderators & admins

> Status: **Phase 5 — Secure file-storage architecture.** Five private
> buckets (no client storage policies), provider-agnostic storage provider
> with staging→finalize moves, version-immutable document service and gated
> media service, centralized validation. No auth flows, archive/media
> features, or UI yet.

## Stack

- Next.js (App Router) + React + TypeScript (strict)
- Tailwind CSS
- ESLint
- Supabase (PostgreSQL + Auth + Storage) behind provider-agnostic interfaces
- Vercel-compatible deployment

## Getting started

```bash
npm install
cp .env.example .env.local   # optional until Phase 3; see below
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
Dev-only Supabase probe: `GET /api/dev/supabase` (404s in production).

## Project structure

```
src/
  app/                 # Routes (App Router)
    (public)/          # Public website routes + layout
    (portal)/          # Member portal routes + layout
    (admin)/           # Admin CMS routes + layout
    api/health/        # Public liveness probe
    api/dev/supabase/  # Dev-only Supabase status (404 in production)
    layout.tsx         # Root layout (metadata, skip link)
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
  infrastructure/
    supabase/          # Supabase implementations (ONLY place Supabase lives)
      client.ts        # Browser client (anon key, RLS applies)
      server.ts        # Server client (cookies, RLS applies) — server-only
      admin.ts         # Service-role client (bypasses RLS) — server-only, unused
      errors.ts        # Provider → AppError translation + unwrapQuery
      supabase-auth.provider.ts
      supabase-storage.provider.ts
      health.ts        # Connectivity probe (booleans + latency only)
  types/               # Shared domain types & enums (no dependencies)
  validations/         # Pure input-validation helpers (no dependencies)
  config/              # Site metadata, typed env access, storage buckets
supabase/
  migrations/          # Versioned PostgreSQL migrations (source of truth)
docs/
  database.md          # Schema, relationships, constraints, conventions
  security.md          # Authorization model (RLS, grants, helpers)
  storage.md           # Storage architecture (buckets, flows, validation)
```

## Architecture rules

1. **Provider-agnostic.** UI, routes, and services depend on repository/provider
   interfaces — never on Supabase directly. Supabase code lives ONLY under
   `src/infrastructure/supabase/`. Verify with:
   `grep -r "@supabase" src --include="*.ts*" -l` (hits must all be infra).
2. **No Supabase imports** outside the infrastructure layer.
3. **Server/client boundaries.** `server.ts` and `admin.ts` import
   `server-only` and fail the build if pulled into client code. The service
   role is never exposed to the browser; privileged operations stay server-side.
4. **Authorization is server-side.** UI role checks are UX only; enforcement
   happens in services + PostgreSQL RLS (from Phase 3).
5. **No secrets in client code.** Only `NEXT_PUBLIC_*` vars are browser-safe.
   Service-role keys stay server-side.
6. **Errors are translated.** The business layer sees only `AppError`
   subclasses with user-safe messages; provider details stay on `cause` for
   server logs. See `infrastructure/supabase/errors.ts`.
7. **Surfaces stay separate.** Public/portal/admin logic lives in its own
   `features/<surface>` slice; only genuinely shared UI goes in
   `components/ui`.
8. **Store storage metadata, not URLs.** Business logic records
   provider/bucket/path; signed URLs are minted at access time.

### Repository pattern (for future repositories)

Repository classes take a Supabase client via constructor injection and unwrap
every query through `unwrapQuery`, which throws translated `AppError`s:

```ts
async findById(id: Uuid): Promise<SessionUser | null> {
  const row = await unwrapQuery(
    this.client.from("users").select("*").eq("id", id).maybeSingle(),
  );
  return row ? toSessionUser(row) : null;
}
```

No repository implementations exist yet — tables, codegen'd row types, and RLS
arrive in Phase 3.

## Environment variables

| Variable                       | Scope  | Required in |
| ------------------------------ | ------ | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | public | Phase 3+    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| public | Phase 3+    |
| `SUPABASE_SERVICE_ROLE_KEY`    | server | Phase 3+    |
| `NEXT_PUBLIC_SITE_URL`         | public | optional    |

See `.env.example`. Typed access lives in `src/config/env.ts`
(`getSupabasePublicConfig()` throws `ServiceNotConfiguredError` when absent).

## Phase history

- **Phase 1** — Foundation: scaffold, route structure, layouts, provider
  interfaces, env handling, error/loading/404 foundations. No DB, auth, RLS,
  storage, or feature logic.
- **Phase 2** — Supabase infrastructure: `@supabase/ssr` browser/server
  clients, isolated service-role config (unused), `SupabaseAuthProvider` and
  `SupabaseStorageProvider` behind the Phase 1 interfaces, provider→app
  error translation, repository `unwrapQuery` pattern, dev-only status probe.
  Still no schema, RLS, buckets, auth flows, or features.
- **Phase 3** — Database foundation: 7 versioned migrations (7 enums,
  19 tables, 24 FKs, ~60 indexes), document versioning, soft delete,
  append-only audit trigger, shared `updated_at` trigger, category seeds.
  No RLS (Phase 4), no buckets, no auth flows, no features. See
  `docs/database.md`.
- **Phase 4** — Database authorization: deny-by-default RLS on all 19
  tables, 13 authorization helpers, least-privilege (incl. column-level)
  grants, single-source document access rule, safe profile projection
  views. No buckets, no auth flows, no features. See `docs/security.md`.
- **Phase 5** — Secure file-storage architecture: 5 private buckets with
  MIME/size guardrails and zero client storage policies (server-mediated
  up/downloads, short-lived signed URLs); provider-agnostic
  `StorageProvider` with same-bucket `move`; version-immutable document
  storage service and gated media service; centralized validation and
  server-generated paths. No auth flows, no archive/media features, no UI.
  See `docs/storage.md`.

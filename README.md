# Production Management ERP

Base version: costing, product configuration, clients, orders, quotations, and production handover preparation.

## Stack

- Next.js (App Router) + TypeScript
- Supabase PostgreSQL + Prisma
- Auth.js (Credentials)
- next-intl (Ukrainian UI)
- Tailwind CSS

## Setup

1. Copy env template and set the database password:

```bash
cp .env.example .env.local
# also keep .env in sync for Prisma CLI, or export DIRECT_URL/DATABASE_URL
```

2. Fill in:

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres connection strings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key
- `AUTH_SECRET` — random secret

3. Link Supabase (optional CLI):

```bash
npx supabase login
npx supabase link --project-ref dvqrdzbalbelofhjxsth
```

4. Migrate and seed:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Run the app:

```bash
npm run dev
```

Default seed users:

- Admin: `admin@example.com` / `ChangeMe123!`
- Manager: `manager@example.com` / `ChangeMe123!`

## Spec

See [production_management_service_base_spec.md](./production_management_service_base_spec.md).

## Deploy (Railway)

1. Service connects to this GitHub repo (`main`).
2. Set Variables (see `.env.example`):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Postgres connection (Supabase pooled or Railway Postgres) |
| `DIRECT_URL` | Same or direct (for `prisma migrate deploy`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | Public HTTPS URL of the Railway service |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | For product image uploads |
| `APP_TIMEZONE` | `Europe/Kyiv` |

3. Build: `npm run build` (`prisma generate` + `next build`).
4. Start: `npm run start` (`prisma migrate deploy` + `next start`).
5. After first successful deploy, run seed once if the DB is empty:

```bash
railway run npm run db:seed
```

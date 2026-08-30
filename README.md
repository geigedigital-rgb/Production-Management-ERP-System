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

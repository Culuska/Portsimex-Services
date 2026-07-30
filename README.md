# Portsimex Ops & Finance

A combined operational and financial tracking app for Portsimex Services (freight / port services). Track shipments end-to-end and see how they tie into revenue, expenses, and profit.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Prisma ORM (driver adapter: `@prisma/adapter-pg`)
- NextAuth (credentials login, JWT sessions, role-based access: `ADMIN` / `STAFF`)

## Features

- **Dashboard** — active shipments, revenue collected, expenses, net profit, outstanding balances
- **Shipments** — operational jobs (import/export/transshipment/domestic) with status tracking, client/assignee, and per-job revenue/cost/margin
- **Clients** & **Vendors** — contacts you bill and pay
- **Invoices** — line items, status workflow, payment recording, auto balance calculation
- **Expenses** — categorized costs, optionally linked to a vendor and/or shipment for job costing
- **Users** — admin-only user management with role assignment

## Getting started

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (PostgreSQL) and `AUTH_SECRET` (`openssl rand -base64 32`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run migrations and seed demo data:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```
   Seeded logins:
   - Admin: `admin@portsimex.com` / `ChangeMe123!`
   - Staff: `ops@portsimex.com` / `ChangeMe123!`

   Change these passwords (or delete the seeded users) before using this in production.
4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and start
- `npm run lint` — lint the project
- `npx prisma migrate dev` — create/apply migrations during development
- `npx prisma studio` — browse the database

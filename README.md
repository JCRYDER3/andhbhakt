# Andhbhakt.org

A civic accountability platform that cross-references official government announcements against Comptroller and Auditor General (CAG) audit findings — so citizens can see the gap between political promises and ground reality.

**Live site**: [andhbhakt.org](https://andhbhakt.org)

---

## What it does

- **Scheme scorecards** — Every major Govt scheme (2014–present) rated against PIB press releases, CAG audit findings, and independent data (NFHS-5, NCRB, MOSPI, ASER).
- **State governance cards** — 28 states + major UTs scored on integrity, monetary management, and development outcomes.
- **Cabinet minister profiles** — Asset growth, criminal cases, and re-election trends sourced from ECI affidavits via ADR/myneta.info.
- **Manifesto tracker** — Three election terms (2014, 2019, 2024) mapped to delivery evidence term-by-term.
- **Bilingual** — Full Hindi translation across all static data.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5 (`artifacts/api-server`) |
| Frontend | React 19 + Vite + Tailwind CSS (`artifacts/govlens`) |
| Database | PostgreSQL + Drizzle ORM (`lib/db`) |
| Validation | Zod v4 + drizzle-zod (`lib/api-zod`) |
| API codegen | Orval — OpenAPI spec → typed hooks + Zod schemas (`lib/api-spec`) |
| Bot protection | Cloudflare Turnstile + HMAC-signed session cookie |

## Quick start

```bash
# Requires pnpm — https://pnpm.io
pnpm install

# Copy env vars and fill in your values
cp .env.example .env

# Create tables
pnpm --filter @workspace/db run push

# Load seed data (schemes, CAG audits, PIB entries — ~800 rows)
psql "$DATABASE_URL" -f lib/db/seed.sql

# Start the API server (port from $PORT env var)
pnpm --filter @workspace/api-server run dev

# Start the frontend (separate terminal) — http://localhost:3100
pnpm --filter @workspace/govlens run dev
```

The frontend defaults to **port 3100**. Override with `PORT` if needed:

```bash
PORT=3100 pnpm --filter @workspace/govlens run dev
```

UI-only work does not need PostgreSQL. Scheme and CAG chips that call `/api` stay empty until the API is running.

See [DEVELOPMENT.md](DEVELOPMENT.md) for design tokens, layout components, and accessibility notes.

## Environment variables

See [`.env.example`](.env.example) for the full list. Minimum required:

| Variable | When | Description |
|---|---|---|
| `DATABASE_URL` | Always | PostgreSQL connection string |
| `PORT` | Always | API server port (Replit sets this automatically) |
| `SESSION_SECRET` | Production | 64-char hex — signs session cookies. Generate: `openssl rand -hex 32` |
| `ADMIN_TOKEN` | Production | Token for `/api/admin/*` routes (`X-Admin-Token` header) |
| `TURNSTILE_SECRET_KEY` | Production | Cloudflare Turnstile bot-check secret |
| `ALLOWED_ORIGIN` | Production | CORS origin (e.g. `https://govlens.in`) |

## Where things live

```
artifacts/
  api-server/src/
    routes/          Express route handlers
    middlewares/     Auth, rate-limiting, cache, session
    jobs/            Background jobs (news fetcher)
  govlens/src/
    pages/           Frontend page components
    data/            Static civic data — schemes, state facts, ministers, manifestos, CAG reports
lib/
  db/                Drizzle schema + migrations
  api-zod/           Auto-generated Zod schemas
  api-spec/          OpenAPI 3.1 spec (openapi.yaml)
```

## Architecture decisions

**Static data in source files** — scheme details, state facts, minister profiles, manifesto promises, and CAG report narratives live as TypeScript constants in `artifacts/govlens/src/data/`. This makes every data point auditable, diff-able, and contribution-friendly without a CMS. Only dynamic data (live PIB entries, CAG audit records, news) lives in the database.

**Session cookie, not JWT** — The Turnstile gate issues an HMAC-signed cookie. The server refuses to start in production without `SESSION_SECRET`.

**Cloudflare in front** — Production traffic passes through Cloudflare Turnstile + CF-Connecting-IP check + optional origin secret (`CF_ORIGIN_SECRET`). The `cloudflareOnlyMiddleware` is a no-op in development.

**Admin via header only** — `X-Admin-Token` is the only valid admin auth mechanism. Query-string tokens are rejected (they appear in server logs and browser history).

## Data sources

All civic data is sourced from public documents:

- **ECI affidavits** via [ADR](https://adrindia.org) / [myneta.info](https://www.myneta.info)
- **CAG published reports** — [cag.gov.in](https://cag.gov.in)
- **PIB press releases** — [pib.gov.in](https://pib.gov.in)
- **NFHS-5, NCRB, MOSPI, ASER** — as cited per indicator in the source files

## Contributing

1. Fork the repo and clone locally.
2. Copy `.env.example` → `.env` and fill in `DATABASE_URL`, `SESSION_SECRET`, and `ADMIN_TOKEN`.
3. Run `pnpm install` then `pnpm --filter @workspace/db run push`.
4. Data corrections go in `artifacts/govlens/src/data/` — each file has inline source citations.
5. Open a PR with the source URL for any data change.

## License

MIT

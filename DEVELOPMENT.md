# Development

Local notes for running and extending the Andhbhakt.org frontend.

## Run locally

Requires **Node.js 24** and **pnpm**.

```bash
pnpm install
cp .env.example .env
```

Frontend (the site):

```bash
pnpm --filter @workspace/govlens run dev
```

Opens at **http://localhost:3100/**. Vite defaults to 3100 (`artifacts/govlens/vite.config.ts`). Port 3000 is often used by other local apps.

PowerShell:

```powershell
$env:PORT = 3100
pnpm --filter @workspace/govlens run dev
```

API (optional — live schemes, CAG, news, admin):

```bash
# needs PostgreSQL and DATABASE_URL in .env
pnpm --filter @workspace/db run push
psql "$DATABASE_URL" -f lib/db/seed.sql
pnpm --filter @workspace/api-server run dev
```

The API listens on `PORT` from `.env` (example: 8080). No Cloudflare or Turnstile keys are required in development.

### Build

```bash
pnpm --filter @workspace/govlens run build
pnpm --filter @workspace/govlens run serve   # preview, also port 3100 unless PORT is set
pnpm run typecheck
```

## Design tokens

Tokens live in one place:

| File | Role |
|---|---|
| `artifacts/govlens/src/styles/tokens.css` | CSS custom properties (color, type, space, radius, elevation) |
| `artifacts/govlens/src/styles/tokens.ts` | JS mirror for charts / inline styles |
| `artifacts/govlens/src/index.css` | Tailwind `@theme` mapping + skip-link / focus / reduced-motion |

Use semantic classes (`bg-primary`, `text-muted-foreground`, `rounded-lg`) in components. Do not hard-code hex in new UI.

Palette: navy neutrals + saffron primary, tuned so body text and primary-on-white meet WCAG AA.

## Layout components

| Component | Path | Notes |
|---|---|---|
| `Header` | `artifacts/govlens/src/components/header.tsx` | Skip link, logo, desktop nav, mobile menu, language select |
| `Navbar` | same module | Alias of `Header` |
| `Footer` | `artifacts/govlens/src/components/footer.tsx` | Legal + clone strip |
| `Button` | `artifacts/govlens/src/components/ui/button.tsx` | Token-based variants |
| Cards | `artifacts/govlens/src/components/ui/card.tsx` | shadcn card |

`Header` and `Footer` are mounted once in `artifacts/govlens/src/App.tsx`. Pages should not render their own navbar. Page content sits in `<main id="main-content">`.

## Accessibility

- Skip link is the first focusable control.
- Header is a `<header>`; nav has an accessible name.
- Mobile menu: `aria-expanded`, Escape to close, 44px touch targets.
- `:focus-visible` ring uses `--ring`.
- `document.documentElement.lang` follows the language selector (`en` / `hi`).
- Chrome strings live in `artifacts/govlens/src/locales/{en,hi}.json`.

## Images

- Logo in the header has reserved width/height (`fetchpriority=high`).
- Wikipedia avatars use `loading="lazy"` and `decoding="async"`.
- Unused Inter font request was removed from `index.html` so only Space Grotesk + IBM Plex Mono load.

## i18n

`artifacts/govlens/src/i18n.ts` — i18next, persist key `govlens-lang`. Language selector is in the header.

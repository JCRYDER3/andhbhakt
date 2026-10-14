# Ideas ported from jan-score

[jan-score](https://github.com/0xVISHWAJEET/jan-score) is a sibling civic-accountability
project — representative-level scores (MP/MLA/Municipal Councillor/Sarpanch), built
independently but tackling much of the same problem space as this one: turning
scattered official data into an accountable, public score citizens can trust.

This document (idea #10 itself — see below) is the honest record of what was actually
ported into this codebase across PRs #19–#27, and — just as importantly — what was
deliberately left out or deferred. See `docs/SCOPE.md` for the equivalent document
about this repo's own pre-existing scheme/state tracking, which this port doesn't
touch.

## What's fully ported and working

1. **A published, deterministic scoring methodology** (#19) — `artifacts/api-server/src/scoring/`:
   5 weighted dimensions, source-tier + time-decay weighted evidence aggregation, an
   explicit confidence threshold below which a score is suppressed to NR (Not Rated)
   rather than guessed at. `GET /api/methodology` publishes the exact weights and
   grade table — nothing about the formula is hidden.
2. **A human moderator review queue** (#20) — `routes/review_queue.ts`. Every piece
   of evidence an automated connector or the AI extraction agent produces is written
   with `needsReview = true` and is excluded from scoring until a moderator approves
   it.
3. **Right of Reply** (#21) — `routes/official_responses.ts`. A representative's
   response to a specific piece of evidence is stored and shown alongside it, never
   replacing it.
4. **Responsibility Card scope boundaries** (#22) — `responsibility_definitions`
   table + `GET /api/representatives/:id` returns the position's actual
   responsibilities, so nothing scores an official on duties outside their office.
5. **A citizen-rating layer, kept distinct from the evidence score** (#23) —
   `routes/citizen_ratings.ts`, with the soft-damping anti-manipulation engine
   (`scoring/anti-manipulation.ts`) applied at submission time.
6. **Score history + compare** (#24) — `overall_scores` is append-only (a new row
   per recompute, never an update), so `GET /api/representatives/:id/score-history`
   and `GET /api/representatives/compare?ids=1,2,3` both read directly off it. (This
   PR also caught and fixed a real Express route-ordering bug — see its own
   description.)
7. **An anti-conviction-bias guardrail in the AI extraction step** (#25) —
   `ingestion/ai-extract.ts`. The system prompt explicitly forbids treating an
   unproven allegation as a finding of guilt, and the schema itself won't accept
   `VERIFIED` without the source text citing a primary document.
8. **Reading back the immutable audit log + methodology versions** (#26) — the
   `audit_log` table and its writes shipped with #19/#20; this is the first way to
   actually read that history back (`GET /api/admin/audit-log`,
   `GET /api/methodology-versions`).
9. **A uniform interface for adding new data sources** (#27) —
   `ingestion/types.ts`'s `ConnectorResult` + `ingestion/orchestrator.ts`. The
   `data-gov-in` connector is the first implementation; adding another source is one
   new file plus one line in `CONNECTORS`.
10. **This document itself** — the "what's real, what's simplified, what's deferred"
    pattern, applied to the port.

## Simplified by design

- **Citizen identity** (#23): andhbhakt had no user-identity system at all before this
  — only an anonymous Cloudflare-Turnstile session. jan-score's own identity layer is
  Auth.js/NextAuth, which is Next.js-specific and doesn't port to this Express app.
  What's here instead is a small, real email magic-link — a token is issued, hashed,
  single-use, and expires in 15 minutes, and the resulting session cookie is
  HMAC-signed the same way `middlewares/verify-session.ts` already signs the
  anonymous session. **Email delivery itself is not wired up** (no SMTP/Resend/etc.
  integration) — in development the token is returned directly in the API response
  (clearly logged as dev-only); in production the endpoint fails loudly with a 501
  rather than silently pretending to send an email.
- **Ingestion connectors** (#27): only `data-gov-in` was ported. jan-score's MyNeta/ADR
  scraper and eCourts connector are deferred — MyNeta scraping is inherently more
  fragile (HTML structure, not a documented API) and eCourts has no public bulk API
  at all (jan-score's own version is a stub for the same reason).
- **Official-identity verification for Right of Reply** (#21): submitting a response
  is gated behind the same admin token as the review queue, not opened to anyone who
  claims to be the official. Verifying a real official's identity needs an
  out-of-band step (verified government email domain, phone callback) none of these
  PRs attempt to invent.

## Explicitly not ported

- jan-score's own seed data (real representative/party/constituency names), deploy
  config (Vercel, its own domain/cron schedule), and its Next.js/Prisma scaffolding
  itself — only the logic moved, not the framework or the content.
- Promises, Projects, Affidavits, and Electoral Bond Funding tracking — real models
  in jan-score, but genuinely additional scope beyond these 10 ideas; left for a
  future proposal if this direction is kept.
- The 26-letter ABC–XYZ sub-metric framework — a cosmetic labeling layer on top of
  the 5 dimensions, not load-bearing for any of the 10 ideas.

## If you want to extend ingestion further

Match `ConnectorResult` (`artifacts/api-server/src/ingestion/types.ts`), write one
file under `ingestion/connectors/`, and add one line to the `CONNECTORS` array in
`ingestion/orchestrator.ts`. The scoring engine, review queue, and UI need no changes
for a new source — see jan-score's own `docs/SCOPE.md` for the same pattern, which
this codebase now also follows.

## PRs, in merge order

#19 (idea #1) → #20 (idea #2) → #21 (idea #3) → #22 (idea #4) → #23 (idea #5) →
#24 (idea #6) → #25 (idea #7) → #26 (idea #8) → #27 (idea #9) → this one (idea #10).
Each is stacked on the previous — merging out of order will conflict.

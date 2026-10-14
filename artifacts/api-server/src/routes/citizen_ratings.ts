// Citizen identity (email magic-link) + ratings — docs/jan-score-ideas.md
// idea #5: a citizen-rating layer, kept distinct from the evidence-based
// score, one verified email -> one vote per representative/dimension/period,
// with the soft-damping anti-manipulation weight applied at submit time.
//
// andhbhakt has no prior user-identity system (only an anonymous bot-check
// session) — this is a small, real addition, not a stub: a magic link is
// emailed, its token is single-use and expires in 15 minutes, and the
// resulting session cookie is HMAC-signed the same way
// middlewares/verify-session.ts already signs the anonymous session, just
// now carrying a citizenId instead of nothing.
import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import { db, citizensTable, citizenLoginTokensTable, ratingsTable, representativesTable } from "@workspace/db";
import { DIMENSIONS, type Dimension } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { computeRatingWeight } from "../scoring/anti-manipulation";
import { recomputeRepresentativeScore } from "../scoring/recompute";
import { currentReviewPeriod } from "../scoring/constants";

const router = Router();

const CITIZEN_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const CITIZEN_COOKIE = "govlens_citizen";
const CITIZEN_SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_TOKEN_TTL = 15 * 60 * 1000; // 15 minutes

function signCitizenId(citizenId: number): string {
  const sig = createHmac("sha256", CITIZEN_SECRET).update(String(citizenId)).digest("hex");
  return `${citizenId}.${sig}`;
}

function verifyCitizenCookie(raw: string | undefined): number | null {
  if (!raw) return null;
  const dotIdx = raw.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const idPart = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expected = createHmac("sha256", CITIZEN_SECRET).update(idPart).digest("hex");
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  const citizenId = Number(idPart);
  return Number.isInteger(citizenId) && citizenId > 0 ? citizenId : null;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

function isSafeEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email) && email.length <= 254 && !/<|>|'|"/.test(email);
}

// POST /api/citizen/login/request — emails a magic link. In local dev
// (no email sender configured in this diff), the token is returned in the
// JSON response instead of sent, logged clearly as dev-only.
router.post("/citizen/login/request", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email } = (req.body ?? {}) as { email?: string };
  if (typeof email !== "string" || !isSafeEmail(email)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await db.insert(citizenLoginTokensTable).values({
    email: email.toLowerCase(),
    tokenHash,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL),
  });

  if (process.env["NODE_ENV"] !== "production") {
    logger.info({ email, token }, "DEV ONLY: citizen login token (no email sender wired up in this change)");
    res.json({ ok: true, devToken: token });
    return;
  }

  // TODO(next PR): wire an actual email sender (this repo has none yet).
  // The token-issuing/consuming logic below is real; only delivery is
  // deferred, and it fails loudly rather than silently pretending to send.
  logger.warn({ email }, "Citizen login requested but no email sender is configured");
  res.status(501).json({ error: "Email delivery is not configured on this deployment yet." });
});

// POST /api/citizen/login/verify — redeems a magic-link token, creates the
// citizen row if this is their first login, issues the session cookie.
router.post("/citizen/login/verify", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { token } = (req.body ?? {}) as { token?: string };
  if (typeof token !== "string" || token.length < 10) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [row] = await db.select().from(citizenLoginTokensTable).where(eq(citizenLoginTokensTable.tokenHash, tokenHash));

  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    res.status(400).json({ error: "Token is invalid, used, or expired" });
    return;
  }

  await db.update(citizenLoginTokensTable).set({ consumedAt: new Date() }).where(eq(citizenLoginTokensTable.id, row.id));

  let [citizen] = await db.select().from(citizensTable).where(eq(citizensTable.email, row.email));
  if (!citizen) {
    [citizen] = await db.insert(citizensTable).values({ email: row.email }).returning();
  }

  res.cookie(CITIZEN_COOKIE, signCitizenId(citizen!.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: CITIZEN_SESSION_TTL,
    path: "/",
  });
  res.json({ ok: true, email: citizen!.email });
});

// POST /api/representatives/:id/ratings — submit (or update) this period's
// rating. One citizen, one rating per representative/dimension/period,
// enforced by both the DB unique constraint and an upsert here.
router.post("/representatives/:id/ratings", async (req: Request, res: Response): Promise<void> => {
  const citizenId = verifyCitizenCookie(req.cookies?.[CITIZEN_COOKIE]);
  if (!citizenId) {
    res.status(401).json({ error: "Sign in required — POST /api/citizen/login/request then /verify." });
    return;
  }

  const representativeId = Number(req.params["id"]);
  if (!Number.isInteger(representativeId) || representativeId < 1) {
    res.status(400).json({ error: "Invalid representative id" });
    return;
  }

  const { dimension, stars, comment } = (req.body ?? {}) as { dimension?: string; stars?: number; comment?: string };
  if (typeof dimension !== "string" || !DIMENSIONS.includes(dimension as Dimension)) {
    res.status(400).json({ error: `dimension must be one of ${DIMENSIONS.join(", ")}` });
    return;
  }
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    res.status(400).json({ error: "stars must be an integer 1-5" });
    return;
  }
  if (comment !== undefined && (typeof comment !== "string" || comment.length > 1000)) {
    res.status(400).json({ error: "comment must be under 1000 characters" });
    return;
  }

  const [rep] = await db.select({ id: representativesTable.id }).from(representativesTable).where(eq(representativesTable.id, representativeId));
  if (!rep) {
    res.status(404).json({ error: "Representative not found" });
    return;
  }

  const reviewPeriod = currentReviewPeriod();
  const { weight, reason } = await computeRatingWeight(representativeId);
  if (reason) logger.warn({ representativeId, citizenId, reason }, "Rating weight damped by anti-manipulation engine");

  await db
    .insert(ratingsTable)
    .values({
      citizenId,
      representativeId,
      dimension: dimension as Dimension,
      stars,
      comment: comment ?? null,
      reviewPeriod,
      weight,
      flaggedReason: reason,
    })
    .onConflictDoUpdate({
      target: [ratingsTable.citizenId, ratingsTable.representativeId, ratingsTable.dimension, ratingsTable.reviewPeriod],
      set: { stars, comment: comment ?? null, weight, flaggedReason: reason },
    });

  const result = await recomputeRepresentativeScore(representativeId, `citizen:${citizenId}`);
  res.status(201).json({ ok: true, recompute: result });
});

export default router;

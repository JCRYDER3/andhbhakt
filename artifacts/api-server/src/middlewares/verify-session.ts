/**
 * Session verification middleware.
 *
 * Every API request must carry a valid `govlens_sess` cookie that was issued
 * by POST /api/session/verify after the user completed a Cloudflare Turnstile
 * challenge. Without it the request gets a 403 before it reaches any route.
 *
 * Cookie format: `<issuedAt_ms>.<hmac-sha256-hex>`
 * Valid for SESSION_TTL_MS (default 24 h). The HMAC uses SESSION_SECRET so
 * it cannot be forged without the secret.
 *
 * Bypass list:
 *  - POST /api/session/verify  (the endpoint that issues cookies)
 *  - GET  /api/healthz         (deployment health checks)
 *  - GET  /api/health          (local Vite / Windows health probe)
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

// Fail fast at startup in production — never silently fall back to a guessable value.
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required in production. " +
    "Generate one with: openssl rand -hex 32"
  );
}

const SECRET      = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const COOKIE_NAME = "govlens_sess";

// NOTE: these paths are relative to the /api mount point because this
// middleware is applied as app.use("/api", verifySessionMiddleware).
// Express strips the "/api" prefix, so req.path inside here is e.g. "/healthz".
const BYPASS_ROUTES: Array<{ method: string; path: string }> = [
  { method: "POST", path: "/session/verify" },
  { method: "GET",  path: "/healthz" },
  { method: "GET",  path: "/health" },
];

function sign(ts: number): string {
  return createHmac("sha256", SECRET).update(String(ts)).digest("hex");
}

export function issueSessionCookie(res: Response): void {
  const ts  = Date.now();
  const sig = sign(ts);
  res.cookie(COOKIE_NAME, `${ts}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    maxAge:   SESSION_TTL,
    path:     "/",
  });
}

export function verifySessionMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  // Always bypass for specific routes
  const bypass = BYPASS_ROUTES.some(
    (r) => r.method === req.method && req.path === r.path,
  );
  if (bypass) { next(); return; }

  // Development: skip session gate so local dev is not blocked
  if (process.env.NODE_ENV !== "production") { next(); return; }

  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw !== "string") {
    res.status(403).json({ error: "Bot check required — please reload the page." });
    return;
  }

  const dotIdx = raw.lastIndexOf(".");
  if (dotIdx === -1) { res.status(403).json({ error: "Invalid session." }); return; }

  const ts  = Number(raw.slice(0, dotIdx));
  const sig = raw.slice(dotIdx + 1);

  // Reject non-finite, future, or expired timestamps
  const now = Date.now();
  if (!Number.isFinite(ts) || ts > now || now - ts > SESSION_TTL) {
    res.status(403).json({ error: "Session expired — please reload the page." });
    return;
  }

  const expected = sign(ts);

  // Constant-time comparison — prevents timing side-channel attacks
  let valid = false;
  try {
    const sigBuf = Buffer.from(sig,      "hex");
    const expBuf = Buffer.from(expected, "hex");
    valid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  } catch {
    valid = false;
  }

  if (!valid) {
    res.status(403).json({ error: "Invalid session." });
    return;
  }

  next();
}

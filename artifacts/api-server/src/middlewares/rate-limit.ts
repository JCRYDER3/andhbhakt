/**
 * Rate limiting + IP blocklist middleware for GovLens API.
 *
 * Tiers:
 *  - Global  : 200 req / 1 min per IP  (all /api routes, including GETs)
 *  - Write   : 30  req / 1 min per IP  (POST / PATCH / PUT / DELETE only)
 *  - Session : 10  req / 1 min per IP  (POST /api/session/verify — Turnstile)
 *  - Refresh : 10  req / 1 hr  per IP  (AI-powered /refresh endpoint)
 *
 * Blocked IPs receive 403 immediately and are never forwarded.
 */

import { rateLimit, type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// IP blocklist — add known abusers here (persists across restarts in-memory;
// can be extended to a DB table if needed).
// ---------------------------------------------------------------------------
const BLOCKED_IPS = new Set<string>([
  "1.231.81.166",
  "198.244.188.127",
  "2.78.60.10",
  "140.245.66.105",
  "8.222.175.80",
]);

/**
 * Extract the real client IP.
 * Priority: CF-Connecting-IP (set by Cloudflare, cannot be spoofed)
 *           → X-Forwarded-For first hop (Replit proxy)
 *           → socket remote address
 */
function clientIp(req: Request): string {
  // Cloudflare sets this to the true visitor IP and strips any client-supplied value
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      .split(",")[0]
      .trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? "unknown";
}

// ---------------------------------------------------------------------------
// Cloudflare-only middleware
//
// Two-layer check in production:
//  1. X-CF-Origin-Secret — a random token set ONLY by a Cloudflare Transform
//     Rule. Attackers hitting Replit directly won't know this value.
//  2. CF-Connecting-IP  — fallback: Cloudflare always injects this; direct
//     hits typically won't have it (belt-and-suspenders).
//
// To enable layer 1, set the CF_ORIGIN_SECRET env var to the same value you
// configured in Cloudflare → Rules → Transform Rules → Modify Request Header
// (Header: X-CF-Origin-Secret, Value: <secret>).
// ---------------------------------------------------------------------------
export function cloudflareOnlyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.NODE_ENV !== "production") { next(); return; }

  // Health checks come from Replit's infra without CF headers — allow them
  if (req.path === "/api/healthz" || req.path === "/api/health") { next(); return; }

  // Replit's deployment proxy forwards external traffic to us on localhost:8080.
  // It strips custom X- headers, so requests that entered via Cloudflare arrive
  // here from 127.0.0.1 with no origin-secret header. Port 8080 is not
  // externally reachable, so localhost is always Replit's own proxy — safe.
  const remoteAddr = req.socket?.remoteAddress ?? "";
  if (remoteAddr === "127.0.0.1" || remoteAddr === "::ffff:127.0.0.1" || remoteAddr === "::1") {
    next(); return;
  }

  const expectedSecret = process.env.CF_ORIGIN_SECRET;

  if (expectedSecret) {
    // Primary check: secret header injected by Cloudflare Transform Rule
    const incoming = req.headers["x-cf-origin-secret"];
    if (!incoming || incoming !== expectedSecret) {
      logger.warn({ url: req.url, ip: req.socket?.remoteAddress }, "Missing/invalid origin secret — request blocked");
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } else {
    // Fallback when secret not yet configured: check CF-Connecting-IP
    const cfIp = req.headers["cf-connecting-ip"];
    if (!cfIp) {
      logger.warn({ url: req.url, ip: req.socket?.remoteAddress }, "Non-Cloudflare request blocked (no CF-IP)");
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  next();
}

// ---------------------------------------------------------------------------
// Blocklist middleware — runs after Cloudflare gate
// ---------------------------------------------------------------------------
export function blocklistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = clientIp(req);
  if (BLOCKED_IPS.has(ip)) {
    logger.warn({ ip, url: req.url }, "Blocked IP rejected");
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Shared rate-limit options
// ---------------------------------------------------------------------------
const sharedOptions: Partial<Options> = {
  keyGenerator: clientIp,
  standardHeaders: "draft-7", // RateLimit-* headers (RFC 9110)
  legacyHeaders: false,
  handler(req: Request, res: Response) {
    const ip = clientIp(req);
    logger.warn({ ip, url: req.url }, "Rate limit exceeded");
    res.status(429).json({
      error: "Too many requests — please slow down and try again shortly.",
      retryAfter: res.getHeader("RateLimit-Reset"),
    });
  },
};

// ---------------------------------------------------------------------------
// Global limiter — all routes, all methods (defence against scraping / DDoS)
// ---------------------------------------------------------------------------
export const globalLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60_000,
  limit: 200,
});

// ---------------------------------------------------------------------------
// Write limiter — only POST / PATCH / PUT / DELETE
// Stricter than the global tier; skipped for safe read-only methods.
// ---------------------------------------------------------------------------
export const writeLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60_000,
  limit: 30,
  skip: (req) => !["POST", "PATCH", "PUT", "DELETE"].includes(req.method),
});

// ---------------------------------------------------------------------------
// Session limiter — Turnstile verify endpoint
// Tighter than the global tier because each call contacts Cloudflare's API.
// ---------------------------------------------------------------------------
export const sessionLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60_000,
  limit: 10,
});

// ---------------------------------------------------------------------------
// Refresh limiter — AI-powered endpoint is expensive; cap hard
// ---------------------------------------------------------------------------
export const refreshLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 60_000,   // 1 hour
  limit: 10,
});

// ---------------------------------------------------------------------------
// Runtime admin helpers (call from a one-off script or a protected route)
// ---------------------------------------------------------------------------
export function blockIp(ip: string): void {
  BLOCKED_IPS.add(ip);
  logger.info({ ip }, "IP added to blocklist");
}

export function unblockIp(ip: string): void {
  BLOCKED_IPS.delete(ip);
  logger.info({ ip }, "IP removed from blocklist");
}

export function blockedIps(): string[] {
  return [...BLOCKED_IPS];
}

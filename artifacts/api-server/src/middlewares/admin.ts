import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";

// ── Simple token-based admin gate ────────────────────────────────────────────
// Token must be sent in the X-Admin-Token request header — never in the URL
// (query-string tokens appear in server logs and browser history).
export function requireAdmin(req: Request, res: Response): boolean {
  const token    = req.headers["x-admin-token"];
  const expected = process.env["ADMIN_TOKEN"];

  if (!expected || typeof token !== "string") {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  // Constant-time comparison — prevents timing side-channel attacks
  let valid = false;
  try {
    const tokBuf = Buffer.from(token);
    const expBuf = Buffer.from(expected);
    valid = tokBuf.length === expBuf.length && timingSafeEqual(tokBuf, expBuf);
  } catch {
    valid = false;
  }

  if (!valid) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}

// Right of Reply — docs/jan-score-ideas.md idea #3. Any representative (or
// their office) can submit a public response to a specific piece of
// evidence; it's shown alongside the evidence, never replacing it.
//
// Submission is admin-gated (same X-Admin-Token pattern as the review
// queue) rather than open to anyone claiming to be the official — verifying
// a real official's identity needs an out-of-band step (verified email
// domain, phone callback, etc.) this diff doesn't attempt to invent.
import { Router } from "express";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { db, officialResponsesTable, evidenceTable, representativesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const token = req.headers["x-admin-token"];
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || typeof token !== "string") {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
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

const REPLY_WINDOW_DAYS = 21;

// GET /api/representatives/:id/responses — public, no auth: anyone can read
// an official's responses alongside the evidence they address.
router.get("/representatives/:id/responses", async (req: Request, res: Response): Promise<void> => {
  const representativeId = Number(req.params["id"]);
  if (!Number.isInteger(representativeId) || representativeId < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(officialResponsesTable)
    .where(eq(officialResponsesTable.representativeId, representativeId))
    .orderBy(desc(officialResponsesTable.notifiedAt));
  res.json(rows);
});

// POST /api/admin/responses/open — admin opens a reply window for a piece
// of evidence (notifies the official out-of-band; this just records the
// deadline so the UI can show "awaiting response" vs. "window expired").
router.post("/admin/responses/open", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { representativeId, evidenceId } = (req.body ?? {}) as { representativeId?: number; evidenceId?: number };
  if (!Number.isInteger(representativeId) || (representativeId as number) < 1) {
    res.status(400).json({ error: "representativeId is required" });
    return;
  }

  const [rep] = await db.select({ id: representativesTable.id }).from(representativesTable).where(eq(representativesTable.id, representativeId!));
  if (!rep) {
    res.status(404).json({ error: "Representative not found" });
    return;
  }
  if (evidenceId !== undefined) {
    const [ev] = await db.select({ id: evidenceTable.id }).from(evidenceTable).where(eq(evidenceTable.id, evidenceId));
    if (!ev) {
      res.status(404).json({ error: "Evidence not found" });
      return;
    }
  }

  const deadline = new Date(Date.now() + REPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(officialResponsesTable)
    .values({ representativeId: representativeId!, evidenceId: evidenceId ?? null, deadline })
    .returning();

  logger.info({ id: created!.id, representativeId, evidenceId, deadline }, "Right-of-reply window opened");
  res.status(201).json(created);
});

// POST /api/admin/responses/:id/submit — records the official's actual
// response text. Still admin-gated: see the identity-verification note at
// the top of this file for why.
router.post("/admin/responses/:id/submit", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { responseText } = (req.body ?? {}) as { responseText?: string };
  if (typeof responseText !== "string" || responseText.trim().length === 0 || responseText.length > 5000) {
    res.status(400).json({ error: "responseText is required (1-5000 characters)" });
    return;
  }

  const [existing] = await db.select().from(officialResponsesTable).where(eq(officialResponsesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const status = existing.deadline < new Date() ? "WINDOW_EXPIRED" : "SUBMITTED";
  const [updated] = await db
    .update(officialResponsesTable)
    .set({ responseText, status, respondedAt: new Date() })
    .where(eq(officialResponsesTable.id, id))
    .returning();

  res.json(updated);
});

export default router;

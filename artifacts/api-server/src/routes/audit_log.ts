// Reading back the audit log — docs/jan-score-ideas.md idea #8. The
// audit_log table itself and the writes into it (one row per recompute,
// evidence approval/rejection) already shipped in idea #1 (#19) and idea #2
// (#20); this PR is the first way to actually read it back, which is the
// point of an audit log existing at all — proving a past score's formula
// and inputs are provably what they were at the time, not just trusting
// that the write happened.
import { Router } from "express";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { db, auditLogTable, methodologyVersionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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

// GET /api/admin/audit-log?entity=overall_score&entityId=1 — the full,
// unedited history of every write to a scored entity. Admin-gated (same
// X-Admin-Token pattern as the review queue): the audit log itself is
// meant to be publicly auditable eventually, but that's a product decision
// about what to redact for a public-facing view, separate from this PR's
// job of making the data readable at all.
router.get("/admin/audit-log", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const entity = req.query["entity"];
  const entityId = req.query["entityId"];

  const conditions = [];
  if (typeof entity === "string" && entity) conditions.push(eq(auditLogTable.entity, entity));
  if (typeof entityId === "string" && entityId) conditions.push(eq(auditLogTable.entityId, entityId));

  const rows = await db
    .select()
    .from(auditLogTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(200);

  res.json(rows);
});

// GET /api/methodology-versions — every methodology version ever published,
// not just the current one (already summarized in GET /api/methodology).
// Kept as its own endpoint since a full version history (with full
// weights/description per version) is a different shape of question than
// "what's the current formula."
router.get("/methodology-versions", async (req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(methodologyVersionsTable).orderBy(desc(methodologyVersionsTable.effectiveAt));
  res.json(rows);
});

export default router;

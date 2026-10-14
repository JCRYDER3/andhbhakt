// Human moderator review queue for automated evidence — docs/jan-score-ideas.md
// idea #2. Extends this repo's existing admin-token pattern
// (routes/admin_issues.ts) rather than inventing a second auth scheme.
// Nothing an automated connector or the AI extraction agent finds can move a
// public score until a moderator approves it here.
import { Router } from "express";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { db, evidenceTable, sourcesTable, representativesTable, auditLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { recomputeRepresentativeScore } from "../scoring/recompute";

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

// GET /api/admin/evidence-review — list evidence awaiting moderator approval.
router.get("/admin/evidence-review", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const rows = await db
    .select({
      evidence: evidenceTable,
      source: sourcesTable,
      representativeName: representativesTable.name,
    })
    .from(evidenceTable)
    .innerJoin(sourcesTable, eq(sourcesTable.id, evidenceTable.sourceId))
    .innerJoin(representativesTable, eq(representativesTable.id, evidenceTable.representativeId))
    .where(eq(evidenceTable.needsReview, true))
    .orderBy(desc(evidenceTable.loggedAt));

  res.json(rows.map((r) => ({ ...r.evidence, source: r.source, representativeName: r.representativeName })));
});

// POST /api/admin/evidence-review/:id/approve — un-gates one piece of
// evidence and recomputes the representative's score with it included.
router.post("/admin/evidence-review/:id/approve", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db.select().from(evidenceTable).where(eq(evidenceTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(evidenceTable).set({ needsReview: false }).where(eq(evidenceTable.id, id));
    await tx.insert(auditLogTable).values({
      entity: "evidence",
      entityId: String(id),
      action: "approve",
      actor: "moderator",
      beforeJson: { needsReview: true },
      afterJson: { needsReview: false },
    });
  });

  logger.info({ id }, "Evidence approved by moderator");
  const result = await recomputeRepresentativeScore(existing.representativeId, "moderator");
  res.json({ ok: true, recompute: result });
});

// POST /api/admin/evidence-review/:id/reject — permanently keeps the
// evidence out of scoring (the row itself is never deleted, so the audit
// trail of "an automated source proposed this and it was rejected" stays
// intact).
router.post("/admin/evidence-review/:id/reject", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { reason } = (req.body ?? {}) as { reason?: string };

  const [existing] = await db.select().from(evidenceTable).where(eq(evidenceTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.insert(auditLogTable).values({
    entity: "evidence",
    entityId: String(id),
    action: "reject",
    actor: "moderator",
    beforeJson: { needsReview: true },
    afterJson: { needsReview: true, rejected: true, reason: reason ?? null },
  });

  logger.info({ id, reason }, "Evidence rejected by moderator");
  res.json({ ok: true });
});

export default router;

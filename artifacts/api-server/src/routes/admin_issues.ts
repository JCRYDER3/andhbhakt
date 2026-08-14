import { Router } from "express";
import type { Request, Response } from "express";
import { db, issueReportsTable, ISSUE_STATUSES } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

// ── GET /api/admin/issues — list all reports ─────────────────────────────────
router.get("/admin/issues", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const rows = await db
    .select()
    .from(issueReportsTable)
    .orderBy(desc(issueReportsTable.createdAt));

  res.json(rows);
});

// ── PATCH /api/admin/issues/:id — update status ──────────────────────────────
router.patch("/admin/issues/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { status } = req.body as { status?: string };
  if (!status || !ISSUE_STATUSES.includes(status as typeof ISSUE_STATUSES[number])) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const updated = await db
    .update(issueReportsTable)
    .set({ status })
    .where(eq(issueReportsTable.id, id))
    .returning({ id: issueReportsTable.id });

  if (!updated.length) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  logger.info({ id, status }, "Issue report status updated");
  res.json({ ok: true });
});

export default router;

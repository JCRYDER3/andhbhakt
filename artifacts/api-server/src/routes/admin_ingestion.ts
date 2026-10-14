// Admin-gated trigger + history for the ingestion connectors (idea #9) —
// same X-Admin-Token pattern as routes/admin_issues.ts and review_queue.ts.
import { Router } from "express";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { db, ingestionRunsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { runFullIngestion } from "../ingestion/orchestrator";
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

router.get("/admin/ingestion-runs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(ingestionRunsTable).orderBy(desc(ingestionRunsTable.startedAt)).limit(50);
  res.json(rows);
});

router.post("/admin/ingestion-runs/run", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  logger.info("Manual ingestion run triggered from admin panel");
  const summaries = await runFullIngestion("admin:manual");
  res.json({ ok: true, summaries });
});

export default router;

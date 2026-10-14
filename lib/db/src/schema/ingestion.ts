// One row per connector run — docs/jan-score-ideas.md idea #9's uniform
// connector interface writes one of these per invocation, and every
// Evidence row an automated connector produces links back to it for
// traceability.
import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const INGESTION_STATUSES = ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"] as const;
export type IngestionStatus = (typeof INGESTION_STATUSES)[number];
export const ingestionStatusEnum = pgEnum("ingestion_status", INGESTION_STATUSES);

export const ingestionRunsTable = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  connector: text("connector").notNull(), // e.g. "data-gov-in", "ai-extraction"
  status: ingestionStatusEnum("status").notNull().default("RUNNING"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  recordsProcessed: integer("records_processed").notNull().default(0),
  recordsFlagged: integer("records_flagged").notNull().default(0),
  errorLog: text("error_log"),
  triggeredBy: text("triggered_by").notNull(), // "cron" | "admin:<id>"
});

export const insertIngestionRunSchema = createInsertSchema(ingestionRunsTable).omit({ id: true });
export type InsertIngestionRun = z.infer<typeof insertIngestionRunSchema>;
export type IngestionRun = typeof ingestionRunsTable.$inferSelect;

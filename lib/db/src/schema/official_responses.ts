// Right of Reply, ported from jan-score (docs/jan-score-ideas.md idea #3).
// A scored representative (or their office) can submit a public response to
// a specific piece of evidence, shown alongside it rather than replacing it.
import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { representativesTable } from "./representatives";
import { evidenceTable } from "./evidence";

export const RESPONSE_STATUSES = ["PENDING", "SUBMITTED", "WINDOW_EXPIRED"] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];
export const responseStatusEnum = pgEnum("response_status", RESPONSE_STATUSES);

export const officialResponsesTable = pgTable("official_responses", {
  id: serial("id").primaryKey(),
  representativeId: integer("representative_id").notNull().references(() => representativesTable.id),
  evidenceId: integer("evidence_id").references(() => evidenceTable.id),
  responseText: text("response_text"),
  status: responseStatusEnum("status").notNull().default("PENDING"),
  notifiedAt: timestamp("notified_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
});

export const insertOfficialResponseSchema = createInsertSchema(officialResponsesTable).omit({
  id: true,
  notifiedAt: true,
});
export type InsertOfficialResponse = z.infer<typeof insertOfficialResponseSchema>;
export type OfficialResponse = typeof officialResponsesTable.$inferSelect;

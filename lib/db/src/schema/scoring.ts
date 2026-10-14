// Scoring outputs + the methodology-versioning/audit-log trust layer, ported
// from jan-score. Idea #1 (deterministic, published methodology): the
// methodology_versions table is what makes the formula auditable rather
// than an opaque number, and every score row is tagged with the exact
// version that was in effect when it was computed.
import { pgTable, serial, text, integer, real, timestamp, jsonb, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { representativesTable } from "./representatives";
import { dimensionEnum } from "./evidence";

export const FLAGS = ["GREEN", "YELLOW", "ORANGE", "RED", "GREY"] as const;
export type Flag = (typeof FLAGS)[number];
export const flagEnum = pgEnum("flag", FLAGS);

// Every score formula ever published, never deleted or edited in place. A
// new version is a new row; old scores keep pointing at the version that
// was in effect when they were computed.
export const methodologyVersionsTable = pgTable("methodology_versions", {
  id: serial("id").primaryKey(),
  version: text("version").notNull().unique(), // e.g. "v1.0"
  effectiveAt: timestamp("effective_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  weights: jsonb("weights").$type<Record<string, number>>().notNull(),
});

// Cached, recomputed dimension score. score = null means NR (Not Rated) —
// the engine is never allowed to invent a number it isn't confident in.
export const dimensionScoresTable = pgTable(
  "dimension_scores",
  {
    id: serial("id").primaryKey(),
    representativeId: integer("representative_id").notNull().references(() => representativesTable.id),
    dimension: dimensionEnum("dimension").notNull(),
    score: real("score"),
    confidence: real("confidence").notNull(), // 0-1
    evidenceCount: integer("evidence_count").notNull(),
    citizenScore: real("citizen_score"),
    evidenceScore: real("evidence_score"),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
    methodologyVersion: text("methodology_version").notNull().references(() => methodologyVersionsTable.version),
  },
  (table) => [
    unique("dimension_scores_rep_dim_version_unique").on(
      table.representativeId,
      table.dimension,
      table.methodologyVersion
    ),
  ]
);

// One row per (representative, period), never updated after the period
// closes — so score history and a future compare view both read directly
// off this table with no separate "history" table needed.
export const overallScoresTable = pgTable(
  "overall_scores",
  {
    id: serial("id").primaryKey(),
    representativeId: integer("representative_id").notNull().references(() => representativesTable.id),
    index: real("index"), // null => NR
    grade: text("grade"), // "A+".."F" or "NR"
    flag: flagEnum("flag").notNull(),
    confidence: real("confidence").notNull(),
    methodologyVersion: text("methodology_version").notNull().references(() => methodologyVersionsTable.version),
    periodLabel: text("period_label").notNull(), // e.g. "2026"
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("overall_scores_rep_period_idx").on(table.representativeId, table.periodLabel)]
);

// Append-only. Every write to a scored entity is recorded here in addition
// to whatever table it actually touched; rows are never updated or deleted
// by application code — so a past score's formula is provably what it was
// at the time it was published.
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    entity: text("entity").notNull(), // e.g. "evidence", "overall_score"
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // "create" | "update" | "approve" | "reject" | "recompute"
    actor: text("actor").notNull(), // "system" | "citizen:<id>" | "moderator"
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_log_entity_idx").on(table.entity, table.entityId)]
);

export const insertMethodologyVersionSchema = createInsertSchema(methodologyVersionsTable).omit({ id: true });
export type InsertMethodologyVersion = z.infer<typeof insertMethodologyVersionSchema>;
export type MethodologyVersion = typeof methodologyVersionsTable.$inferSelect;

export const insertDimensionScoreSchema = createInsertSchema(dimensionScoresTable).omit({ id: true, computedAt: true });
export type InsertDimensionScore = z.infer<typeof insertDimensionScoreSchema>;
export type DimensionScore = typeof dimensionScoresTable.$inferSelect;

export const insertOverallScoreSchema = createInsertSchema(overallScoresTable).omit({ id: true, computedAt: true });
export type InsertOverallScore = z.infer<typeof insertOverallScoreSchema>;
export type OverallScore = typeof overallScoresTable.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogTable.$inferSelect;

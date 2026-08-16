import { pgTable, serial, text, integer, bigint, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Candidate-level affidavit data from ECI affidavits, digitized by ADR (myneta.info).
// One row per candidate per election — the same person appears once per contest.
export const politiciansTable = pgTable(
  "politicians",
  {
    id: serial("id").primaryKey(),
    // ADR's candidate_id — stable only within one election's myneta subsite
    mynetaId: integer("myneta_id").notNull(),
    election: text("election").notNull(), // e.g. "Lok Sabha 2024"
    electionYear: integer("election_year").notNull(),
    name: text("name").notNull(),
    party: text("party").notNull(),
    constituency: text("constituency").notNull(),
    state: text("state").notNull(),
    isWinner: boolean("is_winner").notNull().default(false),
    criminalCases: integer("criminal_cases").notNull().default(0),
    education: text("education"),
    age: integer("age"),
    // Absolute rupees as declared in the affidavit (nulls = not disclosed)
    totalAssetsInr: bigint("total_assets_inr", { mode: "number" }),
    liabilitiesInr: bigint("liabilities_inr", { mode: "number" }),
    sourceUrl: text("source_url").notNull(), // myneta.info candidate page (citation)
  },
  (t) => [uniqueIndex("politicians_election_myneta_idx").on(t.election, t.mynetaId)],
);

export const insertPoliticianSchema = createInsertSchema(politiciansTable).omit({ id: true });
export type InsertPolitician = z.infer<typeof insertPoliticianSchema>;
export type Politician = typeof politiciansTable.$inferSelect;

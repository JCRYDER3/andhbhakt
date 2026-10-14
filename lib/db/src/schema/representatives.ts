// Representative-level civic entities, ported from jan-score's Prisma model
// — kept as a separate domain from this repo's existing scheme/state
// tracking, since a scheme and an elected representative are genuinely
// different things to score. See docs/jan-score-ideas.md (idea #1).
import { pgTable, serial, text, integer, timestamp, jsonb, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const POSITION_TYPES = ["MP", "MLA", "MUNICIPAL_COUNCILLOR", "SARPANCH"] as const;
export type PositionType = (typeof POSITION_TYPES)[number];
export const positionTypeEnum = pgEnum("position_type", POSITION_TYPES);

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  abbreviation: text("abbreviation"),
});

export const constituenciesTable = pgTable("constituencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: positionTypeEnum("type").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode"),
});

export const representativesTable = pgTable(
  "representatives",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    position: positionTypeEnum("position").notNull(),
    constituencyId: integer("constituency_id").notNull().references(() => constituenciesTable.id),
    partyId: integer("party_id").references(() => partiesTable.id),
    education: text("education"),
    profession: text("profession"),
    termStart: timestamp("term_start", { withTimezone: true }),
    termEnd: timestamp("term_end", { withTimezone: true }),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // A real person can't legitimately hold the same seat twice — jan-score
    // found this missing as a DB constraint caused real production
    // duplicates under concurrent writes (see its schema.prisma comment on
    // this exact unique index). Enforced here from day one.
    unique("representatives_name_constituency_unique").on(table.name, table.constituencyId),
  ]
);

// Static definition of what each position type is actually responsible for
// — prevents scoring a Sarpanch on national highways, etc.
// (docs/jan-score-ideas.md idea #4, "Responsibility Card").
export const responsibilityDefinitionsTable = pgTable("responsibility_definitions", {
  id: serial("id").primaryKey(),
  position: positionTypeEnum("position").notNull().unique(),
  title: text("title").notNull(),
  items: jsonb("items").$type<string[]>().notNull(),
  indicators: jsonb("indicators").$type<string[]>().notNull(),
});

export const insertResponsibilityDefinitionSchema = createInsertSchema(responsibilityDefinitionsTable).omit({
  id: true,
});
export type InsertResponsibilityDefinition = z.infer<typeof insertResponsibilityDefinitionSchema>;
export type ResponsibilityDefinition = typeof responsibilityDefinitionsTable.$inferSelect;

export const insertPartySchema = createInsertSchema(partiesTable).omit({ id: true });
export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof partiesTable.$inferSelect;

export const insertConstituencySchema = createInsertSchema(constituenciesTable).omit({ id: true });
export type InsertConstituency = z.infer<typeof insertConstituencySchema>;
export type Constituency = typeof constituenciesTable.$inferSelect;

export const insertRepresentativeSchema = createInsertSchema(representativesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRepresentative = z.infer<typeof insertRepresentativeSchema>;
export type Representative = typeof representativesTable.$inferSelect;

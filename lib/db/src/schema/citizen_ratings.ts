// Minimal citizen identity + ratings, ported from jan-score's idea #5
// (a citizen-rating layer kept distinct from the evidence-based score).
//
// andhbhakt currently has no user-identity system at all — only an
// anonymous Cloudflare-Turnstile-gated session (see
// middlewares/verify-session.ts). jan-score's own identity system is
// Auth.js/NextAuth, which is Next.js-specific and doesn't port to this
// Express app. Rather than silently reuse the anonymous session for
// "one citizen, one vote" (which it cannot actually enforce — anyone can
// pass the bot check repeatedly), this adds a small, real email
// magic-link verification, reusing the same HMAC-signed-token approach
// verify-session.ts already established in this codebase, just now tied
// to an email identity instead of an anonymous bot check.
import { pgTable, serial, text, integer, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { representativesTable } from "./representatives";
import { dimensionEnum } from "./evidence";

export const citizensTable = pgTable("citizens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One-time magic-link tokens. A token is looked up by its SHA-256 hash
// (never stored in plaintext, same reasoning as never storing a password in
// plaintext) and is single-use: consumedAt is set the moment it's redeemed.
export const citizenLoginTokensTable = pgTable("citizen_login_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    citizenId: integer("citizen_id").notNull().references(() => citizensTable.id),
    representativeId: integer("representative_id").notNull().references(() => representativesTable.id),
    dimension: dimensionEnum("dimension").notNull(),
    stars: integer("stars").notNull(), // 1-5
    comment: text("comment"),
    reviewPeriod: text("review_period").notNull(), // e.g. "2026" — one rating per citizen/rep/dimension/period
    // Soft-damping anti-manipulation weight (0-1), ported from jan-score's
    // src/lib/anti-manipulation.ts — see src/scoring/anti-manipulation.ts
    // in this repo for the ported computeRatingWeight().
    weight: real("weight").notNull().default(1.0),
    flaggedReason: text("flagged_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("ratings_citizen_rep_dim_period_unique").on(
      table.citizenId,
      table.representativeId,
      table.dimension,
      table.reviewPeriod
    ),
  ]
);

export const insertCitizenSchema = createInsertSchema(citizensTable).omit({ id: true, createdAt: true });
export type InsertCitizen = z.infer<typeof insertCitizenSchema>;
export type Citizen = typeof citizensTable.$inferSelect;

export const insertCitizenLoginTokenSchema = createInsertSchema(citizenLoginTokensTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCitizenLoginToken = z.infer<typeof insertCitizenLoginTokenSchema>;
export type CitizenLoginToken = typeof citizenLoginTokensTable.$inferSelect;

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({
  id: true,
  createdAt: true,
  weight: true,
  flaggedReason: true,
});
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;

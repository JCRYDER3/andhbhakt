// Ported from jan-score's src/lib/scoring/constants.ts (docs/jan-score-ideas.md
// idea #1 — a published, deterministic scoring methodology). Same weights,
// same thresholds, same grade table — this is the real formula jan-score
// runs, not a re-derivation.
import type { Dimension, SourceTier } from "@workspace/db";
import type { Flag } from "@workspace/db";

export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  ACCOUNTABILITY: 0.25,
  DELIVERY: 0.25,
  TRANSPARENCY: 0.2,
  INTEGRITY: 0.2,
  CITIZEN_SENTIMENT: 0.1,
};

export const DIMENSION_LABELS: Record<Dimension, string> = {
  ACCOUNTABILITY: "Accountability",
  DELIVERY: "Delivery",
  TRANSPARENCY: "Transparency",
  INTEGRITY: "Integrity / Evidence",
  CITIZEN_SENTIMENT: "Citizen Sentiment",
};

export const SOURCE_TIER_WEIGHTS: Record<SourceTier, number> = {
  TIER1_PRIMARY_STATUTORY: 1.0,
  TIER2_JUDICIAL_AUDIT: 0.95,
  TIER3_SECONDARY_VERIFIED: 0.7,
  TIER4_CITIZEN_EVIDENCE: 0.5,
  TIER5_UNVERIFIED: 0.1,
};

// Exponential time-decay half-life in days for evidence recency weighting.
export const DECAY_HALF_LIFE_DAYS = 730;

// Below this AI confidence, a score is suppressed and shown as NR (Not Rated)
// — the engine is never allowed to invent a number it isn't confident in.
export const CONFIDENCE_SUPPRESSION_THRESHOLD = 0.35;

export const CURRENT_METHODOLOGY_VERSION = "v1.0";

export interface GradeFlag {
  grade: string;
  flag: Flag;
  meaning: string;
}

export const GRADE_TABLE: { min: number; grade: string; flag: Flag; meaning: string }[] = [
  { min: 95, grade: "A+", flag: "GREEN", meaning: "Exceptional; exemplary compliance, execution, and delivery." },
  { min: 90, grade: "A", flag: "GREEN", meaning: "Excellent performance across all constitutional duties." },
  { min: 80, grade: "B+", flag: "GREEN", meaning: "Very good; minor execution delays or missing disclosures." },
  { min: 70, grade: "B", flag: "YELLOW", meaning: "Good; solid performance with average session participation." },
  { min: 60, grade: "C+", flag: "YELLOW", meaning: "Acceptable; noticeable under-utilization of local funds." },
  { min: 50, grade: "C", flag: "ORANGE", meaning: "Needs improvement; low participation in proceedings." },
  { min: 40, grade: "D", flag: "ORANGE", meaning: "Poor; delivery failure or systematic non-responsiveness." },
  { min: 25, grade: "E", flag: "RED", meaning: "Serious concern; formal charges framed by a court of law." },
  { min: 0, grade: "F", flag: "RED", meaning: "Critical failure; judicial conviction recorded or duties abandoned." },
];

export function gradeForIndex(index: number | null): GradeFlag {
  if (index === null) {
    return { grade: "NR", flag: "GREY", meaning: "Not rated; insufficient verifiable data." };
  }
  const row = GRADE_TABLE.find((r) => index >= r.min) ?? GRADE_TABLE[GRADE_TABLE.length - 1]!;
  return { grade: row.grade, flag: row.flag, meaning: row.meaning };
}

/** Current review period label for score-history buckets — one per calendar year. */
export function currentReviewPeriod(now: Date = new Date()): string {
  return String(now.getFullYear());
}

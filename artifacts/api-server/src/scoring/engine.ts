// Ported from jan-score's src/lib/scoring/engine.ts — pure functions, no DB
// access, so the port is a straight type swap (Prisma model types ->
// Drizzle-inferred types) with the formulas themselves untouched.
//
// This PR covers the evidence-only half of the formula. A later PR (idea #5,
// citizen ratings) extends computeDimensionScore to also blend in a
// citizen-rating component — jan-score's real formula weights evidence 80%/
// ratings 20% within a dimension once ratings exist.
import type { Dimension, Evidence, Source } from "@workspace/db";
import { CONFIDENCE_SUPPRESSION_THRESHOLD, DECAY_HALF_LIFE_DAYS, DIMENSION_WEIGHTS, SOURCE_TIER_WEIGHTS } from "./constants";

type EvidenceWithSource = Evidence & { source: Source };

/**
 * Time-decay factor: exponential decay with the configured half-life, so
 * recent conduct outweighs old evidence without discarding it entirely.
 * S_j = sum(raw_i * w_src_i * decay(t_i)) / sum(w_src_i * decay(t_i))
 */
function decayFactor(eventDate: Date, now: Date): number {
  const elapsedDays = Math.max(0, (now.getTime() - eventDate.getTime()) / 86_400_000);
  return Math.pow(0.5, elapsedDays / DECAY_HALF_LIFE_DAYS);
}

export interface DimensionResult {
  dimension: Dimension;
  score: number | null; // null => NR
  confidence: number; // 0-1
  evidenceScore: number | null;
  evidenceCount: number;
}

/** Computes a single dimension's evidence-weighted score. */
export function computeDimensionScore(
  dimension: Dimension,
  evidence: EvidenceWithSource[],
  now: Date = new Date()
): DimensionResult {
  const relevant = evidence.filter((e) => e.dimension === dimension);

  let weightedSum = 0;
  let weightTotal = 0;
  const tierWeightsSeen: number[] = [];

  for (const e of relevant) {
    const srcWeight = SOURCE_TIER_WEIGHTS[e.source.tier];
    const decay = decayFactor(e.eventDate ?? e.loggedAt, now);
    const w = srcWeight * decay;
    weightedSum += e.rawScore * w;
    weightTotal += w;
    tierWeightsSeen.push(srcWeight);
  }

  const evidenceScore = weightTotal > 0 ? weightedSum / weightTotal : null;
  let score = evidenceScore;

  // AI Confidence Index: grows with corroborating evidence volume/quality,
  // shrinks with contradiction (wide spread of raw scores across sources).
  const confidence = computeConfidence(relevant.map((e) => e.rawScore), tierWeightsSeen);

  if (score !== null && confidence < CONFIDENCE_SUPPRESSION_THRESHOLD) {
    score = null; // suppressed -> NR, never let an automated finding invent a public score
  }

  return { dimension, score, confidence, evidenceScore, evidenceCount: relevant.length };
}

function computeConfidence(rawScores: number[], tierWeights: number[]): number {
  if (rawScores.length === 0) return 0;

  const avgTierWeight = tierWeights.length > 0 ? tierWeights.reduce((a, b) => a + b, 0) / tierWeights.length : 0.3;

  const volumeFactor = Math.min(1, Math.log2(rawScores.length + 1) / Math.log2(11)); // saturates ~10 items

  let varianceFactor = 1;
  if (rawScores.length > 1) {
    const mean = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
    const variance = rawScores.reduce((a, b) => a + (b - mean) ** 2, 0) / rawScores.length;
    const stddev = Math.sqrt(variance);
    varianceFactor = Math.max(0.2, 1 - stddev / 100); // high disagreement across sources lowers confidence
  }

  return Math.max(0, Math.min(1, avgTierWeight * 0.5 + volumeFactor * 0.3 + varianceFactor * 0.2));
}

export interface OverallResult {
  index: number | null;
  confidence: number;
  dimensions: DimensionResult[];
}

/** Composite Overall Public Performance Index — weighted sum of the 5 dimensions. */
export function computeOverallIndex(dimensions: DimensionResult[]): OverallResult {
  let weightedSum = 0;
  let weightTotal = 0;
  let confSum = 0;
  let confCount = 0;

  for (const d of dimensions) {
    const w = DIMENSION_WEIGHTS[d.dimension];
    if (d.score !== null) {
      weightedSum += d.score * w;
      weightTotal += w;
    }
    confSum += d.confidence * w;
    confCount += w;
  }

  const index = weightTotal > 0 ? weightedSum / weightTotal : null;
  const confidence = confCount > 0 ? confSum / confCount : 0;

  return { index, confidence, dimensions };
}

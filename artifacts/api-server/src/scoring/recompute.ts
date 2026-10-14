// Ported from jan-score's src/lib/scoring/recompute.ts (Prisma -> Drizzle).
// Deterministic: same evidence always produces the same outputs, and every
// recompute writes an audit-log entry (part of idea #1's published,
// auditable methodology — the audit_log table itself is the subject of a
// later, dedicated PR, but recompute needs to write to it from day one for
// the methodology to actually be auditable).
import { db, evidenceTable, sourcesTable, ratingsTable, dimensionScoresTable, overallScoresTable, auditLogTable } from "@workspace/db";
import type { Dimension } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computeDimensionScore, computeOverallIndex } from "./engine";
import { CURRENT_METHODOLOGY_VERSION, currentReviewPeriod, gradeForIndex } from "./constants";

const ALL_DIMENSIONS: Dimension[] = ["ACCOUNTABILITY", "DELIVERY", "TRANSPARENCY", "INTEGRITY", "CITIZEN_SENTIMENT"];

export async function recomputeRepresentativeScore(representativeId: number, actor = "system") {
  // needsReview evidence is held out of scoring until a moderator approves
  // it (see a later PR's review queue) — AI-discovered claims never
  // directly move a public score.
  const evidenceRows = await db
    .select({ evidence: evidenceTable, source: sourcesTable })
    .from(evidenceTable)
    .innerJoin(sourcesTable, eq(sourcesTable.id, evidenceTable.sourceId))
    .where(and(eq(evidenceTable.representativeId, representativeId), eq(evidenceTable.needsReview, false)));

  const evidence = evidenceRows.map((r) => ({ ...r.evidence, source: r.source }));
  const ratings = await db.select().from(ratingsTable).where(eq(ratingsTable.representativeId, representativeId));

  const now = new Date();
  const dimensionResults = ALL_DIMENSIONS.map((d) => computeDimensionScore(d, evidence, ratings, now));
  const overall = computeOverallIndex(dimensionResults);
  const { grade, flag } = gradeForIndex(overall.index);
  const periodLabel = currentReviewPeriod(now);

  await db.transaction(async (tx) => {
    for (const d of dimensionResults) {
      await tx
        .insert(dimensionScoresTable)
        .values({
          representativeId,
          dimension: d.dimension,
          score: d.score,
          confidence: d.confidence,
          evidenceCount: d.evidenceCount,
          citizenScore: d.citizenScore,
          evidenceScore: d.evidenceScore,
          methodologyVersion: CURRENT_METHODOLOGY_VERSION,
        })
        .onConflictDoUpdate({
          target: [dimensionScoresTable.representativeId, dimensionScoresTable.dimension, dimensionScoresTable.methodologyVersion],
          set: {
            score: d.score,
            confidence: d.confidence,
            evidenceCount: d.evidenceCount,
            citizenScore: d.citizenScore,
            evidenceScore: d.evidenceScore,
            computedAt: now,
          },
        });
    }

    // overallScoresTable is append-only: a new row per recompute, never an
    // update to a prior period's row — this is what a later PR's score
    // history view reads directly.
    const [overallRecord] = await tx
      .insert(overallScoresTable)
      .values({
        representativeId,
        index: overall.index,
        grade,
        flag,
        confidence: overall.confidence,
        methodologyVersion: CURRENT_METHODOLOGY_VERSION,
        periodLabel,
      })
      .returning();

    await tx.insert(auditLogTable).values({
      entity: "overall_score",
      entityId: String(overallRecord!.id),
      action: "recompute",
      actor,
      afterJson: { index: overall.index, grade, flag, confidence: overall.confidence, dimensions: dimensionResults },
    });
  });

  return { overall, dimensionResults, grade, flag };
}

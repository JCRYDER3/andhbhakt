// Soft-Damping anti-manipulation engine, ported from jan-score's
// src/lib/anti-manipulation.ts (docs/jan-score-ideas.md idea #5's
// anti-brigading mechanism, Prisma -> Drizzle).
//
// Never deletes a citizen's rating — instead reduces the statistical weight
// of ratings that look like a coordinated spike, so the underlying rating
// stays visible but its effect on the computed score is neutralized.
//
// This is a simplified, single-signal (submission velocity) version of a
// fuller three-signal design (velocity + device/network clustering +
// semantic homogeneity) — device fingerprinting and NLP similarity
// clustering need infrastructure out of scope here, same honest trade-off
// jan-score itself documents for this exact mechanism.
import { db, ratingsTable } from "@workspace/db";
import { and, gte, lt, eq, count } from "drizzle-orm";

export async function computeRatingWeight(
  representativeId: number,
  now: Date = new Date()
): Promise<{ weight: number; reason: string | null }> {
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const baselineStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [[recent], [baseline]] = await Promise.all([
    db
      .select({ n: count() })
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.representativeId, representativeId),
          gte(ratingsTable.createdAt, windowStart),
          lt(ratingsTable.createdAt, now)
        )
      ),
    db
      .select({ n: count() })
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.representativeId, representativeId),
          gte(ratingsTable.createdAt, baselineStart),
          lt(ratingsTable.createdAt, windowStart)
        )
      ),
  ]);

  const recentCount = recent?.n ?? 0;
  const baselineCount = baseline?.n ?? 0;
  const baselineDailyAvg = baselineCount / 29;
  const velocityRatio = baselineDailyAvg > 0 ? recentCount / baselineDailyAvg : recentCount > 5 ? 5 : 1;

  // >500% deviation from the rolling baseline triggers hard damping.
  if (velocityRatio >= 5 && recentCount >= 5) {
    return {
      weight: 0.15,
      reason: `velocity_anomaly: ${recentCount} ratings/24h vs baseline ${baselineDailyAvg.toFixed(1)}/day`,
    };
  }
  if (velocityRatio >= 3 && recentCount >= 3) {
    return {
      weight: 0.5,
      reason: `elevated_velocity: ${recentCount} ratings/24h vs baseline ${baselineDailyAvg.toFixed(1)}/day`,
    };
  }
  return { weight: 1.0, reason: null };
}

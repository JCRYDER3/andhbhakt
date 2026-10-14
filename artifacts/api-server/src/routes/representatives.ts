// Representative profiles + the published methodology — ported from
// jan-score (docs/jan-score-ideas.md idea #1).
import { Router } from "express";
import type { Request, Response } from "express";
import { db, representativesTable, constituenciesTable, partiesTable, responsibilityDefinitionsTable, dimensionScoresTable, overallScoresTable, methodologyVersionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { DIMENSION_WEIGHTS, DIMENSION_LABELS, SOURCE_TIER_WEIGHTS, CURRENT_METHODOLOGY_VERSION, GRADE_TABLE } from "../scoring/constants";
import { recomputeRepresentativeScore } from "../scoring/recompute";

const router = Router();

async function representativeSummary(id: number) {
  const [rep] = await db
    .select({
      id: representativesTable.id,
      name: representativesTable.name,
      position: representativesTable.position,
      photoUrl: representativesTable.photoUrl,
      bio: representativesTable.bio,
      constituencyId: representativesTable.constituencyId,
      constituencyName: constituenciesTable.name,
      state: constituenciesTable.state,
      partyId: representativesTable.partyId,
      partyName: partiesTable.name,
    })
    .from(representativesTable)
    .leftJoin(constituenciesTable, eq(constituenciesTable.id, representativesTable.constituencyId))
    .leftJoin(partiesTable, eq(partiesTable.id, representativesTable.partyId))
    .where(eq(representativesTable.id, id));
  return rep;
}

router.get("/representatives", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: representativesTable.id,
      name: representativesTable.name,
      position: representativesTable.position,
      constituencyName: constituenciesTable.name,
      state: constituenciesTable.state,
      partyName: partiesTable.name,
    })
    .from(representativesTable)
    .leftJoin(constituenciesTable, eq(constituenciesTable.id, representativesTable.constituencyId))
    .leftJoin(partiesTable, eq(partiesTable.id, representativesTable.partyId));
  res.json(rows);
});

router.get("/representatives/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rep = await representativeSummary(id);
  if (!rep) {
    res.status(404).json({ error: "Representative not found" });
    return;
  }

  // Idea #4 (Responsibility Card): the position's actual scope, so nothing
  // scores this representative on duties outside their office.
  const [responsibility] = await db
    .select()
    .from(responsibilityDefinitionsTable)
    .where(eq(responsibilityDefinitionsTable.position, rep.position));

  const dimensionScores = await db
    .select()
    .from(dimensionScoresTable)
    .where(and(eq(dimensionScoresTable.representativeId, id), eq(dimensionScoresTable.methodologyVersion, CURRENT_METHODOLOGY_VERSION)));

  const [latestOverall] = await db
    .select()
    .from(overallScoresTable)
    .where(eq(overallScoresTable.representativeId, id))
    .orderBy(desc(overallScoresTable.computedAt))
    .limit(1);

  res.json({ ...rep, responsibilityCard: responsibility ?? null, dimensionScores, overall: latestOverall ?? null });
});

// The published, auditable methodology. No secrets: this is exactly the
// formula the scoring engine runs.
router.get("/methodology", async (req: Request, res: Response): Promise<void> => {
  const versions = await db.select().from(methodologyVersionsTable).orderBy(desc(methodologyVersionsTable.effectiveAt));
  res.json({
    currentVersion: CURRENT_METHODOLOGY_VERSION,
    dimensionWeights: DIMENSION_WEIGHTS,
    dimensionLabels: DIMENSION_LABELS,
    sourceTierWeights: SOURCE_TIER_WEIGHTS,
    grades: [
      ...GRADE_TABLE.map(({ grade, flag, meaning }) => ({ grade, flag, meaning })),
      { grade: "NR", flag: "GREY" as const, meaning: "Not rated; insufficient verifiable data." },
    ],
    versions,
  });
});

// Triggers a recompute for one representative — used by future PRs (the
// review queue after approving evidence, ingestion connectors after a run).
router.post("/representatives/:id/recompute", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rep = await representativeSummary(id);
  if (!rep) {
    res.status(404).json({ error: "Representative not found" });
    return;
  }
  const result = await recomputeRepresentativeScore(id, "system");
  res.json(result);
});

export default router;

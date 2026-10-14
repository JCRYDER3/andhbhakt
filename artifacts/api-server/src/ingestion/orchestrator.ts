// Ported from jan-score's src/lib/ingestion/orchestrator.ts (Prisma ->
// Drizzle). This IS idea #9's "registered in one place": adding a new
// connector means writing one file matching ConnectorResult and adding one
// line to CONNECTORS below — nothing else in this codebase changes.
import { db, ingestionRunsTable, representativesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runDataGovInIngestion } from "./connectors/data-gov-in";
import { recomputeRepresentativeScore } from "../scoring/recompute";
import type { ConnectorResult } from "./types";

const CONNECTORS: { name: string; run: (ingestionRunId: number) => Promise<ConnectorResult> }[] = [
  { name: "data-gov-in", run: runDataGovInIngestion },
  // AI extraction (ingestion/ai-extract.ts, idea #7) isn't listed here —
  // unlike the other connectors, it needs a specific (representative,
  // source, rawText) input per call rather than running unattended over a
  // whole dataset, so it's invoked directly from wherever a text passage is
  // available (e.g. a future news/press-release connector), not swept in a
  // blind loop here.
];

export async function runFullIngestion(triggeredBy: string) {
  const summaries: { connector: string; recordsProcessed: number; recordsFlagged: number; errors: string[] }[] = [];

  for (const connector of CONNECTORS) {
    const [run] = await db.insert(ingestionRunsTable).values({ connector: connector.name, triggeredBy, status: "RUNNING" }).returning();

    try {
      const result = await connector.run(run!.id);
      await db
        .update(ingestionRunsTable)
        .set({
          status: result.errors.length > 0 ? "PARTIAL" : "SUCCESS",
          finishedAt: new Date(),
          recordsProcessed: result.recordsProcessed,
          recordsFlagged: result.recordsFlagged,
          errorLog: result.errors.join("\n") || null,
        })
        .where(eq(ingestionRunsTable.id, run!.id));
      summaries.push({ connector: connector.name, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.update(ingestionRunsTable).set({ status: "FAILED", finishedAt: new Date(), errorLog: message }).where(eq(ingestionRunsTable.id, run!.id));
      summaries.push({ connector: connector.name, recordsProcessed: 0, recordsFlagged: 0, errors: [message] });
    }
  }

  const reps = await db.select({ id: representativesTable.id }).from(representativesTable);
  for (const rep of reps) {
    await recomputeRepresentativeScore(rep.id, `ingestion:${triggeredBy}`);
  }

  return summaries;
}

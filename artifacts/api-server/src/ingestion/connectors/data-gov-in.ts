// Ported from jan-score's src/lib/ingestion/connectors/data-gov-in.ts
// (Prisma -> Drizzle). Generic connector for the Government of India's Open
// Government Data (OGD) platform — api.data.gov.in, a real, officially
// documented REST API (free registration at data.gov.in/user/register).
//
// Dataset "resource IDs" are catalog-specific and change over time, so this
// connector is configured per-deployment via DATA_GOV_IN_RESOURCES — a JSON
// array the operator fills in after finding the relevant dataset. No
// resource ID is hardcoded here, to avoid the connector silently doing
// nothing (or erroring) against a fabricated endpoint.
import { db, sourcesTable, constituenciesTable, representativesTable, evidenceTable } from "@workspace/db";
import type { Dimension } from "@workspace/db";
import { ilike, eq } from "drizzle-orm";
import { politeFetch } from "../fetch";
import type { ConnectorResult } from "../types";

interface ResourceConfig {
  resourceId: string;
  label: string;
  matchField: string; // field in the API response used to match a constituency name
  amountField: string;
  dimension: Dimension;
}

function loadResourceConfigs(): ResourceConfig[] {
  const raw = process.env["DATA_GOV_IN_RESOURCES"];
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

interface DataGovInRecord {
  [key: string]: string | number;
}

async function fetchResource(resourceId: string, apiKey: string, limit = 100): Promise<DataGovInRecord[]> {
  const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=${limit}`;
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`data.gov.in HTTP ${res.status} for resource ${resourceId}`);
  const json = (await res.json()) as { records?: DataGovInRecord[] };
  return json.records ?? [];
}

const DATA_GOV_SOURCE_NAME = "data.gov.in — Open Government Data Platform";

export async function runDataGovInIngestion(ingestionRunId: number): Promise<ConnectorResult> {
  const apiKey = process.env["DATA_GOV_IN_API_KEY"];
  const configs = loadResourceConfigs();
  const errors: string[] = [];

  if (!apiKey) {
    return { recordsProcessed: 0, recordsFlagged: 0, errors: ["DATA_GOV_IN_API_KEY not configured — skipped."] };
  }
  if (configs.length === 0) {
    return { recordsProcessed: 0, recordsFlagged: 0, errors: ["No DATA_GOV_IN_RESOURCES configured — nothing to ingest. See docs/jan-score-ideas.md."] };
  }

  let [source] = await db.select().from(sourcesTable).where(eq(sourcesTable.name, DATA_GOV_SOURCE_NAME));
  if (!source) {
    [source] = await db
      .insert(sourcesTable)
      .values({
        name: DATA_GOV_SOURCE_NAME,
        tier: "TIER1_PRIMARY_STATUTORY",
        url: "https://data.gov.in",
        description: "Official Government of India open datasets (budgets, scheme utilization, audits).",
      })
      .returning();
  }

  let recordsProcessed = 0;
  let recordsFlagged = 0;

  for (const cfg of configs) {
    try {
      const records = await fetchResource(cfg.resourceId, apiKey);
      for (const rec of records) {
        const matchValue = String(rec[cfg.matchField] ?? "").trim();
        if (!matchValue) {
          recordsFlagged += 1;
          continue;
        }

        const [rep] = await db
          .select({ id: representativesTable.id })
          .from(representativesTable)
          .innerJoin(constituenciesTable, eq(constituenciesTable.id, representativesTable.constituencyId))
          .where(ilike(constituenciesTable.name, matchValue))
          .limit(1);
        if (!rep) {
          recordsFlagged += 1;
          continue;
        }

        const amount = Number(rec[cfg.amountField]);
        if (Number.isNaN(amount)) {
          recordsFlagged += 1;
          continue;
        }

        await db.insert(evidenceTable).values({
          representativeId: rep.id,
          dimension: cfg.dimension,
          title: cfg.label,
          description: `Auto-ingested from data.gov.in resource ${cfg.resourceId}: ${JSON.stringify(rec).slice(0, 500)}`,
          rawScore: Math.max(0, Math.min(100, amount)),
          sourceId: source!.id,
          claimStatus: "VERIFIED",
          needsReview: true, // government open-data rows still get a human sanity check before scoring
          ingestionRunId,
        });
        recordsProcessed += 1;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { recordsProcessed, recordsFlagged, errors };
}

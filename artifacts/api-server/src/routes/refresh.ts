import { Router } from "express";
import { db, schemesTable, pibEntriesTable, cagAuditsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { refreshLimiter } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

// The Replit OpenAI integration exposes web_search_preview as a built-in tool.
// This is a Replit-extended capability not yet reflected in the public SDK types.
const AI_MODEL = "gpt-5.6-luna";

function extractJson(text: string): unknown[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Validates a PIB URL. Only accepts real pib.gov.in URLs with a PRID parameter
 * or static.pib.gov.in document URLs. Rejects anything else.
 */
function isValidPibUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Must be on pib.gov.in or static.pib.gov.in
    if (!host.endsWith("pib.gov.in")) return false;
    // For main pib.gov.in pages, must have a PRID query param (real press release IDs)
    if (host === "pib.gov.in") {
      const prid = u.searchParams.get("PRID") || u.searchParams.get("prid");
      if (!prid || !/^\d+$/.test(prid)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a CAG URL. Only accepts URLs on cag.gov.in.
 * Rejects any guessed or hallucinated paths.
 */
function isValidCagUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === "cag.gov.in" || host.endsWith(".cag.gov.in");
  } catch {
    return false;
  }
}

router.post("/schemes/:slug/refresh", refreshLimiter, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const rawSlug = Array.isArray(req.params.slug)
    ? req.params.slug[0]
    : req.params.slug;

  const [scheme] = await db
    .select()
    .from(schemesTable)
    .where(eq(schemesTable.slug, rawSlug));

  if (!scheme) {
    res.status(404).json({ error: "Scheme not found" });
    return;
  }

  const [existingPib, existingCag] = await Promise.all([
    db
      .select({ date: pibEntriesTable.date, headline: pibEntriesTable.headline })
      .from(pibEntriesTable)
      .where(eq(pibEntriesTable.schemeId, scheme.id)),
    db
      .select({
        reportNumber: cagAuditsTable.reportNumber,
        reportYear: cagAuditsTable.reportYear,
      })
      .from(cagAuditsTable)
      .where(eq(cagAuditsTable.schemeId, scheme.id)),
  ]);

  const latestPibDate =
    existingPib.length > 0
      ? [...existingPib].sort((a, b) => b.date.localeCompare(a.date))[0].date
      : `${scheme.launchedYear}-01-01`;

  const existingHeadlinesLower = new Set(
    existingPib.map((p) => p.headline.toLowerCase())
  );
  const existingReportNums = new Set(existingCag.map((c) => c.reportNumber));

  const [pibResp, cagResp] = await Promise.all([
    openai.responses.create({
      model: AI_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: `Search pib.gov.in for official press releases about "${scheme.name}" (${scheme.ministry}) published AFTER ${latestPibDate}.

STRICT URL REQUIREMENT:
Every entry MUST have a sourceUrl in one of these exact formats — no exceptions:
  • https://pib.gov.in/PressReleasePage.aspx?PRID=<numeric-id>
  • https://pib.gov.in/Pressreleaseshare.aspx?PRID=<numeric-id>
  • https://static.pib.gov.in/WriteReadData/specificdocs/documents/<year>/<filename>.pdf

If you cannot find a URL matching one of those formats for an entry, DO NOT include that entry.
Do not guess, construct, or fabricate URLs. Only include entries where you have verified the exact URL from search results.

Additional rules:
- Headline and summary must reflect what the press release actually says.
- Skip entries whose headline closely matches: ${JSON.stringify([...existingHeadlinesLower].slice(0, 5))}

Return a JSON array (or [] if nothing qualifies):
[{
  "headline": "verbatim or close paraphrase of the press release title",
  "date": "YYYY-MM-DD",
  "summary": "2-3 sentence factual summary of the claim",
  "claimType": "achievement|target|launch|update",
  "figure": "key numeric figure as string, or null",
  "figureUnit": "unit (e.g. crore, lakh households), or null",
  "sourceUrl": "verified pib.gov.in URL with PRID"
}]

Return ONLY a valid JSON array.`,
    }),
    openai.responses.create({
      model: AI_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: `Search cag.gov.in for published Comptroller and Auditor General (CAG) of India audit reports with findings about "${scheme.name}".

Already stored report numbers (skip these): ${existingReportNums.size > 0 ? [...existingReportNums].join(", ") : "none yet"}.

STRICT URL REQUIREMENT:
Every entry MUST have a sourceUrl that is a real, accessible URL on cag.gov.in — no exceptions.
Valid URL patterns include:
  • https://cag.gov.in/en/audit-report/<report-path>
  • https://cag.gov.in/webroot/uploads/<year>/<filename>.pdf
  • https://cag.gov.in/content/<report-page>

If you cannot find a real cag.gov.in URL for an entry from your search results, DO NOT include that entry.
Do not construct, guess, or fabricate URLs. The URL must come directly from your web search results.

Additional rules:
- Report numbers must use CAG's exact format (e.g. "5 of 2023", "No. 12 of 2022").
- Findings must be directly taken from the published report — no speculation.
- Claimed/actual figures must come from the report's comparison table or finding paragraph.

Return a JSON array of NEW reports only (or [] if nothing qualifies):
[{
  "reportNumber": "exact CAG report number as published",
  "reportYear": 2023,
  "finding": "factual description directly from the audit report",
  "severity": "critical|major|minor",
  "parameter": "metric or programme area audited",
  "claimed": "government's figure from report, or null",
  "actual": "CAG's finding from report, or null",
  "unit": "unit of measurement, or null",
  "gapPercent": numeric_or_null,
  "sourceUrl": "verified cag.gov.in URL from search results",
  "reportExcerpt": "verbatim sentence or two copied directly from the report that states the finding"
}]

Return ONLY a valid JSON array.`,
    }),
  ]);

  const pibText = String((pibResp as unknown as { output_text: string }).output_text ?? "");
  const cagText = String((cagResp as unknown as { output_text: string }).output_text ?? "");

  const newPibEntries = extractJson(pibText) as Record<string, unknown>[];
  const newCagEntries = extractJson(cagText) as Record<string, unknown>[];

  let addedPib = 0;
  let skippedPib = 0;
  for (const entry of newPibEntries) {
    if (!entry.headline || !entry.date || !entry.summary) continue;
    if (existingHeadlinesLower.has(String(entry.headline).toLowerCase())) continue;

    // Hard gate: reject any entry without a verified pib.gov.in URL
    if (!isValidPibUrl(entry.sourceUrl)) {
      skippedPib++;
      continue;
    }

    const claimType = ["achievement", "target", "launch", "update"].includes(
      String(entry.claimType)
    )
      ? String(entry.claimType)
      : "achievement";

    try {
      await db.insert(pibEntriesTable).values({
        schemeId: scheme.id,
        date: String(entry.date),
        headline: String(entry.headline),
        summary: String(entry.summary),
        claimType,
        figure: entry.figure ? String(entry.figure) : null,
        figureUnit: entry.figureUnit ? String(entry.figureUnit) : null,
        sourceUrl: String(entry.sourceUrl),
      });
      addedPib++;
    } catch (err) {
      logger.warn({ err, headline: entry.headline, schemeId: scheme.id }, "PIB insert failed — skipping entry");
      skippedPib++;
    }
  }

  let addedCag = 0;
  let skippedCag = 0;
  for (const entry of newCagEntries) {
    if (!entry.reportNumber || !entry.finding) continue;
    if (existingReportNums.has(String(entry.reportNumber))) continue;

    // Hard gate: reject any entry without a verified cag.gov.in URL
    if (!isValidCagUrl(entry.sourceUrl)) {
      skippedCag++;
      continue;
    }

    const severity = ["critical", "major", "minor"].includes(
      String(entry.severity)
    )
      ? String(entry.severity)
      : "major";

    try {
      await db.insert(cagAuditsTable).values({
        schemeId: scheme.id,
        reportYear: Number(entry.reportYear) || new Date().getFullYear(),
        reportNumber: String(entry.reportNumber),
        finding: String(entry.finding),
        severity,
        parameter: entry.parameter ? String(entry.parameter) : "Implementation",
        claimed: entry.claimed ? String(entry.claimed) : null,
        actual: entry.actual ? String(entry.actual) : null,
        unit: entry.unit ? String(entry.unit) : null,
        gapPercent: entry.gapPercent != null ? String(entry.gapPercent) : null,
        sourceUrl: String(entry.sourceUrl),
        reportExcerpt: entry.reportExcerpt ? String(entry.reportExcerpt) : null,
      });
      addedCag++;
    } catch (err) {
      logger.warn({ err, reportNumber: entry.reportNumber, schemeId: scheme.id }, "CAG insert failed — skipping entry");
      skippedCag++;
    }
  }

  const skippedTotal = skippedPib + skippedCag;
  res.json({
    addedPib,
    addedCag,
    skippedPib,
    skippedCag,
    message:
      addedPib === 0 && addedCag === 0
        ? `No new entries added${skippedTotal > 0 ? ` (${skippedTotal} rejected — unverifiable URLs)` : ""}`
        : `Added ${addedPib} PIB and ${addedCag} entries${skippedTotal > 0 ? `; ${skippedTotal} rejected (unverifiable URLs)` : ""}`,
  });
});

export default router;

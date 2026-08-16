#!/usr/bin/env node
/**
 * MyNeta Affidavit Crawler — Lok Sabha 2024
 *
 * Scrapes candidate affidavit data (criminal cases, education, age, assets,
 * liabilities) for all ~8,300 LS 2024 candidates from myneta.info:
 *   1. One page per constituency (543 pages) — has age + winner flag.
 *   2. The paginated "candidates analyzed" summary (~417 pages) — the
 *      authoritative candidate list; catches candidates missing from
 *      constituency pages (state resolved via constituency map, falling
 *      back to the candidate detail page for ambiguous names).
 *
 * Data lineage: ECI affidavits (affidavitarchive.nic.in, scanned PDFs)
 *   → digitized by Association for Democratic Reforms (ADR)
 *   → published at myneta.info. ADR states the data is public domain;
 *   attribute as "ADR / myneta.info, based on ECI affidavits".
 *
 * Output:
 *   lib/db/data/politicians-ls2024.json                  (canonical, committed)
 *   lib/db/seed_politicians.sql                          (psql-loadable seed)
 *   artifacts/govlens/src/data/politicians-ls2024.json   (slim, minified frontend copy)
 *
 * Raw HTML is cached in scripts/.myneta-cache/ (gitignored) so re-runs
 * don't re-hit ADR's servers.
 *
 * Usage:
 *   node scripts/crawl-myneta.mjs            # crawl (uses cache when present)
 *   node scripts/crawl-myneta.mjs --fresh    # ignore cache, re-fetch
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ELECTION_SLUG = 'LokSabha2024';
const ELECTION_NAME = 'Lok Sabha 2024';
const ELECTION_YEAR = 2024;
const BASE = `https://www.myneta.info/${ELECTION_SLUG}`;
const OUT_JSON = join(__dir, '../lib/db/data/politicians-ls2024.json');
const OUT_SQL = join(__dir, '../lib/db/seed_politicians.sql');
const OUT_FRONTEND = join(__dir, '../artifacts/govlens/src/data/politicians-ls2024.json');
const CACHE_DIR = join(__dir, '.myneta-cache', ELECTION_SLUG);
const CONCURRENCY = 4; // be gentle — ADR is a nonprofit
const REQUEST_DELAY_MS = 200;
const FRESH = process.argv.includes('--fresh');

// ── Polite cached fetch ───────────────────────────────────────────────────────
async function fetchHtml(url, cacheKey, retries = 3) {
  const cachePath = join(CACHE_DIR, `${cacheKey}.html`);
  if (!FRESH && existsSync(cachePath)) return readFileSync(cachePath, 'utf-8');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GovLensCrawler/1.0; +https://andhbhakt.org)' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const html = await res.text();
        writeFileSync(cachePath, html);
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
        return html;
      }
      if (res.status === 404) return null;
    } catch { /* retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  return null;
}

async function pool(tasks, limit, fn) {
  const results = new Array(tasks.length).fill(null);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try { results[i] = await fn(tasks[i], i); } catch { /* null */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── Text helpers ──────────────────────────────────────────────────────────────
function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;?/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// "NORTH WEST DELHI (SC)" → "North West Delhi (SC)"; keeps (SC)/(ST)/(NCT) uppercase
function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, c => c.toUpperCase())
    .replace(/\((sc|st|nct|ut)\)/gi, m => m.toUpperCase())
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bOf\b/g, 'of');
}

// "Rs 19,29,46,528 ~ 19 Crore+" → 192946528 (absolute rupees); null if absent
function parseRupees(cellHtml) {
  const text = stripTags(cellHtml);
  const m = text.match(/Rs\s*([\d,]+)/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// ── Parse the election index page → constituency list grouped by state ────────
function parseConstituencies(html) {
  const constituencies = [];
  // States are dropdown buttons: onclick="handle_dropdown('item', 'N')"> STATE NAME <span
  const stateBlockRe = /handle_dropdown\('item',\s*'\d+'\)">\s*([^<]+?)\s*<span[\s\S]*?<div id=item_\d+[^>]*>([\s\S]*?)<\/div>/g;
  let sm;
  while ((sm = stateBlockRe.exec(html)) !== null) {
    const state = titleCase(sm[1].trim());
    const block = sm[2];
    const linkRe = /href=index\.php\?action=show_candidates&constituency_id=(\d+)[^>]*>([^<]+)<\/a>/g;
    let lm;
    while ((lm = linkRe.exec(block)) !== null) {
      constituencies.push({
        id: parseInt(lm[1], 10),
        name: titleCase(stripTags(lm[2])),
        state,
      });
    }
  }
  return constituencies;
}

// ── Parse one constituency page → candidate rows ──────────────────────────────
function parseCandidates(html, constituency) {
  const candidates = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const row = rm[1];
    const idM = row.match(/candidate\.php\?candidate_id=(\d+)[^>]*>([\s\S]*?)<\/a>/);
    if (!idM) continue;

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)(?=<td[^>]*>|$)/g)].map(m => m[1]);
    // Columns: SNo | Candidate | Party | Criminal Cases | Education | Age | Total Assets | Liabilities
    if (cells.length < 8) continue;

    const criminalText = stripTags(cells[3]);
    const ageText = stripTags(cells[5]);

    candidates.push({
      mynetaId: parseInt(idM[1], 10),
      name: stripTags(idM[2]),
      isWinner: /> ?Winner ?</i.test(cells[1]) || /\bWinner\b/.test(stripTags(cells[1])),
      party: stripTags(cells[2]),
      criminalCases: /^\d+$/.test(criminalText) ? parseInt(criminalText, 10) : 0,
      education: stripTags(cells[4]) || null,
      age: /^\d+$/.test(ageText) ? parseInt(ageText, 10) : null,
      totalAssetsInr: parseRupees(cells[6]),
      liabilitiesInr: parseRupees(cells[7]),
      constituency: constituency.name,
      state: constituency.state,
      sourceUrl: `${BASE}/candidate.php?candidate_id=${idM[1]}`,
    });
  }
  return candidates;
}

// ── Parse the "candidates analyzed" summary listing ───────────────────────────
// Columns: SNo | Candidate | Constituency | Party | Criminal Case | Education | Total Assets | Liabilities
function parseSummaryRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const row = rm[1];
    const idM = row.match(/candidate\.php\?candidate_id=(\d+)[^>]*>([\s\S]*?)<\/a>/);
    if (!idM) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)(?=<td[^>]*>|$)/g)].map(m => m[1]);
    if (cells.length < 8) continue;
    const criminalText = stripTags(cells[4]);
    rows.push({
      mynetaId: parseInt(idM[1], 10),
      name: stripTags(idM[2]),
      constituencyRaw: stripTags(cells[2]).toUpperCase(),
      party: stripTags(cells[3]),
      criminalCases: /^\d+$/.test(criminalText) ? parseInt(criminalText, 10) : 0,
      education: stripTags(cells[5]) || null,
      totalAssetsInr: parseRupees(cells[6]),
      liabilitiesInr: parseRupees(cells[7]),
    });
  }
  return rows;
}

// Candidate detail page <title>: "Name(Party):Constituency- NEW DELHI(DELHI (NCT)) - Affidavit..."
function parseStateFromDetail(html) {
  const m = html.match(/Constituency-\s*([^()]+?)\s*\((.*)\)\s*-\s*Affidavit/);
  return m ? titleCase(m[2].trim()) : null;
}

// ── SQL seed generation ───────────────────────────────────────────────────────
function sqlString(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function generateSeedSql(candidates) {
  const header = `-- GovLens India — politicians seed (${ELECTION_NAME})
-- Generated: ${new Date().toISOString().slice(0, 10)} by scripts/crawl-myneta.mjs
-- Source: ECI affidavits, digitized by ADR (myneta.info)
-- Attribution: Association for Democratic Reforms / myneta.info
--
-- Usage (after \`pnpm --filter @workspace/db run push\`):
--   psql "$DATABASE_URL" -f lib/db/seed_politicians.sql
-- ---------------------------------------------------------------------------

`;
  const cols = 'myneta_id, election, election_year, name, party, constituency, state, is_winner, criminal_cases, education, age, total_assets_inr, liabilities_inr, source_url';
  const chunks = [];
  const BATCH = 500;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const values = candidates.slice(i, i + BATCH).map(c =>
      `(${c.mynetaId}, ${sqlString(ELECTION_NAME)}, ${ELECTION_YEAR}, ${sqlString(c.name)}, ${sqlString(c.party)}, ${sqlString(c.constituency)}, ${sqlString(c.state)}, ${c.isWinner}, ${c.criminalCases}, ${sqlString(c.education)}, ${c.age ?? 'NULL'}, ${c.totalAssetsInr ?? 'NULL'}, ${c.liabilitiesInr ?? 'NULL'}, ${sqlString(c.sourceUrl)})`
    ).join(',\n');
    chunks.push(`INSERT INTO politicians (${cols}) VALUES\n${values}\nON CONFLICT (election, myneta_id) DO UPDATE SET
  name = EXCLUDED.name, party = EXCLUDED.party, constituency = EXCLUDED.constituency,
  state = EXCLUDED.state, is_winner = EXCLUDED.is_winner, criminal_cases = EXCLUDED.criminal_cases,
  education = EXCLUDED.education, age = EXCLUDED.age, total_assets_inr = EXCLUDED.total_assets_inr,
  liabilities_inr = EXCLUDED.liabilities_inr, source_url = EXCLUDED.source_url;\n`);
  }
  return header + chunks.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🗳  MyNeta crawler — ${ELECTION_NAME}\n`);
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(dirname(OUT_JSON), { recursive: true });

  console.log('Step 1: Fetching election index (constituency list)...');
  const indexHtml = await fetchHtml(`${BASE}/`, 'index');
  if (!indexHtml) throw new Error('Could not fetch election index page');
  const constituencies = parseConstituencies(indexHtml);
  const states = new Set(constituencies.map(c => c.state));
  console.log(`  ${constituencies.length} constituencies across ${states.size} states/UTs\n`);
  if (constituencies.length < 500) throw new Error('Suspiciously few constituencies parsed — page layout may have changed');

  console.log(`Step 2: Crawling ${constituencies.length} constituency pages (concurrency=${CONCURRENCY})...`);
  const all = [];
  let done = 0;
  await pool(constituencies, CONCURRENCY, async (c) => {
    const html = await fetchHtml(
      `${BASE}/index.php?action=show_candidates&constituency_id=${c.id}`,
      `constituency-${c.id}`
    );
    if (html) all.push(...parseCandidates(html, c));
    done++;
    if (done % 25 === 0 || done === constituencies.length)
      process.stdout.write(`\r  Pages: ${done}/${constituencies.length}  Candidates: ${all.length}   `);
  });
  console.log('\n');

  // Deduplicate (a candidate page linked twice on one page would double-count)
  const seen = new Set();
  const candidates = all.filter(c => {
    if (seen.has(c.mynetaId)) return false;
    seen.add(c.mynetaId);
    return true;
  });

  // ── Step 3: union with the authoritative "candidates analyzed" listing ──────
  console.log('\nStep 3: Crawling "candidates analyzed" summary listing...');
  const summaryUrl = p => `${BASE}/index.php?action=summary&subAction=candidates_analyzed&sort=candidate${p > 1 ? `&page=${p}` : ''}`;
  const firstSummary = await fetchHtml(summaryUrl(1), 'summary-1');
  if (!firstSummary) throw new Error('Could not fetch summary listing');
  const pageNums = [...firstSummary.matchAll(/[?&]page=(\d+)/g)].map(m => parseInt(m[1], 10));
  const maxPage = pageNums.length ? Math.max(...pageNums) : 1;
  console.log(`  ${maxPage} summary pages`);

  const summaryRows = parseSummaryRows(firstSummary);
  let sDone = 1;
  await pool(Array.from({ length: maxPage - 1 }, (_, i) => i + 2), CONCURRENCY, async (p) => {
    const html = await fetchHtml(summaryUrl(p), `summary-${p}`);
    if (html) summaryRows.push(...parseSummaryRows(html));
    sDone++;
    if (sDone % 25 === 0 || sDone === maxPage)
      process.stdout.write(`\r  Pages: ${sDone}/${maxPage}  Rows: ${summaryRows.length}   `);
  });
  console.log('');

  // Backfill figures that constituency pages render as anti-scraping images
  // (image_v2.php) — the summary listing shows the same values as plain text.
  const summaryById = new Map();
  for (const r of summaryRows) if (!summaryById.has(r.mynetaId)) summaryById.set(r.mynetaId, r);
  let backfilled = 0;
  for (const c of candidates) {
    const s = summaryById.get(c.mynetaId);
    if (!s) continue;
    if (c.totalAssetsInr === null && s.totalAssetsInr !== null) { c.totalAssetsInr = s.totalAssetsInr; backfilled++; }
    if (c.liabilitiesInr === null && s.liabilitiesInr !== null) c.liabilitiesInr = s.liabilitiesInr;
    if (c.education === null && s.education) c.education = s.education;
  }
  console.log(`  Backfilled asset figures for ${backfilled} candidates from listing text`);

  // Constituency name (uppercase) → set of states, from the index parse
  const stateByConstituency = new Map();
  for (const c of constituencies) {
    const key = c.name.toUpperCase();
    if (!stateByConstituency.has(key)) stateByConstituency.set(key, new Set());
    stateByConstituency.get(key).add(c.state);
  }

  const extras = summaryRows.filter(r => !seen.has(r.mynetaId));
  // Same candidate can appear once per listing sort quirk — dedupe extras too
  const extraSeen = new Set();
  console.log(`  ${extras.length} candidates in listing but not on constituency pages — merging`);
  for (const r of extras) {
    if (extraSeen.has(r.mynetaId)) continue;
    extraSeen.add(r.mynetaId);
    const states = stateByConstituency.get(r.constituencyRaw);
    let state = states && states.size === 1 ? [...states][0] : null;
    if (!state) {
      const detail = await fetchHtml(`${BASE}/candidate.php?candidate_id=${r.mynetaId}`, `candidate-${r.mynetaId}`);
      state = detail ? parseStateFromDetail(detail) : null;
    }
    candidates.push({
      mynetaId: r.mynetaId,
      name: r.name,
      isWinner: false, // all 543 winners carry the flag on constituency pages
      party: r.party,
      criminalCases: r.criminalCases,
      education: r.education,
      age: null, // not shown on the summary listing
      totalAssetsInr: r.totalAssetsInr,
      liabilitiesInr: r.liabilitiesInr,
      constituency: titleCase(r.constituencyRaw),
      state: state ?? 'Unknown',
      sourceUrl: `${BASE}/candidate.php?candidate_id=${r.mynetaId}`,
    });
    seen.add(r.mynetaId);
  }

  const indexText = indexHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const analyzedM = indexText.match(/candidates analy[sz]ed by NEW\s*(\d{3,5})/i);
  const statedTotal = analyzedM ? parseInt(analyzedM[1], 10) : null;
  if (statedTotal) {
    console.log(`  Total: ${candidates.length} vs MyNeta's stated ${statedTotal} (${(100 * candidates.length / statedTotal).toFixed(1)}% coverage)`);
    if (candidates.length < statedTotal * 0.97)
      console.warn(`  ⚠️  Coverage below 97% of MyNeta's stated count — verify parsing`);
  }
  candidates.sort((a, b) => a.state.localeCompare(b.state) || a.constituency.localeCompare(b.constituency) || a.name.localeCompare(b.name));

  const winners = candidates.filter(c => c.isWinner);
  const withCases = candidates.filter(c => c.criminalCases > 0);
  console.log(`  ✅ ${candidates.length} unique candidates, ${winners.length} winners, ${withCases.length} with criminal cases`);
  if (winners.length < 500 || winners.length > 560)
    console.warn(`  ⚠️  Winner count ${winners.length} outside expected 500–560 — verify parsing`);

  const output = {
    meta: {
      election: ELECTION_NAME,
      electionYear: ELECTION_YEAR,
      crawledAt: new Date().toISOString(),
      source: 'ECI affidavits digitized by ADR — https://www.myneta.info/LokSabha2024/',
      attribution: 'Association for Democratic Reforms (ADR) / myneta.info',
      totalCandidates: candidates.length,
      statedTotalOnMyneta: statedTotal,
      winners: winners.length,
    },
    candidates,
  };
  writeFileSync(OUT_JSON, JSON.stringify(output, null, 1));
  writeFileSync(OUT_SQL, generateSeedSql(candidates));

  // Slim minified copy for the frontend — sourceUrl is derived from mynetaId there
  const frontend = {
    meta: output.meta,
    candidates: candidates.map(({ sourceUrl, ...rest }) => rest),
  };
  writeFileSync(OUT_FRONTEND, JSON.stringify(frontend));

  console.log(`\n✅ Written → ${OUT_JSON}`);
  console.log(`✅ Written → ${OUT_SQL}`);
  console.log(`✅ Written → ${OUT_FRONTEND}`);
}

main().catch(e => { console.error(e); process.exit(1); });

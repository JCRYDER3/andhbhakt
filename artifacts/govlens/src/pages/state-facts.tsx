import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { computeIntegrityScore } from '@/lib/scoring';
import { SEO } from '@/components/seo';
import officialTitlesHiRaw from '../data/official-titles-hi.json';
const officialTitlesHi = officialTitlesHiRaw as Record<string, string>;
import statLabelsHiRaw from '../data/stat-labels-hi.json';
import stateNamesHiRaw from '../data/state-names-hi.json';
const stateNamesHi = stateNamesHiRaw as Record<string, string>;
const statLabelsHi = statLabelsHiRaw as Record<string, string>;
import personNamesHiRaw from '../data/person-names-hi.json';
const namesHi = personNamesHiRaw as Record<string, string>;
import { STATE_FACTS } from '../data/state-facts-data';
import type {
  Official,
  OfficialGroup,
  IndicatorStat,
  Indicator,
  CagFinding,
  AccountabilityRating,
  NewGovtCabinetMember,
  NewGovtDetails,
  StateFact,
  StateManifesto,
  StatePromiseStatus,
} from '../data/state-facts-data';

// ── Lazy Hindi data (loaded only when language = hi) ─────────────────────────
// Maps start empty and are populated asynchronously when user switches to Hindi.
// Object.assign into the same reference so all closures see updated data after
// a single forceUpdate() triggers a re-render.
const sfHiHeadlines: Record<string, string> = {};
const sfHiValues:    Record<string, string> = {};
const sfHiNotes:     Record<string, string> = {};
const sfHiFindings:  Record<string, string> = {};
const sfHiExcerpts:  Record<string, string> = {};
const sfHiMethodology:  Record<string, string> = {};
const sfHiCrimNote:     Record<string, string> = {};
const sfHiNewGovtLabel: Record<string, string> = {};
const sfHiParam:     Record<string, string> = {};
const sfHiActual:    Record<string, string> = {};
const sfHiRef:       Record<string, string> = {};
const sfHiSchemeName: Record<string, string> = {};

let _hiLoaded  = false;
let _hiLoading = false;
const _hiListeners: Set<() => void> = new Set();

function _loadHiMaps() {
  if (_hiLoaded || _hiLoading) return;
  _hiLoading = true;
  Promise.all([
    import('../data/state-facts-hi.json'),
    import('../data/state-facts-hi-extra.json'),
  ]).then(([rawMod, extraMod]) => {
    const r = rawMod.default as any;
    const x = extraMod.default as any;
    Object.assign(sfHiHeadlines,   r.headlineMap    ?? {});
    Object.assign(sfHiValues,      r.valueMap       ?? {});
    Object.assign(sfHiNotes,       r.noteMap        ?? {});
    Object.assign(sfHiFindings,    r.findingMap     ?? {});
    Object.assign(sfHiExcerpts,    r.excerptMap     ?? {});
    Object.assign(sfHiMethodology, x.methodologyMap ?? {});
    Object.assign(sfHiCrimNote,    x.crimNoteMap    ?? {});
    Object.assign(sfHiNewGovtLabel,x.newGovtLabelMap?? {});
    Object.assign(sfHiParam,       x.paramMap       ?? {});
    Object.assign(sfHiActual,      x.actualMap      ?? {});
    Object.assign(sfHiRef,         x.refMap         ?? {});
    Object.assign(sfHiSchemeName,  x.schemeNameMap  ?? {});
    _hiLoaded  = true;
    _hiLoading = false;
    _hiListeners.forEach(cb => cb());
    _hiListeners.clear();
  });
}

/** Returns true when Hindi maps are ready (or when language is English). */
function useHiReady(isHi: boolean): boolean {
  const [ready, setReady] = useState(!isHi || _hiLoaded);
  useEffect(() => {
    if (!isHi || _hiLoaded) { setReady(true); return; }
    const cb = () => setReady(true);
    _hiListeners.add(cb);
    _loadHiMaps();
    return () => { _hiListeners.delete(cb); };
  }, [isHi]);
  return ready;
}

// ── Inline lookup maps (no async dependency) ─────────────────────────────────
const REGION_KEY: Record<string, string> = {
  'South': 'regionSouth', 'North India': 'regionNorthIndia', 'Northeast': 'regionNortheast',
  'East India': 'regionEastIndia', 'West India': 'regionWestIndia', 'Central India': 'regionCentralIndia',
};
const PARTY_HI: Record<string, string> = {
  'AAP': 'आम आदमी पार्टी', 'AGP': 'असम गण परिषद', 'AINRC': 'अखिल भारतीय N.R. कांग्रेस',
  'AITC': 'अखिल भारतीय तृणमूल कांग्रेस', 'BJP': 'भारतीय जनता पार्टी', 'CPI(M)': 'CPI(M)',
  'DMK': 'द्रविड़ मुनेत्र कषगम', 'INC': 'भारतीय राष्ट्रीय कांग्रेस',
  'Independent (BJP-supported)': 'निर्दलीय (भाजपा-समर्थित)', 'IPFT': 'IPFT',
  'Jana Sena': 'जनसेना पार्टी', 'JD(S) Kerala': 'JD(S) केरल', 'JD(U)': 'JD(U)',
  'JMM': 'झारखंड मुक्ति मोर्चा', 'KC(M)': 'KC(M)', 'NC': 'जम्मू-कश्मीर नेशनल कांग्रेस',
  'NCP': 'राष्ट्रवादी कांग्रेस पार्टी', 'NDPP': 'NDPP', 'NPF': 'नागा पीपल्स फ्रंट',
  'NPP': 'नेशनल पीपल्स पार्टी', 'SHS': 'शिव सेना', 'SKM': 'सिक्किम क्रांतिकारी मोर्चा',
  'TDP': 'तेलुगु देशम पार्टी', 'UDP': 'UDP', 'ZPM': 'ज़ोरम पीपल्स मूवमेंट',
};
const SF_SEVERITY_HI: Record<string, string> = { Critical: 'गंभीर', Major: 'प्रमुख', Minor: 'मामूली' };
const MONTHS_HI_SF: Record<string, string> = {
  January: 'जनवरी', February: 'फ़रवरी', March: 'मार्च', April: 'अप्रैल',
  May: 'मई', June: 'जून', July: 'जुलाई', August: 'अगस्त',
  September: 'सितंबर', October: 'अक्टूबर', November: 'नवंबर', December: 'दिसंबर',
};
function hiDateSF(date: string): string {
  return date.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
    m => MONTHS_HI_SF[m] ?? m);
}
const sfHiGroups: Record<string, string> = {
  'Constitutional & Legislature': 'संवैधानिक और विधायिका',
  'Finance, Planning & Infrastructure': 'वित्त, योजना और अवसंरचना',
  'Agriculture, Industry & Power': 'कृषि, उद्योग और ऊर्जा',
  'Agriculture & Rural Development': 'कृषि और ग्रामीण विकास',
  'Health & Social Welfare': 'स्वास्थ्य और सामाजिक कल्याण',
  'Education & Youth': 'शिक्षा और युवा',
  'Rural Development & Environment': 'ग्रामीण विकास और पर्यावरण',
  'Urban Development & Housing': 'शहरी विकास और आवास',
};
// Helper: return Hindi if available, fallback to English
const hiOr = (isHi: boolean, hi: string | undefined | null, en: string): string =>
  isHi ? (hi || sfHiHeadlines[en] || en) : en;
import { Link } from 'wouter';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  IndianRupee,
  GraduationCap,
  Briefcase,
  HeartPulse,
  ShieldCheck,
  Leaf,
  FileSearch,
  ExternalLink,
  RefreshCw,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return { ring: '#22c55e', text: 'text-green-500', bar: 'bg-green-500', bg: 'bg-green-500/10', label: 'Good',       labelHi: 'अच्छा' };
  if (score >= 55) return { ring: '#f59e0b', text: 'text-amber-500', bar: 'bg-amber-500', bg: 'bg-amber-500/10', label: 'Moderate',   labelHi: 'मध्यम' };
  if (score >= 35) return { ring: '#f97316', text: 'text-orange-500', bar: 'bg-orange-500', bg: 'bg-orange-500/10', label: 'Concerning', labelHi: 'चिंताजनक' };
  return { ring: '#ef4444', text: 'text-red-500', bar: 'bg-red-500', bg: 'bg-red-500/10', label: 'Critical',   labelHi: 'गंभीर' };
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'good';
  if (score >= 55) return 'moderate';
  if (score >= 35) return 'concerning';
  return 'critical';
}

// SVG circular progress ring
function ScoreRing({
  score,
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  score: number;
  icon: React.ElementType;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const R = 28;
  const C = 2 * Math.PI * R;
  const filled = (score / 100) * C;
  const { ring, text, bg } = scoreColor(score);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 focus:outline-none ${
        selected ? `${bg} ring-2 ring-offset-2 ring-offset-background` : 'hover:bg-muted'
      }`}
      style={selected ? { '--tw-ring-color': ring } as React.CSSProperties : undefined}
    >
      {/* Ring */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
          {/* Track */}
          <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
          {/* Progress */}
          <circle
            cx="32" cy="32" r={R}
            fill="none"
            stroke={ring}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${C - filled}`}
          />
        </svg>
        {/* Icon in centre */}
        <Icon className={`w-5 h-5 ${text} relative z-10`} />
      </div>
      {/* Score */}
      <span className={`text-xl font-bold leading-none ${text}`}>{score}</span>
      {/* Label */}
      <span className="text-xs text-muted-foreground font-medium text-center leading-tight">{i18n.language === 'hi' ? (statLabelsHi[label] ?? label) : label}</span>
      {/* Badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
        {t(scoreLabel(score))}
      </span>
    </button>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const dim =
    size === 'lg'
      ? 'w-20 h-20 text-2xl'
      : size === 'md'
      ? 'w-14 h-14 text-lg'
      : 'w-10 h-10 text-sm';

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${dim} rounded-full object-cover object-top flex-shrink-0 border-2 border-border bg-muted`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full flex-shrink-0 bg-primary/10 text-primary font-bold flex items-center justify-center border-2 border-border`}
    >
      {initials}
    </div>
  );
}

function ScoreBar({
  label,
  score,
  caption,
  colorClass,
}: {
  label: string;
  score: number;
  caption: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{label}</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-[10px] font-mono font-semibold w-6 text-right flex-shrink-0">{score}</span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:inline">{caption}</span>
      </div>
      <span className="text-[10px] text-muted-foreground pl-16 sm:hidden leading-snug">{caption}</span>
    </div>
  );
}

function OfficialRow({ official }: { official: Official }) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const hasAffidavit = official.educationScore !== undefined;
  const hasCases = (official.criminalCases ?? 0) > 0;

  return (
    <div className="py-3 border-b border-border last:border-0">
      {/* Top row: photo + name + badges */}
      <div className="flex items-start gap-3">
        <Avatar name={official.name} photoUrl={official.photoUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{isHi ? (namesHi[official.name] ?? official.name) : official.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{isHi ? (officialTitlesHi[official.title] ?? official.title) : official.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {official.party && (
                <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  {official.party}
                </span>
              )}
              {official.since && (
                <span className="text-xs text-muted-foreground">{t('since')} {official.since}</span>
              )}
            </div>
          </div>

          {/* Score bars */}
          {hasAffidavit && (
            <div className="mt-2.5 flex flex-col gap-1.5">
              <ScoreBar
                label={t('educationIndicator')}
                score={official.educationScore!}
                caption={(official.education ?? '').split(',')[0].trim()}
                colorClass="bg-blue-500"
              />
              <ScoreBar
                label={t('legalIntegrity')}
                score={computeIntegrityScore(official.criminalCases ?? 0, official.seriousCriminalCases ?? 0)}
                caption={
                  hasCases
                    ? `${official.criminalCases} ${official.criminalCases! > 1 ? t('casePlural') : t('caseSingular')} ${t('casesDeclared')}`
                    : t('zeroCasesDeclared')
                }
                colorClass={hasCases ? 'bg-red-500' : 'bg-green-500'}
              />
              {hasCases && official.criminalCaseNote && (
                <p className="text-[10px] text-red-500/80 mt-0.5">{isHi ? (sfHiCrimNote[official.criminalCaseNote] ?? official.criminalCaseNote) : official.criminalCaseNote}</p>
              )}
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                {t('eciAffidavitSource')} {official.affidavitYear ?? 2024}
              </p>
            </div>
          )}
          {!hasAffidavit && official.title !== 'Governor' && (
            <p className="text-[10px] text-muted-foreground/40 mt-1.5">
              {t('affidavitDataNotExtracted')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accountability Section ───────────────────────────────────────────────────

const SEVERITY_META = {
  critical: { label: 'Critical', dot: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950/40',    border: 'border-red-200 dark:border-red-800' },
  major:    { label: 'Major',    dot: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800' },
  minor:    { label: 'Minor',    dot: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200 dark:border-yellow-800' },
};

function AccountabilitySection({
  findings,
  ratings,
  stateCode,
}: {
  findings: CagFinding[];
  ratings: AccountabilityRating[];
  stateCode: string;
}) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [findingsOpen, setFindingsOpen] = useState(false);
  const [activeRating, setActiveRating] = useState<string | null>(null);

  const activeRatingData = ratings.find((r) => r.key === activeRating) ?? null;

  return (
    <div className="px-6 py-5 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {t('accountabilityRatings')}
      </p>

      {/* ── Three score rings ── */}
      <div className="grid grid-cols-3 gap-1 mb-1">
        {ratings.map((r) => {
          const { ring, text: textCol } = scoreColor(r.score);
          const R = 28;
          const C = 2 * Math.PI * R;
          const filled = (r.score / 100) * C;
          const Icon = r.icon;
          const selected = activeRating === r.key;

          return (
            <button
              key={r.key}
              onClick={() => setActiveRating((prev) => (prev === r.key ? null : r.key))}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 focus:outline-none ${
                selected ? `bg-muted ring-2 ring-offset-2 ring-offset-background` : 'hover:bg-muted'
              }`}
              style={selected ? { '--tw-ring-color': ring } as React.CSSProperties : undefined}
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                  <circle
                    cx="32" cy="32" r={R}
                    fill="none"
                    stroke={ring}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${C - filled}`}
                  />
                </svg>
                <Icon className="w-5 h-5 relative z-10" style={{ color: ring }} />
              </div>
              <span className={`text-xl font-bold leading-none ${textCol}`}>{r.score}</span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">{isHi ? ({ Transparency:'पारदर्शिता', "Officials' Integrity":'अधिकारियों की कानूनी ईमानदारी', "Officials' Legal Integrity":'अधिकारियों की कानूनी ईमानदारी', Governance:'शासन' }[r.label] ?? r.label) : r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active rating methodology tooltip */}
      {activeRatingData && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold text-foreground mb-1">{isHi ? ({ Transparency:'पारदर्शिता', "Officials' Integrity":'अधिकारियों की कानूनी ईमानदारी', "Officials' Legal Integrity":'अधिकारियों की कानूनी ईमानदारी', Governance:'शासन' }[activeRatingData.label] ?? activeRatingData.label) : activeRatingData.label} {t('ratingMethodology')}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{isHi ? (sfHiMethodology[activeRatingData.methodology] ?? activeRatingData.methodology) : activeRatingData.methodology}</p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50 text-center mt-2 font-mono">
        {t('tapRingForMethodology')}
      </p>

      {/* ── CAG Findings toggle ── */}
      <div className="mt-4">
        <button
          onClick={() => setFindingsOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <FileSearch className="w-4 h-4" />
          {findingsOpen ? (
            <><ChevronUp className="w-4 h-4" /> {t('hideCagAuditFindings')}</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> {isHi ? `${findings.length} ${stateCode} ऑडिट निष्कर्ष देखें` : `View ${findings.length} ${stateCode} ${t('viewStateAuditFindings')}`}</>
          )}
        </button>

        {findingsOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {findings.map((f, i) => {
              const meta = SEVERITY_META[f.severity];
              return (
                <div key={i} className={`rounded-lg border ${meta.border} ${meta.bg} px-4 py-3 flex flex-col gap-2`}>

                  {/* Header row: severity + report ref + PDF link */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${meta.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} flex-shrink-0`} />
                        {isHi ? (SF_SEVERITY_HI[meta.label] ?? meta.label) : meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{isHi ? (sfHiRef[f.reportRef] ?? f.reportRef) : f.reportRef} · {f.reportYear}</span>
                    </div>
                    <a
                      href={f.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('openCagReportPdf')}
                      className="flex-shrink-0 text-muted-foreground/50 hover:text-primary transition-colors mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Scheme name */}
                  <p className="text-xs font-semibold text-foreground -mb-1">{isHi ? (sfHiSchemeName[f.scheme] ?? f.scheme) : f.scheme}</p>

                  {/* Audit parameter */}
                  <p className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wide">
                    {t('parameter')} {isHi ? (sfHiParam[f.parameter] ?? f.parameter) : f.parameter}
                  </p>

                  {/* CAG finding */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isHi ? (f.findingHi || sfHiFindings[f.finding] || f.finding) : f.finding}
                  </p>

                  {/* Actual (what audit found) */}
                  {f.actual && (
                    <div className="rounded-md bg-background/60 border border-border px-3 py-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t('cagFound')}</p>
                      <p className="text-xs text-foreground leading-relaxed">{isHi ? (sfHiActual[f.actual] ?? f.actual) : f.actual}</p>
                    </div>
                  )}

                  {/* Verbatim excerpt */}
                  {f.reportExcerpt && (
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-3">
                      <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                        "{isHi ? (f.reportExcerptHi || sfHiExcerpts[f.reportExcerpt] || f.reportExcerpt) : f.reportExcerpt}"
                      </p>
                    </blockquote>
                  )}

                  {/* Link to scheme audit page */}
                  <div className="pt-1 border-t border-border/50">
                    <Link
                      href={`/schemes/${f.schemeSlug}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      {t('viewMoreDetails')}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground/50 font-mono text-right pt-1">
              {t('cagSource')} {t('cagAuditFindings')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function IndicatorDetail({ indicator }: { indicator: Indicator }) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const { ring, text, bg } = scoreColor(indicator.score);
  const Icon = indicator.icon;

  return (
    <div className={`rounded-xl border border-border ${bg} p-5 mt-2`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${bg} border border-current/20`} style={{ color: ring }}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className={`font-semibold text-sm ${text}`}>{isHi ? (statLabelsHi[indicator.label] ?? indicator.label) : indicator.label} — {t(scoreLabel(indicator.score))}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isHi ? (indicator.headlineHi || sfHiHeadlines[indicator.headline] || indicator.headline) : indicator.headline}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {indicator.stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-background/60 border border-border px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <span className="text-xs text-muted-foreground">{isHi ? (statLabelsHi[s.label] ?? s.label) : s.label}</span>
              <span className="text-sm font-bold text-foreground">{isHi ? (sfHiValues[s.value] || s.value) : s.value}</span>
            </div>
            {s.note && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {isHi ? (s.noteHi || sfHiNotes[s.note] || s.note) : s.note}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{s.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New Government Details Modal ─────────────────────────────────────────────

function NewGovtDetailsModal({ details, stateName, onClose }: {
  details: NewGovtDetails;
  stateName: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const { cm, cabinet } = details;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-5 py-4 flex items-start justify-between gap-3 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">{t('newGovernment', { stateName })}</div>
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{t('electionAndSwornIn', { since: isHi ? hiDateSF(cm.since) : cm.since })}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            aria-label={t('close')}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* New CM */}
        <div className="px-5 pt-4 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t('newChiefMinister')}</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
              {cm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-foreground">{isHi ? (namesHi[cm.name] ?? cm.name) : cm.name}</div>
              <div className="text-xs text-muted-foreground">{isHi ? (PARTY_HI[cm.party] ?? cm.party) : cm.party} · {t('inOfficeSince')} {isHi ? hiDateSF(cm.since) : cm.since}</div>
            </div>
          </div>
          {cm.note && (
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-lg px-3 py-2.5 border border-border mb-3">
              {cm.note}
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            {/* Education */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{t('educationIndicator')}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${cm.educationScore}%` }} />
                </div>
                <span className="text-[10px] font-mono font-semibold w-6 text-right flex-shrink-0">{cm.educationScore}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 pl-16 leading-relaxed">{cm.education}</p>
            </div>
            {/* Integrity */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{t('integrity')}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cm.criminalCases > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${computeIntegrityScore(cm.criminalCases, cm.seriousCriminalCases ?? 0)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-semibold w-6 text-right flex-shrink-0">{computeIntegrityScore(cm.criminalCases, cm.seriousCriminalCases ?? 0)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 pl-16 leading-relaxed">
                {cm.criminalCases > 0 ? `${cm.criminalCases} ${t('caseSingularOrPlural')}` : t('zeroCasesDeclared')}
              </p>
              {cm.criminalCaseNote && (
                <p className="text-[10px] text-muted-foreground/50 pl-16 leading-relaxed mt-0.5">{isHi ? (sfHiCrimNote[cm.criminalCaseNote] ?? cm.criminalCaseNote) : cm.criminalCaseNote}</p>
              )}
            </div>
          </div>
        </div>

        {/* Cabinet */}
        <div className="px-5 pb-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t('cabinetMinisters')}</p>
          </div>
          <div className="space-y-2">
            {cabinet.map((m, i) => (
              <div key={i} className="rounded-lg px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors">
                {/* Name + party */}
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{isHi ? (namesHi[m.name] ?? m.name) : m.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.portfolio}</div>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground font-medium whitespace-nowrap flex-shrink-0">
                    {m.party}
                  </span>
                </div>
                {/* Score bars */}
                {(m.educationScore !== undefined || m.criminalCases !== undefined) && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {m.educationScore !== undefined && (
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{t('educationIndicator')}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${m.educationScore}%` }} />
                          </div>
                          <span className="text-[10px] font-mono font-semibold w-6 text-right flex-shrink-0">{m.educationScore}</span>
                        </div>
                        {m.education && (
                          <p className="text-[10px] text-muted-foreground/60 pl-16 leading-relaxed">{m.education}</p>
                        )}
                      </div>
                    )}
                    {m.criminalCases !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{t('integrity')}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${m.criminalCases > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${m.criminalCases > 0 ? Math.max(10, 100 - m.criminalCases * 20) : 100}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono font-semibold w-6 text-right flex-shrink-0 ${m.criminalCases > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {m.criminalCases}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {m.criminalCases === 0 ? t('noCases') : `${m.criminalCases !== 1 ? t('casePlural') : t('caseSingular')}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── State Manifesto ──────────────────────────────────────────────────────────

const STATE_PROMISE_STATUS_META: Record<StatePromiseStatus, { label: string; labelHi: string; dot: string; text: string; bg: string; border: string }> = {
  implemented:     { label: 'Implemented',          labelHi: 'लागू',              dot: 'bg-green-500',           text: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-950/40',  border: 'border-green-200 dark:border-green-800'  },
  partial:         { label: 'Partial / Flagged',    labelHi: 'आंशिक / चिह्नित', dot: 'bg-amber-500',           text: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/40',  border: 'border-amber-200 dark:border-amber-800'  },
  'in-progress':   { label: 'In Progress',          labelHi: 'प्रगति में',        dot: 'bg-blue-500',            text: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/40',    border: 'border-blue-200 dark:border-blue-800'    },
  'not-fulfilled': { label: 'Not Fulfilled',        labelHi: 'पूरा नहीं',        dot: 'bg-red-500',             text: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-950/40',      border: 'border-red-200 dark:border-red-800'      },
  pending:         { label: 'Pending',              labelHi: 'लंबित',             dot: 'bg-muted-foreground/40', text: 'text-muted-foreground',               bg: 'bg-muted/30',                        border: 'border-border'                           },
};

function StateManifestoSection({ manifestos, stateName }: { manifestos: StateManifesto[]; stateName: string }) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [activeYear, setActiveYear] = useState(() => Math.max(...manifestos.map(m => m.year)));
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatePromiseStatus | null>(null);
  const [page, setPage] = useState(0);
  const [activeStateDim, setActiveStateDim] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const manifesto = manifestos.find(m => m.year === activeYear) ?? manifestos[manifestos.length - 1];
  const allPromises = manifesto.categories.flatMap(c =>
    c.promises.map(p => ({ ...p, categoryName: c.name, categoryNameHi: c.nameHi }))
  );

  const total       = allPromises.length;
  const implCount   = allPromises.filter(p => p.status === 'implemented').length;
  const partialCount = allPromises.filter(p => p.status === 'partial').length;
  const inProgCount  = allPromises.filter(p => p.status === 'in-progress').length;
  const failCount    = allPromises.filter(p => p.status === 'not-fulfilled').length;
  const pendingCount = allPromises.filter(p => p.status === 'pending').length;
  const deliveryScore = total > 0 ? Math.round((implCount + (partialCount + inProgCount) * 0.5) / total * 100) : 0;
  const allSameParty = manifestos.every(m => m.party === manifestos[0].party);

  // Monetary mismanagement: sum CAG-flagged ₹ amounts, log-scaled (0 crore → 100, ~3000 crore → ~25)
  const totalFlaggedCrore = allPromises.reduce((s, p) => s + (p.cagAmountCrore ?? 0), 0);
  const moneyScore = totalFlaggedCrore === 0
    ? 100
    : Math.max(0, Math.round(100 - 30 * Math.log10(totalFlaggedCrore / 10 + 1)));
  const flaggedPromises = allPromises.filter(p => p.cagAmountCrore);

  const STATE_MANIFESTO_DIMS = [
    {
      key: 'implementation', icon: TrendingUp, score: deliveryScore,
      label: 'Implementation', labelHi: 'क्रियान्वयन',
      rationale: `Weighted delivery rate across ${total} tracked ${manifesto.party} ${manifesto.year} manifesto promises: implemented = 1.0 pt, partial / in-progress = 0.5 pt, not-fulfilled / pending = 0 pt. Breakdown: ${implCount} implemented, ${partialCount} partial, ${inProgCount} in-progress, ${failCount} not fulfilled${pendingCount > 0 ? `, ${pendingCount} pending` : ''}. Score = (${implCount} + ${partialCount + inProgCount}×0.5) ÷ ${total} × 100 = ${deliveryScore}.`,
      rationaleHi: `${total} ${manifesto.partyHi} ${manifesto.year} संकल्प पत्र वादों की भारित डिलीवरी दर: लागू = 1.0, आंशिक/प्रगति में = 0.5, पूरा नहीं/लंबित = 0। विवरण: ${implCount} लागू, ${partialCount} आंशिक, ${inProgCount} प्रगति में, ${failCount} पूरा नहीं${pendingCount > 0 ? `, ${pendingCount} लंबित` : ''}। स्कोर = (${implCount} + ${partialCount + inProgCount}×0.5) ÷ ${total} × 100 = ${deliveryScore}।`,
      sources: `${manifesto.party} Manifesto ${manifesto.year} · CAG of India audit reports · State government press releases · Independent fact-checks`,
      sourcesHi: `${manifesto.partyHi} संकल्प पत्र ${manifesto.year} · CAG of India · राज्य सरकार प्रेस विज्ञप्ति · स्वतंत्र तथ्य-जांच`,
    },
    {
      key: 'money', icon: IndianRupee, score: moneyScore,
      label: 'Monetary Management', labelHi: 'वित्तीय प्रबंधन',
      rationale: totalFlaggedCrore === 0
        ? `No specific CAG-flagged monetary amounts found in tracked ${manifesto.party} ${manifesto.year} manifesto promises. Score defaults to 100 until CAG audit findings with rupee amounts are linked.`
        : `CAG-flagged rupee amounts across ${flaggedPromises.length} promise${flaggedPromises.length > 1 ? 's' : ''}: ₹${totalFlaggedCrore.toLocaleString('en-IN')} crore total (${flaggedPromises.map(p => { const label = p.promise.length > 40 ? p.promise.slice(0, 40) + '…' : p.promise; return `₹${(p.cagAmountCrore!).toLocaleString('en-IN')} cr — ${label}`; }).join('; ')}). Log-scale penalty: 100 − 30×log₁₀(${totalFlaggedCrore}/10 + 1) = ${moneyScore}. Includes funds lapsed, wasted on underperforming schemes, and misappropriated to ineligible beneficiaries.`,
      rationaleHi: totalFlaggedCrore === 0
        ? `${manifesto.partyHi} ${manifesto.year} संकल्प पत्र वादों में CAG द्वारा चिह्नित कोई विशेष राशि नहीं मिली। स्कोर 100 डिफ़ॉल्ट है।`
        : `${flaggedPromises.length} वादों में CAG-चिह्नित राशि: ₹${totalFlaggedCrore.toLocaleString('en-IN')} करोड़ कुल। लॉग-स्केल दंड: 100 − 30×log₁₀(${totalFlaggedCrore}/10 + 1) = ${moneyScore}। अव्ययित, दुर्व्यय और अपात्र लाभार्थियों को हस्तांतरित निधि शामिल।`,
      sources: `CAG of India published audit reports · ${manifesto.party} Manifesto ${manifesto.year}`,
      sourcesHi: `CAG of India प्रकाशित ऑडिट रिपोर्टें · ${manifesto.partyHi} संकल्प पत्र ${manifesto.year}`,
    },
  ];

  const chips = ([
    { status: 'implemented'    as StatePromiseStatus, count: allPromises.filter(p => p.status === 'implemented').length },
    { status: 'partial'        as StatePromiseStatus, count: allPromises.filter(p => p.status === 'partial').length },
    { status: 'in-progress'    as StatePromiseStatus, count: allPromises.filter(p => p.status === 'in-progress').length },
    { status: 'not-fulfilled'  as StatePromiseStatus, count: allPromises.filter(p => p.status === 'not-fulfilled').length },
    { status: 'pending'        as StatePromiseStatus, count: allPromises.filter(p => p.status === 'pending').length },
  ] as { status: StatePromiseStatus; count: number }[]).filter(c => c.count > 0);

  const filtered = statusFilter ? allPromises.filter(p => p.status === statusFilter) : allPromises;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const getPaginationItems = (): (number | null)[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const set = new Set<number>();
    set.add(0); set.add(totalPages - 1);
    for (let i = Math.max(0, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) set.add(i);
    const sorted = Array.from(set).sort((a, b) => a - b);
    const result: (number | null)[] = [];
    sorted.forEach((pg, idx) => {
      if (idx > 0 && pg - sorted[idx - 1] > 1) result.push(null);
      result.push(pg);
    });
    return result;
  };

  return (
    <div className="px-6 py-5 border-t border-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {isHi ? `${manifesto.partyHi} चुनावी वादे` : `${manifesto.party} Election Promises`}
        </p>
        <a href={manifesto.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0">
          {isHi ? 'स्रोत' : 'Source'} <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Manifesto title & tagline */}
      <p className="text-sm font-semibold text-foreground mb-0.5">
        {isHi ? manifesto.titleHi : manifesto.title}
      </p>
      <p className="text-[11px] text-muted-foreground/70 italic mb-4">
        "{isHi ? manifesto.taglineHi : manifesto.tagline}"
      </p>

      {/* Overall roll-up — mirrors central-data layout */}
      <p className="text-[11px] text-muted-foreground mb-3">
        {isHi
          ? `${total} प्रमुख वादों का स्वतंत्र स्रोतों और CAG रिपोर्टों से मिलान।`
          : `${total} key promises cross-verified with CAG reports and independent sources.`}
      </p>
      <div className="flex gap-2 flex-wrap mb-4 text-[11px] font-semibold">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{implCount} {isHi ? 'लागू' : 'Implemented'}
        </span>
        {partialCount > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{partialCount} {isHi ? 'आंशिक' : 'Partial'}
          </span>
        )}
        {inProgCount > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{inProgCount} {isHi ? 'प्रगति में' : 'In Progress'}
          </span>
        )}
        {failCount > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{failCount} {isHi ? 'पूरा नहीं' : 'Not Fulfilled'}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />{pendingCount} {isHi ? 'लंबित' : 'Pending'}
          </span>
        )}
      </div>

      {/* ── Term Rating rings — identical layout to central-data ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {isHi ? `वादा वितरण रेटिंग · ${manifesto.year}` : `Promise Delivery Rating · ${manifesto.year}`}
        </p>
        <div className="grid grid-cols-2 gap-1 mb-1">
          {STATE_MANIFESTO_DIMS.map(dim => {
            const sc = scoreColor(dim.score);
            const R = 28; const C = 2 * Math.PI * R; const filled = (dim.score / 100) * C;
            const selected = activeStateDim === dim.key;
            const Icon = dim.icon;
            return (
              <button
                key={dim.key}
                onClick={() => setActiveStateDim(prev => prev === dim.key ? null : dim.key)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 focus:outline-none ${
                  selected ? `${sc.bg} ring-2 ring-offset-2 ring-offset-background` : 'hover:bg-muted'
                }`}
                style={selected ? { '--tw-ring-color': sc.ring } as React.CSSProperties : undefined}
              >
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                    <circle cx="32" cy="32" r={R} fill="none" stroke={sc.ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${filled} ${C - filled}`} />
                  </svg>
                  <Icon className={`w-5 h-5 ${sc.text} relative z-10`} />
                </div>
                <span className={`text-xl font-bold leading-none ${sc.text}`}>{dim.score}</span>
                <span className="text-[11px] text-muted-foreground text-center leading-tight">
                  {isHi ? dim.labelHi : dim.label}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                  {isHi ? sc.labelHi : sc.label}
                </span>
              </button>
            );
          })}
        </div>
        {activeStateDim && (() => {
          const dim = STATE_MANIFESTO_DIMS.find(d => d.key === activeStateDim);
          if (!dim) return null;
          return (
            <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                {isHi ? dim.labelHi : dim.label} — {isHi ? 'कार्यप्रणाली' : 'Methodology'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isHi ? dim.rationaleHi : dim.rationale}
              </p>
              {dim.key === 'money' && flaggedPromises.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {flaggedPromises.map((p, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      {p.cagSource ? (
                        <a
                          href={p.cagSource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline font-mono"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          CAG Report — ₹{(p.cagAmountCrore!).toLocaleString('en-IN')} cr · {p.promise.length > 45 ? p.promise.slice(0, 45) + '…' : p.promise}
                        </a>
                      ) : (
                        <a
                          href="https://cag.gov.in/en/audit-report"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline font-mono"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          CAG Audit Reports — ₹{(p.cagAmountCrore!).toLocaleString('en-IN')} cr · {p.promise.length > 45 ? p.promise.slice(0, 45) + '…' : p.promise}
                        </a>
                      )}
                      {p.cagVerdict && (
                        <p className="text-[10px] text-muted-foreground leading-snug pl-4">
                          {isHi ? (p.cagVerdictHi ?? p.cagVerdict) : p.cagVerdict}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-2 leading-tight">
                {isHi ? dim.sourcesHi : dim.sources}
              </p>
            </div>
          );
        })()}
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2 font-mono">
          {isHi ? 'कार्यप्रणाली के लिए रिंग टैप करें' : 'Tap a ring for methodology'}
        </p>

        {/* Year tabs — below rings, matches central-data style exactly */}
        {manifestos.length > 1 && (
          <div className="flex gap-1 mt-4 border-b border-border pb-2">
            {[...manifestos].sort((a, b) => a.year - b.year).map(m => (
              <button key={m.year}
                onClick={() => { setActiveYear(m.year); setStatusFilter(null); setPage(0); setActiveStateDim(null); }}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeYear === m.year
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {allSameParty ? m.year : `${m.year} · ${m.party}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button
          onClick={() => { setStatusFilter(null); setPage(0); }}
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
            statusFilter === null
              ? 'bg-foreground text-background border-foreground'
              : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          {isHi ? `सभी (${allPromises.length})` : `All (${allPromises.length})`}
        </button>
        {chips.map(c => {
          const sm = STATE_PROMISE_STATUS_META[c.status];
          const active = statusFilter === c.status;
          return (
            <button key={c.status}
              onClick={() => { setStatusFilter(active ? null : c.status); setPage(0); }}
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                active
                  ? `${sm.bg} ${sm.border} ${sm.text} ring-1 ring-offset-1 ring-offset-background`
                  : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
              {c.count} {isHi ? sm.labelHi : sm.label}
            </button>
          );
        })}
      </div>

      {/* Toggle */}
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
        <FileSearch className="w-4 h-4" />
        {open
          ? <><ChevronUp className="w-4 h-4" />{isHi ? 'छुपाएं' : 'Hide promises'}</>
          : <><ChevronDown className="w-4 h-4" />{isHi ? `वादे देखें (${allPromises.length})` : `Browse promises (${allPromises.length})`}</>
        }
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            {isHi
              ? `${filtered.length} वादे · पृष्ठ ${safePage + 1}/${totalPages}`
              : `${filtered.length} promise${filtered.length !== 1 ? 's' : ''} · page ${safePage + 1} of ${totalPages}`}
          </p>

          {/* Promise cards */}
          {pageItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              {isHi ? 'इस फ़िल्टर में कोई वादे नहीं' : 'No promises match this filter.'}
            </p>
          ) : pageItems.map((p, i) => {
            const sm = STATE_PROMISE_STATUS_META[p.status];
            return (
              <div key={safePage * PAGE_SIZE + i} className={`rounded-lg border px-4 py-3 flex flex-col gap-1.5 ${sm.bg} ${sm.border}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${sm.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} flex-shrink-0`} />
                    {isHi ? sm.labelHi : sm.label}
                  </span>
                  <span className="text-[9px] font-medium text-muted-foreground/70 bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[160px]">
                    {isHi ? p.categoryNameHi : p.categoryName}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground leading-relaxed">
                  {isHi ? p.promiseHi : p.promise}
                </p>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  {isHi ? p.noteHi : p.note}
                </p>
                {p.cagVerdict && (
                  <div className="mt-1 rounded-md bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-0.5">CAG Verdict</p>
                    <p className="text-[10px] text-orange-800 dark:text-orange-300 leading-relaxed">
                      {isHi ? (p.cagVerdictHi ?? p.cagVerdict) : p.cagVerdict}
                    </p>
                    <a href={p.cagSource ?? 'https://cag.gov.in/en/audit-report'} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors underline underline-offset-2">
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      {isHi ? 'CAG रिपोर्ट देखें →' : 'View CAG Report →'}
                    </a>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <button onClick={() => setPage(pg => Math.max(0, pg - 1))} disabled={safePage === 0}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
                {isHi ? 'पिछला' : 'Prev'}
              </button>
              <div className="flex items-center gap-0.5">
                {getPaginationItems().map((pg, idx) =>
                  pg === null ? (
                    <span key={`e${idx}`} className="w-5 text-center text-[10px] text-muted-foreground select-none">…</span>
                  ) : (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-6 h-6 text-[10px] font-semibold rounded transition-colors ${
                        pg === safePage ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}>
                      {pg + 1}
                    </button>
                  )
                )}
              </div>
              <button onClick={() => setPage(pg => Math.min(totalPages - 1, pg + 1))} disabled={safePage === totalPages - 1}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {isHi ? 'अगला' : 'Next'}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground/50 font-mono">
              {isHi ? `स्रोत: ${manifesto.partyHi} ${manifesto.year} संकल्प पत्र` : `Source: ${manifesto.party} ${manifesto.year} Manifesto`}
            </p>
            <a href={manifesto.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
              {isHi ? 'पूरा दस्तावेज़' : 'Full manifesto'} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

function StateFactCard({ fact }: { fact: StateFact }) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [officialsOpen, setOfficialsOpen] = useState(false);
  const [activeIndicator, setActiveIndicator] = useState<string | null>(null);
  const [newGovtOpen, setNewGovtOpen] = useState(false);

  const handleRingClick = (key: string) => {
    setActiveIndicator((prev) => (prev === key ? null : key));
  };

  const active = fact.indicators.find((i) => i.key === activeIndicator) ?? null;

  return (
    <>
      {newGovtOpen && fact.newGovtDetails && (
        <NewGovtDetailsModal
          details={fact.newGovtDetails}
          stateName={isHi ? (stateNamesHi[fact.name] ?? fact.name) : fact.name}
          onClose={() => setNewGovtOpen(false)}
        />
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

      {/* ── New Government banner ── */}
      {fact.newGovtYear && (
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {isHi ? (sfHiNewGovtLabel[fact.newGovtLabel ?? ''] ?? fact.newGovtLabel ?? t('newGovernmentBannerFallback', { year: fact.newGovtYear })) : (fact.newGovtLabel ?? t('newGovernmentBannerFallback', { year: fact.newGovtYear }))}
            </span>
          </div>
          {fact.newGovtDetails && (
            <button
              onClick={() => setNewGovtOpen(true)}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline underline-offset-2 transition-colors flex-shrink-0"
            >
              {t('viewDetails')}
            </button>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{isHi ? (stateNamesHi[fact.name] ?? fact.name) : fact.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('capital')} {fact.capital}&nbsp;&middot;&nbsp;{t('region')} {isHi ? t(REGION_KEY[fact.region] ?? fact.region, { defaultValue: fact.region }) : fact.region}
          </p>
        </div>
        <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded flex-shrink-0">
          {fact.stateCode}
        </span>
      </div>

      {/* ── Chief Minister ── */}
      <div className="px-6 py-5 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {t('chiefMinister')}
        </p>
        <div className="flex items-start gap-4">
          <Avatar name={fact.cm.name} photoUrl={fact.cm.photoUrl} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-foreground">{isHi ? (namesHi[fact.cm.name] ?? fact.cm.name) : fact.cm.name}</p>
            <p className="text-sm text-muted-foreground">{isHi ? (officialTitlesHi[fact.cm.title] ?? fact.cm.title) : fact.cm.title}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {fact.cm.party && (
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {fact.cm.party}
                </span>
              )}
              {fact.cm.since && (
                <span className="text-xs text-muted-foreground">
                  {t('inOfficeSince')} {isHi ? hiDateSF(fact.cm.since) : fact.cm.since}
                </span>
              )}
            </div>
            {fact.cm.educationScore !== undefined && (
              <div className="mt-3 flex flex-col gap-1.5">
                <ScoreBar
                  label={t('educationIndicator')}
                  score={fact.cm.educationScore}
                  caption={fact.cm.education ?? ''}
                  colorClass="bg-blue-500"
                />
                <ScoreBar
                  label={t('legalIntegrity')}
                  score={computeIntegrityScore(fact.cm.criminalCases ?? 0, fact.cm.seriousCriminalCases ?? 0)}
                  caption={
                    (fact.cm.criminalCases ?? 0) > 0
                      ? `${fact.cm.criminalCases} ${fact.cm.criminalCases! > 1 ? t('casePlural') : t('caseSingular')} ${t('casesDeclared')}`
                      : t('zeroCasesDeclared')
                  }
                  colorClass={(fact.cm.criminalCases ?? 0) > 0 ? 'bg-red-500' : 'bg-green-500'}
                />
                <p className="text-[10px] text-muted-foreground/50 font-mono">
                  {t('eciAffidavitSource')} {fact.cm.affidavitYear ?? 2024}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* More officials */}
        {fact.officialGroups.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setOfficialsOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {officialsOpen ? (
                <><ChevronUp className="w-4 h-4" /> {t('hideOfficials')}</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> {t('viewMoreOfficials')}</>
              )}
            </button>
            {officialsOpen && (
              <div className="mt-4 flex flex-col gap-4">
                {fact.officialGroups.map((grp) => (
                  <div key={grp.group}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 px-1">
                      {isHi ? (sfHiGroups[grp.group] ?? grp.group) : grp.group}
                    </p>
                    <div className="rounded-lg border border-border bg-background px-4">
                      {grp.officials.map((o) => (
                        <OfficialRow key={o.name} official={o} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Accountability Ratings + CAG Findings ── */}
      <AccountabilitySection
        findings={fact.cagFindings}
        ratings={fact.accountabilityRatings}
        stateCode={fact.stateCode}
      />

      {/* ── Key Indicators ── */}
      <div className="px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {t('keyIndicators')}
        </p>

        {/* Score rings row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
          {fact.indicators.map((ind) => (
            <ScoreRing
              key={ind.key}
              score={ind.score}
              icon={ind.icon}
              label={ind.label}
              selected={activeIndicator === ind.key}
              onClick={() => handleRingClick(ind.key)}
            />
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
          {t('tapCircleDetails')}
        </p>

        {/* Detail panel */}
        {active && <IndicatorDetail indicator={active} />}
      </div>

      {/* ── State Manifesto (if available for this state) ── */}
      {fact.manifestos && fact.manifestos.length > 0 && <StateManifestoSection manifestos={fact.manifestos} stateName={fact.name} />}

      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StateFacts() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const hiReady = useHiReady(isHi);
  const [selectedCode, setSelectedCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('state')?.toUpperCase();
    return STATE_FACTS.find(f => f.stateCode === code)?.stateCode ?? STATE_FACTS[0].stateCode;
  });
  const selectedFact = STATE_FACTS.find((f) => f.stateCode === selectedCode) ?? STATE_FACTS[0];

  return (
    <div className="min-h-[100dvh] bg-background">
      {isHi && !hiReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">हिन्दी डेटा लोड हो रहा है…</p>
          </div>
        </div>
      )}
      <SEO
        title={isHi ? "भारत राज्य शासन रिपोर्ट कार्ड" : "India State Governance Report Card"}
        description={isHi ? "सभी 28 राज्यों और प्रमुख केंद्र शासित प्रदेशों के लिए राज्यवार शासन स्कोर — ईमानदारी, आर्थिक विकास, सामाजिक संकेतक और CAG लेखापरीक्षा निष्कर्ष।" : "State-by-state governance scores for all 28 states and major UTs — integrity, economic growth, social indicators, and CAG audit findings. Data-driven accountability."}
        path="/state-facts"
        ogImage="/og/state-facts.jpg"
      />
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('stateData')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('stateDataSubtitle')}
            </p>
          </div>
          <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/rankings`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
          >
            {t('viewRankings')}
          </a>
        </div>

        {/* State selector */}
        <div className="mb-6">
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {t('selectState')}
          </label>
          <div className="relative inline-flex items-center w-full sm:w-72">
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="appearance-none w-full pl-4 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-colors"
            >
              {STATE_FACTS.map((fact) => (
                <option key={fact.stateCode} value={fact.stateCode}>
                  {fact.stateCode} — {isHi ? (stateNamesHi[fact.name] ?? fact.name) : fact.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Selected state card */}
        <StateFactCard key={selectedFact.stateCode} fact={selectedFact} />

      </div>
    </div>
  );
}

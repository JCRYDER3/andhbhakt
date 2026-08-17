import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import { SEO } from '@/components/seo';
import {
  ALL_STATES, ALL_YEARS, ALL_CATEGORIES, ALL_LEVELS,
  type CagReport, type ReportFinding, type ReportCategory, type ReportLevel, type ReportStat, type StatStatus,
} from '@/data/cag-reports';

// Total report count — hardcoded so the header shows immediately before data loads
const TOTAL_REPORTS = 1808;
import { Search, ExternalLink, Download, Filter, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { IdentityListingCard, SeveritySignal } from '@/components/ch/IdentityListingCard';
import { familyFromCagWing, hashedCardIdentity } from '@/lib/ch/stateIdentity';
import stateNamesHiRaw from '@/data/state-names-hi.json';
const stateNamesHi = stateNamesHiRaw as Record<string, string>;
import ministryNamesHiRaw from '@/data/ministry-names-hi.json';
const ministryNamesHi = ministryNamesHiRaw as Record<string, string>;

interface CagHiEntry {
  titleHi?: string;
  overviewHi?: string;
  findingsHi?: string[];
  statsLabelsHi?: string[];
  statsValuesHi?: string[];
  statsNotesHi?: (string | null)[];
}

// ── Helpers ───────────────────────────────────────────────────────

const SEVERITY_STYLE = {
  high:   { dot: 'bg-red-500',    label: 'High',   badge: 'text-red-600 dark:text-red-400' },
  medium: { dot: 'bg-orange-500', label: 'Medium', badge: 'text-orange-600 dark:text-orange-400' },
  low:    { dot: 'bg-emerald-500',label: 'Low',    badge: 'text-emerald-600 dark:text-emerald-400' },
};

// ── Hindi translation for reportNo field ─────────────────────────────────────
function translateReportNo(rno: string): string {
  return rno
    .replace(/^Report No\.\s*/i, 'रिपोर्ट सं. ')
    .replace(/\bState Finances Audit Report\b/g, 'राज्य वित्त लेखापरीक्षा रिपोर्ट')
    .replace(/\bCompliance Audit Report\b/g, 'अनुपालन लेखापरीक्षा रिपोर्ट')
    .replace(/\bCompliance Audit\b/g, 'अनुपालन लेखापरीक्षा')
    .replace(/\bPerformance Audit\b/g, 'निष्पादन लेखापरीक्षा')
    .replace(/\bState Finances\b/g, 'राज्य वित्त')
    .replace(/\bFinal Cross-Sector Summary\b/g, 'अंतिम अंतर-क्षेत्र सारांश')
    .replace(/\bFull Report Final Benchmark Summary\b/g, 'पूर्ण रिपोर्ट बेंचमार्क सारांश')
    .replace(/\bExtended Benchmark Summary\b/g, 'विस्तारित बेंचमार्क सारांश')
    .replace(/\bBenchmark Summary\b/g, 'बेंचमार्क सारांश')
    .replace(/\bFinal Summary\b/g, 'अंतिम सारांश')
    .replace(/\bFC Compact\b/g, 'FC कॉम्पैक्ट')
    .replace(/\bPart\s+/g, 'भाग ')
    .replace(/\bParas?\s+/g, 'पैरा ')
    .replace(/\bChapter\b/g, 'अध्याय')
    .replace(/\bFY\s+/g, 'वित्त वर्ष ')
    .replace(/^GovLens India\s*--\s*Cross-State Thematic:\s*/i, 'GovLens India — अंतर-राज्य विषयगत: ')
    .replace(/^GovLens India\s*--\s*Entry\s+/i, 'GovLens India — प्रविष्टि ')
    .replace(/^GovLens India\s*--\s*/i, 'GovLens India — ')
    .replace(/^CAG Report for period ended\s*/i, 'CAG रिपोर्ट — अवधि समाप्त ')
    .replace(/^Cross-State Thematic\s+/i, 'अंतर-राज्य विषयगत ')
    .replace(/\bMarch\b/g, 'मार्च')
    .replace(/\s+of\s+(\d{4})\b/g, ' / $1');
}

const LEVEL_HI: Record<string, string> = {
  Central: 'केंद्रीय', State: 'राज्य', UT: 'केंद्र शा. प्र.',
};
const CATEGORY_HI: Record<string, string> = {
  'State Finances': 'राज्य वित्त',
  'Compliance Audit': 'अनुपालन लेखापरीक्षा',
  'Social Schemes': 'सामाजिक योजनाएं',
  'Performance Audit': 'प्रदर्शन लेखापरीक्षा',
  'Revenue & Tax': 'राजस्व और कर',
  'PSU Audit': 'PSU लेखापरीक्षा',
  'Environment & Mining': 'पर्यावरण और खनन',
};
const SEVERITY_HI: Record<string, string> = {
  high: 'उच्च', medium: 'मध्यम', low: 'कम',
};

const CATEGORY_COLOR: Record<ReportCategory, string> = {
  'State Finances':       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Compliance Audit':     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Social Schemes':       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Performance Audit':    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Revenue & Tax':        'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'PSU Audit':            'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  'Environment & Mining': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
};

const LEVEL_STYLE: Record<ReportLevel, string> = {
  Central: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  State:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  UT:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {children}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────

const STAT_COLORS: Record<StatStatus, {
  border: string; bg: string; value: string; bar: string; track: string;
}> = {
  critical: {
    border: 'border-red-500',
    bg:     'bg-red-50 dark:bg-red-950/20',
    value:  'text-red-600 dark:text-red-400',
    bar:    'bg-red-500',
    track:  'bg-red-200 dark:bg-red-900/40',
  },
  warning: {
    border: 'border-orange-500',
    bg:     'bg-orange-50 dark:bg-orange-950/20',
    value:  'text-orange-600 dark:text-orange-400',
    bar:    'bg-orange-500',
    track:  'bg-orange-200 dark:bg-orange-900/40',
  },
  caution: {
    border: 'border-yellow-500',
    bg:     'bg-yellow-50 dark:bg-yellow-950/20',
    value:  'text-yellow-700 dark:text-yellow-400',
    bar:    'bg-yellow-500',
    track:  'bg-yellow-200 dark:bg-yellow-900/40',
  },
  ok: {
    border: 'border-emerald-500',
    bg:     'bg-emerald-50 dark:bg-emerald-950/20',
    value:  'text-emerald-700 dark:text-emerald-400',
    bar:    'bg-emerald-500',
    track:  'bg-emerald-200 dark:bg-emerald-900/40',
  },
};

function PageBadge({ page, section, quote, url }: { page: number; section: string; quote: string; url?: string }) {
  // PDF page anchors: #page=N
  const href = `${url}#page=${page}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${section}\n\n"${quote}"`}
      className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded
                 bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors
                 border border-border/60 whitespace-nowrap flex-shrink-0"
      onClick={e => e.stopPropagation()}
    >
      p.{page}
    </a>
  );
}

function StatCard({ stat, pdfUrl, labelHi, valueHi, noteHi }: { stat: ReportStat; pdfUrl?: string; labelHi?: string; valueHi?: string; noteHi?: string | null }) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const c = STAT_COLORS[stat.status];
  return (
    <div className={`rounded-lg border border-l-4 ${c.border} ${c.bg} px-3.5 py-3 flex flex-col gap-1.5 min-w-0`}>
      <div className="flex items-start justify-between gap-1">
        <div className={`text-lg font-bold leading-none tracking-tight ${c.value}`}>
          {isHi && valueHi ? valueHi : stat.value}
        </div>
        <PageBadge page={stat.source.page} section={stat.source.section} quote={stat.source.quote} url={pdfUrl} />
      </div>
      <div className="text-xs font-semibold text-foreground/75 leading-snug">
        {isHi && labelHi ? labelHi : stat.label}
      </div>
      {stat.pct !== undefined && (
        <div className={`h-1.5 rounded-full ${c.track} overflow-hidden`}>
          <div
            className={`h-full rounded-full ${c.bar}`}
            style={{ width: `${Math.max(0.5, Math.min(100, stat.pct))}%` }}
          />
        </div>
      )}
      {stat.note && (
        <div className="text-[10px] leading-snug text-foreground/45">
          {isHi && noteHi ? noteHi : stat.note}
        </div>
      )}
    </div>
  );
}

// ── Finding item ──────────────────────────────────────────────────

function FindingItem({ finding, pdfUrl, index, textHi }: { finding: ReportFinding; pdfUrl?: string; index: number; textHi?: string }) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  return (
    <li className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
      <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-foreground/50
                       flex items-center justify-center leading-none">
        {index + 1}
      </span>
      <span className="flex-1">
        {isHi && textHi ? textHi : finding.text}
        {' '}
        <PageBadge
          page={finding.source.page}
          section={finding.source.section}
          quote={finding.source.quote}
          url={pdfUrl}
        />
      </span>
    </li>
  );
}

// ── Report Card ───────────────────────────────────────────────────

function ReportCard({ report, cagHiMap }: { report: CagReport; cagHiMap: Record<string, CagHiEntry> }) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_STYLE[report.severity];
  const hi = isHi ? (cagHiMap[report.id] ?? {}) : {};

  const identity = hashedCardIdentity(report.id, familyFromCagWing(report.category, report.ministry));
  const sevKind = report.severity === 'high' || report.severity === 'medium' || report.severity === 'low'
    ? report.severity
    : 'medium';

  return (
    <IdentityListingCard
      identity={identity}
      eyebrow={isHi ? (ministryNamesHi[report.ministry] ?? report.ministry) : report.ministry}
      title={isHi && hi.titleHi ? hi.titleHi : report.title}
      headline={String(report.year)}
      headlineLabel={isHi ? translateReportNo(report.reportNo) : report.reportNo}
      source="cag.gov.in"
      asOf={report.datePresented || String(report.year)}
      scope={isHi ? (stateNamesHi[report.state] ?? report.state) : report.state}
      freshness="static"
      freshnessDetail="Compiled CAG report record in this checkout — not a live feed."
      chip={
        <div className="flex flex-wrap gap-1.5">
          <SeveritySignal kind={report.level === 'Central' ? 'central' : sevKind} label={isHi ? (LEVEL_HI[report.level] ?? report.level) : report.level} />
          <SeveritySignal kind={sevKind} label={`${isHi ? (SEVERITY_HI[report.severity] ?? sev.label) : sev.label}`} />
        </div>
      }
      actions={
        report.url ? (
          <>
            <a href={report.url} target="_blank" rel="noopener noreferrer" className="ch-btn-outline">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t('view')}
            </a>
            <a href={report.url} target="_blank" rel="noopener noreferrer" className="ch-btn-outline">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t('download')}
            </a>
          </>
        ) : (
          <a href="https://cag.gov.in/en/audit-report" target="_blank" rel="noopener noreferrer" className="ch-btn-outline">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {isHi ? 'CAG पर खोजें' : 'Browse CAG'}
          </a>
        )
      }
    >

      <div>
        <p className={`text-sm leading-relaxed text-[var(--ch-text-secondary)] ${expanded ? '' : 'line-clamp-3'}`}>
          {isHi && hi.overviewHi ? hi.overviewHi : report.overview}
        </p>

        {/* Stats + Findings — visible when expanded */}
        {expanded && (
          <>
            {report.stats && report.stats.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t('keyMetrics')}
                  <span className="ml-1.5 font-normal normal-case text-[10px] text-muted-foreground/60">
                    {t('verifySourcePdf')}
                  </span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {report.stats.map((s, i) => (
                    <StatCard
                      key={i}
                      stat={s}
                      pdfUrl={report.url}
                      labelHi={hi.statsLabelsHi?.[i]}
                      valueHi={hi.statsValuesHi?.[i]}
                      noteHi={hi.statsNotesHi?.[i]}
                    />
                  ))}
                </div>
              </div>
            )}

            {report.keyFindings && report.keyFindings.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t('keyFindings')}
                  <span className="ml-1.5 font-normal normal-case text-[10px] text-muted-foreground/60">
                    {t('sourcePagePdf')}
                  </span>
                </p>
                <ol className="flex flex-col gap-3">
                  {report.keyFindings.map((f, i) => (
                    <FindingItem
                      key={i}
                      finding={f}
                      pdfUrl={report.url}
                      index={i}
                      textHi={hi.findingsHi?.[i]}
                    />
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {report.overview.length > 280 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ch-btn-outline mt-3 min-h-11 text-xs"
          >
            {expanded
              ? <><ChevronUp className="h-3 w-3" />{t('showLess')}</>
              : <><ChevronDown className="h-3 w-3" />{t('readFullFindings')}</>}
          </button>
        )}
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-[var(--ch-text-muted)]">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {report.fileName ?? (isHi ? 'PDF उपलब्ध नहीं' : 'PDF not yet linked')}
        </p>
      </div>
    </IdentityListingCard>
  );
}

// ── Filter pill ───────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1 font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-primary/60">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Select helper ─────────────────────────────────────────────────

function FilterSelect({
  label, plural, value, options, labels, onChange,
}: {
  label: string;
  plural?: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
      >
        <option value="">{t('allFilter')} {plural ?? `${label}s`}</option>
        {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

const PAGE_SIZE = 24;

export default function Reports() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [search, setSearch]       = useState('');
  const [level, setLevel]         = useState<string>('');
  const [state, setState]         = useState<string>('');
  const [category, setCategory]   = useState<string>('');
  const [year, setYear]           = useState<string>('');
  const [severity, setSeverity]   = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage]           = useState(1);

  // Lazy-load the 9.2 MB report data — keeps it out of the initial JS bundle
  const [reports, setReports] = useState<CagReport[] | null>(null);
  useEffect(() => {
    import('@/data/cag-reports-data.json').then(m => {
      setReports(m.default as unknown as CagReport[]);
    });
  }, []);

  // Lazy-load the 8.5 MB Hindi translations only when language is Hindi
  const [cagHiMap, setCagHiMap]   = useState<Record<string, CagHiEntry>>({});
  useEffect(() => {
    if (isHi) {
      import('@/data/cag-reports-hi.json').then(m => {
        setCagHiMap(m.default as unknown as Record<string, CagHiEntry>);
      }).catch(() => {
        // Non-fatal: Hindi translations unavailable, fall back to English
      });
    }
  }, [isHi]);

  const filtered = useMemo(() => {
    setPage(1);
    if (!reports) return [];
    const q = search.toLowerCase();
    return reports.filter(r => {
      if (level    && r.level    !== level)    return false;
      if (state    && r.state    !== state)    return false;
      if (category && r.category !== category) return false;
      if (year     && r.year     !== Number(year)) return false;
      if (severity && r.severity !== severity) return false;
      if (q) {
        const haystack = `${r.title} ${r.state} ${r.reportNo} ${r.ministry} ${r.overview} ${r.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, level, state, category, year, severity]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activePills = [
    level    && { label: isHi ? (LEVEL_HI[level] ?? level) : level, clear: () => setLevel('') },
    state    && { label: isHi ? (stateNamesHi[state] ?? state) : state, clear: () => setState('') },
    category && { label: isHi ? (CATEGORY_HI[category] ?? category) : category, clear: () => setCategory('') },
    year     && { label: year, clear: () => setYear('') },
    severity && { label: `${isHi ? (SEVERITY_HI[severity] ?? severity) : severity} ${t('severitySuffix')}`, clear: () => setSeverity('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => { setLevel(''); setState(''); setCategory(''); setYear(''); setSeverity(''); setSearch(''); setPage(1); };

  return (
    <div className="ch-listing">
      <SEO
        title={isHi ? "CAG लेखापरीक्षा रिपोर्ट डेटाबेस — 1,800+ रिपोर्टें" : "CAG Audit Reports Database — 1,800+ Reports"}
        description={isHi ? "केंद्र सरकार की योजनाओं और मंत्रालयों पर 1,800+ CAG लेखापरीक्षा रिपोर्टें। राज्य, वर्ष, श्रेणी और गंभीरता के अनुसार फ़िल्टर करें।" : "1,800+ CAG audit reports on Union Government schemes and ministries. Filter by state, year, category, and severity."}
        path="/reports"
        ogImage="/og/reports.jpg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="ch-listing__title mb-1 text-3xl font-bold">{t('cagPageTitle')}</h1>
          <p className="ch-listing__lede max-w-2xl">
            {t('descriptionIntro')}
            {' '}<span className="font-medium text-foreground">{TOTAL_REPORTS.toLocaleString()}</span>{' '}{t('descriptionOutro')}
          </p>
        </div>

        {/* Search + filter toggle */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchReportsPlaceholder')}
              className="ch-control w-full py-2.5 pl-10 pr-4 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${sidebarOpen || activePills.length > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <Filter className="w-4 h-4" />
            {t('filters')}
            {activePills.length > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                {activePills.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {sidebarOpen && (
          <div className="mb-5 p-4 rounded-xl border border-border bg-card">
            <div className="flex flex-wrap gap-4">
              <FilterSelect
                label={t('filterLevel')}
                value={level}
                options={ALL_LEVELS}
                labels={isHi ? LEVEL_HI : undefined}
                onChange={setLevel}
              />
              <FilterSelect
                label={t('filterState')}
                value={state}
                options={ALL_STATES}
                labels={isHi ? stateNamesHi : undefined}
                onChange={setState}
              />
              <FilterSelect
                label={t('filterCategory')}
                plural={t('filterCategories')}
                value={category}
                options={ALL_CATEGORIES}
                labels={isHi ? CATEGORY_HI : undefined}
                onChange={setCategory}
              />
              <FilterSelect
                label={t('filterYear')}
                value={year}
                options={ALL_YEARS.map(String)}
                onChange={setYear}
              />
              <FilterSelect
                label={t('filterSeverity')}
                plural={t('filterSeverities')}
                value={severity}
                options={['high', 'medium', 'low']}
                labels={isHi ? SEVERITY_HI : undefined}
                onChange={setSeverity}
              />
            </div>
          </div>
        )}

        {/* Active filter pills */}
        {activePills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            {activePills.map(p => (
              <FilterPill key={p.label} label={p.label} onRemove={p.clear} />
            ))}
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline">
              {t('clearAll')}
            </button>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">
            {t('showing')} <span className="font-semibold text-foreground">{filtered.length}</span>{filtered.length < TOTAL_REPORTS ? <> {t('of')} {TOTAL_REPORTS}</> : ''} {t('reports')}
            {totalPages > 1 && <span className="ml-2 text-muted-foreground/60">· {t('page')} {page}/{totalPages}</span>}
          </p>
          {/* Summary stats */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span><span className="font-medium text-red-600">{filtered.filter(r => r.severity === 'high').length}</span> {t('highSeverity')}</span>
            <span><span className="font-medium text-orange-600">{filtered.filter(r => r.severity === 'medium').length}</span> {t('medium')}</span>
            <span><span className="font-medium text-foreground">{filtered.filter(r => r.level === 'Central').length}</span> {t('central')}</span>
          </div>
        </div>

        {/* Report grid */}
        {!reports ? (
          /* Loading skeleton — data is being fetched */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 animate-pulse">
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-muted" />
                  <div className="h-5 w-24 rounded-full bg-muted" />
                </div>
                <div className="h-3 w-40 rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-5/6 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('noReportsMatch')}</p>
            <button onClick={clearAll} className="mt-2 text-sm text-primary hover:underline">{t('clearAllFilters')}</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginated.map(r => <ReportCard key={r.id} report={r} cagHiMap={cagHiMap} />)}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← {t('previous') ?? 'Previous'}
                </button>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) { p = i + 1; }
                    else if (page <= 4) { p = i + 1; if (i === 6) p = totalPages; }
                    else if (page >= totalPages - 3) { p = totalPages - 6 + i; if (i === 0) p = 1; }
                    else { p = [1, page - 2, page - 1, page, page + 1, page + 2, totalPages][i]; }
                    const isEllipsis = (i === 1 && p !== 2) || (i === 5 && p !== totalPages - 1);
                    return isEllipsis ? (
                      <span key={i} className="w-8 text-center text-muted-foreground text-sm">…</span>
                    ) : (
                      <button
                        key={i}
                        onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground hover:bg-muted'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('next') ?? 'Next'} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/seo';
import { Navbar } from '@/components/navbar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ExternalLink, Users, Trophy, Scale, IndianRupee, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import stateNamesHiRaw from '@/data/state-names-hi.json';

const stateNamesHi = stateNamesHiRaw as Record<string, string>;

interface Politician {
  mynetaId: number;
  name: string;
  isWinner: boolean;
  party: string;
  criminalCases: number;
  education: string | null;
  age: number | null;
  totalAssetsInr: number | null;
  liabilitiesInr: number | null;
  constituency: string;
  state: string;
}

interface PoliticiansData {
  meta: { election: string; electionYear: number; crawledAt: string; totalCandidates: number; winners: number };
  candidates: Politician[];
}

const MYNETA_BASE = 'https://www.myneta.info/LokSabha2024';
const PAGE_SIZE = 50;

type SortKey = 'name' | 'cases' | 'age' | 'assets' | 'liabilities';

const SORT_FIELD: Record<Exclude<SortKey, 'name'>, (c: Politician) => number | null> = {
  cases: c => c.criminalCases,
  age: c => c.age,
  assets: c => c.totalAssetsInr,
  liabilities: c => c.liabilitiesInr,
};

const EDUCATION_HI: Record<string, string> = {
  'Post Graduate': 'स्नातकोत्तर',
  'Graduate': 'स्नातक',
  'Graduate Professional': 'स्नातक (व्यावसायिक)',
  '12th Pass': '12वीं पास',
  '10th Pass': '10वीं पास',
  '8th Pass': '8वीं पास',
  '5th Pass': '5वीं पास',
  'Doctorate': 'डॉक्टरेट',
  'Literate': 'साक्षर',
  'Illiterate': 'निरक्षर',
  'Others': 'अन्य',
  'Not Given': 'उपलब्ध नहीं',
};

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th
      className="px-4 py-3"
      aria-sort={isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        onClick={() => onSort(sortKey)}
        className={`group flex items-center gap-1 w-full ${justify} text-[11px] font-semibold uppercase tracking-widest transition-colors ${
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
        data-testid={`sort-${sortKey}`}
      >
        {label}
        <Icon className={`w-3 h-3 flex-shrink-0 ${isActive ? '' : 'opacity-40 group-hover:opacity-70'}`} />
      </button>
    </th>
  );
}

/** ₹19,29,46,528 → "₹19.3 Cr"; ₹13,58,312 → "₹13.6 L" */
function formatInr(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e9 ? 0 : 1)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Politicians() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';

  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [party, setParty] = useState('');
  const [result, setResult] = useState('');
  const [record, setRecord] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);

  const toggleSort = (key: SortKey) =>
    setSort(s =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );

  // Lazy-load the 1.8 MB candidate data — keeps it out of the initial JS bundle
  const [data, setData] = useState<PoliticiansData | null>(null);
  useEffect(() => {
    import('@/data/politicians-ls2024.json').then(m => {
      setData(m.default as unknown as PoliticiansData);
    });
  }, []);

  const candidates = data?.candidates;

  const states = useMemo(
    () => (candidates ? [...new Set(candidates.map(c => c.state))].sort() : []),
    [candidates],
  );

  // Parties with enough candidates to be worth a dropdown entry (search covers the rest)
  const parties = useMemo(() => {
    if (!candidates) return [];
    const counts = new Map<string, number>();
    for (const c of candidates) counts.set(c.party, (counts.get(c.party) ?? 0) + 1);
    return [...counts.entries()]
      .filter(([, n]) => n >= 15)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [candidates]);

  const filtered = useMemo(() => {
    setPage(1);
    if (!candidates) return [];
    const q = search.toLowerCase();
    const rows = candidates.filter(c => {
      if (state && c.state !== state) return false;
      if (party && c.party !== party) return false;
      if (result === 'winner' && !c.isWinner) return false;
      if (record === 'cases' && c.criminalCases === 0) return false;
      if (record === 'clean' && c.criminalCases > 0) return false;
      if (q) {
        const haystack = `${c.name} ${c.constituency} ${c.party} ${c.state}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'name') {
      rows.sort((a, b) => dirMul * a.name.localeCompare(b.name));
    } else {
      const field = SORT_FIELD[sort.key];
      rows.sort((a, b) => {
        const av = field(a);
        const bv = field(b);
        if (av === null && bv === null) return a.name.localeCompare(b.name);
        if (av === null) return 1; // undisclosed values always sink to the bottom
        if (bv === null) return -1;
        return dirMul * (av - bv) || a.name.localeCompare(b.name);
      });
    }
    return rows;
  }, [candidates, search, state, party, result, record, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    if (!candidates) return null;
    const withCases = candidates.filter(c => c.criminalCases > 0).length;
    const crorepati = candidates.filter(c => (c.totalAssetsInr ?? 0) >= 1e7).length;
    return {
      total: candidates.length,
      winners: candidates.filter(c => c.isWinner).length,
      withCases,
      withCasesPct: Math.round((100 * withCases) / candidates.length),
      crorepati,
      crorepatiPct: Math.round((100 * crorepati) / candidates.length),
    };
  }, [candidates]);

  const statTiles = stats
    ? [
        { icon: Users, label: t('polStatCandidates'), value: stats.total.toLocaleString('en-IN'), sub: null },
        { icon: Trophy, label: t('polStatWinners'), value: stats.winners.toLocaleString('en-IN'), sub: null },
        { icon: Scale, label: t('polStatCriminal'), value: stats.withCases.toLocaleString('en-IN'), sub: `${stats.withCasesPct}%` },
        { icon: IndianRupee, label: t('polStatCrorepati'), value: stats.crorepati.toLocaleString('en-IN'), sub: `${stats.crorepatiPct}%` },
      ]
    : [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title="Lok Sabha 2024 Candidates — Criminal Cases, Assets & Education"
        description="Affidavit data for all 8,000+ Lok Sabha 2024 candidates — criminal cases, declared assets, education and age. Sourced from ECI affidavits via ADR/myneta.info."
        path="/politicians"
      />
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('polPageHeading')}</h1>
          <p className="text-muted-foreground">{t('polPageDescription')}</p>
          <p className="text-xs text-muted-foreground/70 font-mono mt-2">
            {t('polSourceLine')}{' '}
            <a
              href={`${MYNETA_BASE}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              myneta.info
            </a>
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statTiles.map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-card border border-card-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-semibold uppercase tracking-widest">{label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">{value}</span>
                {sub && <span className="text-sm font-mono text-muted-foreground">({sub})</span>}
              </div>
            </div>
          ))}
          {!stats &&
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3"></div>
                <div className="h-6 bg-muted rounded w-1/3"></div>
              </div>
            ))}
        </div>

        {/* Filters */}
        <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('polSearchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-politicians"
              />
            </div>

            <Select value={state || 'all'} onValueChange={(val) => setState(val === 'all' ? '' : val)}>
              <SelectTrigger data-testid="select-state">
                <SelectValue placeholder={t('polAllStates')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('polAllStates')}</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {isHi ? (stateNamesHi[s] ?? s) : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={party || 'all'} onValueChange={(val) => setParty(val === 'all' ? '' : val)}>
              <SelectTrigger data-testid="select-party">
                <SelectValue placeholder={t('polAllParties')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('polAllParties')}</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={result || 'all'} onValueChange={(val) => setResult(val === 'all' ? '' : val)}>
              <SelectTrigger data-testid="select-result">
                <SelectValue placeholder={t('polAllCandidates')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('polAllCandidates')}</SelectItem>
                <SelectItem value="winner">{t('polWinnersOnly')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={record || 'all'} onValueChange={(val) => setRecord(val === 'all' ? '' : val)}>
              <SelectTrigger data-testid="select-record">
                <SelectValue placeholder={t('polAnyRecord')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('polAnyRecord')}</SelectItem>
                <SelectItem value="cases">{t('polWithCases')}</SelectItem>
                <SelectItem value="clean">{t('polNoCases')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort control for small screens — the sortable table headers are hidden there */}
            <div className="flex gap-2 md:hidden">
              <Select
                value={sort.key}
                onValueChange={(val) => setSort({ key: val as SortKey, dir: val === 'name' ? 'asc' : 'desc' })}
              >
                <SelectTrigger data-testid="select-sort-mobile" className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t('polSortBy')}: {t('polColCandidate')}</SelectItem>
                  <SelectItem value="cases">{t('polSortBy')}: {t('polColCases')}</SelectItem>
                  <SelectItem value="age">{t('polSortBy')}: {t('polColAge')}</SelectItem>
                  <SelectItem value="assets">{t('polSortBy')}: {t('polColAssets')}</SelectItem>
                  <SelectItem value="liabilities">{t('polSortBy')}: {t('polColLiabilities')}</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
                aria-label={t('polSortDir')}
                title={t('polSortDir')}
                className="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                data-testid="button-sort-dir"
              >
                {sort.dir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {!candidates ? (
          <div className="bg-card border border-card-border rounded-lg p-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded mb-2 animate-pulse"></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('polNoResults')}</h3>
            <p className="text-muted-foreground">{t('polEmptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {t('foundCountPrefix')} {filtered.length.toLocaleString('en-IN')} {t('polCandidatesWord')}
              {totalPages > 1 && (
                <span className="ml-2 text-muted-foreground/60">
                  · {t('page')} {page}/{totalPages}
                </span>
              )}
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((c) => (
                <div
                  key={c.mynetaId}
                  className="bg-card border border-card-border rounded-lg p-4"
                  data-testid={`card-politician-${c.mynetaId}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="font-medium text-foreground flex items-center gap-2 flex-wrap min-w-0">
                      {c.name}
                      {c.isWinner && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border bg-emerald-100 text-emerald-900 border-emerald-200 leading-none">
                          {t('polWinnerBadge')}
                        </span>
                      )}
                    </div>
                    <a
                      href={`${MYNETA_BASE}/candidate.php?candidate_id=${c.mynetaId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('polViewOnMyneta')}
                      className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {c.party} · {c.constituency} · {isHi ? (stateNamesHi[c.state] ?? c.state) : c.state}
                  </p>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{t('polColCases')}</div>
                      {c.criminalCases > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border bg-red-100 text-red-900 border-red-200">
                          {c.criminalCases}
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground/60">0</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{t('polColAge')}</div>
                      <span className="font-mono text-foreground">{c.age ?? '—'}</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{t('polColEducation')}</div>
                      <span className="text-muted-foreground">
                        {c.education ? (isHi ? (EDUCATION_HI[c.education] ?? c.education) : c.education) : '—'}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{t('polColAssets')}</div>
                      <span className="font-mono font-medium text-foreground">{formatInr(c.totalAssetsInr)}</span>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{t('polColLiabilities')}</div>
                      <span className="font-mono text-muted-foreground">{formatInr(c.liabilitiesInr)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: sortable table */}
            <div className="hidden md:block bg-card border border-card-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <SortableTh label={t('polColCandidate')} sortKey="name" sort={sort} onSort={toggleSort} />
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t('polColParty')}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t('polColConstituency')}</th>
                    <SortableTh label={t('polColCases')} sortKey="cases" sort={sort} onSort={toggleSort} align="center" />
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t('polColEducation')}</th>
                    <SortableTh label={t('polColAge')} sortKey="age" sort={sort} onSort={toggleSort} align="right" />
                    <SortableTh label={t('polColAssets')} sortKey="assets" sort={sort} onSort={toggleSort} align="right" />
                    <SortableTh label={t('polColLiabilities')} sortKey="liabilities" sort={sort} onSort={toggleSort} align="right" />
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center">{t('polColSource')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => (
                    <tr
                      key={c.mynetaId}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                      data-testid={`row-politician-${c.mynetaId}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {c.name}
                          {c.isWinner && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border bg-emerald-100 text-emerald-900 border-emerald-200 leading-none">
                              {t('polWinnerBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.party}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {c.constituency}
                        <span className="text-muted-foreground/60"> · {isHi ? (stateNamesHi[c.state] ?? c.state) : c.state}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {c.criminalCases > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border bg-red-100 text-red-900 border-red-200">
                            {c.criminalCases}
                          </span>
                        ) : (
                          <span className="font-mono text-muted-foreground/60">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {c.education ? (isHi ? (EDUCATION_HI[c.education] ?? c.education) : c.education) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.age ?? '—'}</td>
                      <td
                        className="px-4 py-2.5 text-right font-mono font-medium text-foreground"
                        title={c.totalAssetsInr !== null ? `₹${c.totalAssetsInr.toLocaleString('en-IN')}` : undefined}
                      >
                        {formatInr(c.totalAssetsInr)}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right font-mono text-muted-foreground"
                        title={c.liabilitiesInr !== null ? `₹${c.liabilitiesInr.toLocaleString('en-IN')}` : undefined}
                      >
                        {formatInr(c.liabilitiesInr)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <a
                          href={`${MYNETA_BASE}/candidate.php?candidate_id=${c.mynetaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('polViewOnMyneta')}
                          title={t('polViewOnMyneta')}
                          className="inline-flex text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1 mt-6">
                <button
                  onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  ← {t('previous')}
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) { p = i + 1; }
                  else if (page <= 4) { p = i + 1; if (i === 6) p = totalPages; }
                  else if (page >= totalPages - 3) { p = totalPages - 6 + i; if (i === 0) p = 1; }
                  else { p = [1, page - 2, page - 1, page, page + 1, page + 2, totalPages][i]; }
                  const isEllipsis = totalPages > 7 && ((i === 1 && p !== 2) || (i === 5 && p !== totalPages - 1));
                  return isEllipsis ? (
                    <span key={i} className="px-2 text-muted-foreground/60">…</span>
                  ) : (
                    <button
                      key={i}
                      onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className={
                        p === page
                          ? 'px-3 py-1.5 text-sm rounded-md bg-primary/10 text-primary font-medium'
                          : 'px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
                      }
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  {t('next')} →
                </button>
              </div>
            )}
          </>
        )}

        {/* Methodology / disclaimer */}
        <p className="text-xs text-muted-foreground/70 mt-8 leading-relaxed">
          {t('polDisclaimer')}
        </p>
      </div>
    </div>
  );
}

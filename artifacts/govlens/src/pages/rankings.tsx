import { useState } from 'react';
import { SEO } from '@/components/seo';
import { STATE_FACTS } from '@/data/state-facts-data';
import { Link } from 'wouter';
import { ArrowLeft, TrendingUp, GraduationCap, Briefcase, HeartPulse, ShieldCheck, Leaf, Eye, Scale, Users, ChevronUp, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import stateNamesHiRaw from '@/data/state-names-hi.json';
const stateNamesHi = stateNamesHiRaw as Record<string, string>;

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'governance',         labelKey: 'navGovernance',         group: 'accountability', icon: Scale },
  { key: 'transparency',       labelKey: 'navTransparency',       group: 'accountability', icon: Eye },
  { key: 'officialsIntegrity', labelKey: 'navOfficialsIntegrity', group: 'accountability', icon: Users },
  { key: 'economy',            labelKey: 'navEconomy',            group: 'indicator',      icon: TrendingUp },
  { key: 'education',          labelKey: 'navEducation',          group: 'indicator',      icon: GraduationCap },
  { key: 'employment',         labelKey: 'navEmployment',         group: 'indicator',      icon: Briefcase },
  { key: 'health',             labelKey: 'navHealth',             group: 'indicator',      icon: HeartPulse },
  { key: 'safety',             labelKey: 'navSafety',             group: 'indicator',      icon: ShieldCheck },
  { key: 'environment',        labelKey: 'navEnvironment',        group: 'indicator',      icon: Leaf },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

function getScore(stateCode: string, key: CategoryKey): number | null {
  const fact = STATE_FACTS.find(f => f.stateCode === stateCode);
  if (!fact) return null;

  const cat = CATEGORIES.find(c => c.key === key)!;
  if (cat.group === 'accountability') {
    return fact.accountabilityRatings.find(r => r.key === key)?.score ?? null;
  } else {
    return fact.indicators.find(i => i.key === key)?.score ?? null;
  }
}

function scoreColor(score: number) {
  if (score >= 70) return { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' };
  return { bar: 'bg-red-500',   text: 'text-red-600 dark:text-red-400',   badge: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' };
}

function regionBadgeColor(region: string) {
  const map: Record<string, string> = {
    'South': 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    'North India': 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
    'Northeast': 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    'East India': 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
    'West India': 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300',
    'Central India': 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300',
  };
  return map[region] ?? 'bg-muted text-muted-foreground';
}

const REGION_KEY: Record<string, string> = {
  'South': 'regionSouth',
  'North India': 'regionNorthIndia',
  'Northeast': 'regionNortheast',
  'East India': 'regionEastIndia',
  'West India': 'regionWestIndia',
  'Central India': 'regionCentralIndia',
};

export default function Rankings() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [activeKey, setActiveKey] = useState<CategoryKey>('governance');

  const [sortAsc, setSortAsc] = useState(false);

  const activeCat = CATEGORIES.find(c => c.key === activeKey)!;
  const activeCatLabel = t(activeCat.labelKey);

  const rows = STATE_FACTS
    .map(fact => ({ fact, score: getScore(fact.stateCode, activeKey) }))
    .filter(r => r.score !== null)
    .sort((a, b) => sortAsc ? (a.score! - b.score!) : (b.score! - a.score!))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const top = rows[0]?.score ?? 100;
  const accountabilityKeys: CategoryKey[] = ['governance', 'transparency', 'officialsIntegrity'];
  const indicatorKeys: CategoryKey[] = ['economy', 'education', 'employment', 'health', 'safety', 'environment'];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isHi ? "भारत राज्य रैंकिंग — शासन, अर्थव्यवस्था और सामाजिक स्कोर" : "India State Rankings — Governance, Economy & Social Scores"}
        description={isHi ? "सभी भारतीय राज्यों की शासन, पारदर्शिता, अर्थव्यवस्था, शिक्षा, स्वास्थ्य, रोजगार और पर्यावरण स्कोर के आधार पर रैंकिंग।" : "Ranked list of all Indian states by governance, transparency, economy, education, health, employment, and environment scores. State-by-state accountability data."}
        path="/rankings"
        ogImage="/og/state-facts.jpg"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/state-facts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('rankingsBack')}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{t('rankingsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('rankingsDesc', { count: rows.length })}
          </p>
        </div>

        {/* Category tabs */}
        <div className="mb-5 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{t('rankingsAccountabilityGroup')}</p>
            <div className="flex flex-wrap gap-1.5">
              {accountabilityKeys.map(key => {
                const cat = CATEGORIES.find(c => c.key === key)!;
                const Icon = cat.icon;
                const isActive = activeKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveKey(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t(cat.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{t('rankingsDevelopmentGroup')}</p>
            <div className="flex flex-wrap gap-1.5">
              {indicatorKeys.map(key => {
                const cat = CATEGORIES.find(c => c.key === key)!;
                const Icon = cat.icon;
                const isActive = activeKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveKey(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t(cat.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ranking table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {(() => { const Icon = activeCat.icon; return <Icon className="w-4 h-4 text-primary" />; })()}
              <span className="text-sm font-semibold text-foreground">{activeCatLabel}</span>
              <span className="text-xs text-muted-foreground">— {rows.length} {t('rankingsStatesRanked')}</span>
            </div>
            <button
              onClick={() => setSortAsc(v => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
              {sortAsc ? t('rankingsLowestFirst') : t('rankingsHighestFirst')}
            </button>
          </div>

          <div className="divide-y divide-border">
            {rows.map(({ fact, score, rank }) => {
              const s = score!;
              const colors = scoreColor(s);
              const barWidth = top > 0 ? (s / top) * 100 : 0;
              const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

              return (
                <Link
                  key={fact.stateCode}
                  href={`/state-facts?state=${fact.stateCode}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className="w-8 flex-shrink-0 text-center">
                    {rankMedal
                      ? <span className="text-base leading-none">{rankMedal}</span>
                      : <span className="text-xs font-mono font-semibold text-muted-foreground">#{rank}</span>
                    }
                  </div>

                  <div className="w-9 flex-shrink-0">
                    <span className="inline-flex items-center justify-center text-[11px] font-mono font-bold bg-muted rounded px-1.5 py-0.5 text-foreground">
                      {fact.stateCode}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {isHi ? (stateNamesHi[fact.name] ?? fact.name) : fact.name}
                      </span>
                      <span className={`hidden sm:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${regionBadgeColor(fact.region)}`}>
                        {t(REGION_KEY[fact.region] ?? fact.region, { defaultValue: fact.region })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[180px] sm:max-w-[260px]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <span className={`text-lg font-bold font-mono ${colors.text}`}>{s}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center gap-4 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium">{t('rankingsScoreBands')}</span>
            <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> 70–100 {t('rankingsStrong')}</span>
            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 50–69 {t('rankingsModerate')}</span>
            <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 0–49 {t('rankingsWeak')}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

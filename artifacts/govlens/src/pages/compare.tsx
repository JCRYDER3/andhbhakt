import { useState, useMemo, useEffect } from 'react';
import { Navbar } from '@/components/navbar';
import { SEO } from '@/components/seo';
import { STATE_FACTS, type StateFact } from '@/data/state-facts-data';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import stateNamesHiRaw from '@/data/state-names-hi.json';
import {
  Scale,
  TrendingUp,
  GraduationCap,
  Briefcase,
  HeartPulse,
  ShieldCheck,
  Leaf,
  Eye,
  Users,
  AlertTriangle,
  FileText,
  Share2,
  Check,
  Copy,
  Plus,
  X,
  Sparkles,
  ArrowRight,
  ArrowUpDown,
  Layers,
  ChevronRight,
  BarChart2,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

const stateNamesHi = stateNamesHiRaw as Record<string, string>;

// ── Comparison Colors for up to 3 states ────────────────────────────────────
const STATE_COLORS = [
  {
    name: 'Emerald / Green',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    border: 'border-emerald-500/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    fill: '#10b981',
    stroke: '#059669',
    ring: 'ring-emerald-500',
  },
  {
    name: 'Blue / Indigo',
    bg: 'bg-blue-500/10 dark:bg-blue-950/30',
    border: 'border-blue-500/40',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    fill: '#3b82f6',
    stroke: '#2563eb',
    ring: 'ring-blue-500',
  },
  {
    name: 'Amber / Orange',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    border: 'border-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    fill: '#f59e0b',
    stroke: '#d97706',
    ring: 'ring-amber-500',
  },
];

// ── Categories & Dimensions ──────────────────────────────────────────────────
const COMPARISON_DIMENSIONS = [
  { key: 'governance', labelKey: 'navGovernance', defaultLabel: 'Governance', icon: Scale, group: 'accountability' },
  { key: 'transparency', labelKey: 'navTransparency', defaultLabel: 'Transparency', icon: Eye, group: 'accountability' },
  { key: 'officialsIntegrity', labelKey: 'navOfficialsIntegrity', defaultLabel: 'Officials Integrity', icon: Users, group: 'accountability' },
  { key: 'economy', labelKey: 'navEconomy', defaultLabel: 'Economy', icon: TrendingUp, group: 'indicator' },
  { key: 'education', labelKey: 'navEducation', defaultLabel: 'Education', icon: GraduationCap, group: 'indicator' },
  { key: 'employment', labelKey: 'navEmployment', defaultLabel: 'Employment', icon: Briefcase, group: 'indicator' },
  { key: 'health', labelKey: 'navHealth', defaultLabel: 'Health', icon: HeartPulse, group: 'indicator' },
  { key: 'safety', labelKey: 'navSafety', defaultLabel: 'Safety & Justice', icon: ShieldCheck, group: 'indicator' },
  { key: 'environment', labelKey: 'navEnvironment', defaultLabel: 'Environment', icon: Leaf, group: 'indicator' },
] as const;

// ── Featured Comparison Presets ──────────────────────────────────────────────
const PRESETS = [
  { label: 'Kerala vs Gujarat', states: ['KL', 'GJ'], desc: 'Social development model vs industrial growth model' },
  { label: 'UP vs Maharashtra vs Tamil Nadu', states: ['UP', 'MH', 'TN'], desc: 'India\'s 3 economic powerhouses' },
  { label: 'Himachal vs Uttarakhand', states: ['HP', 'UK'], desc: 'Himalayan hill state governance' },
  { label: 'Punjab vs Haryana', states: ['PB', 'HR'], desc: 'Agrarian belt comparison' },
  { label: 'Karnataka vs Telangana', states: ['KA', 'TG'], desc: 'Southern tech hubs' },
  { label: 'Assam vs Meghalaya', states: ['AS', 'ML'], desc: 'Northeast governance models' },
];

function getScore(fact: StateFact, dimensionKey: string): number {
  const acc = fact.accountabilityRatings?.find(r => r.key === dimensionKey);
  if (acc) return acc.score;
  const ind = fact.indicators?.find(i => i.key === dimensionKey);
  if (ind) return ind.score;
  return 0;
}

export default function CompareStates() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [location, setLocation] = useLocation();

  // Read initial states from URL query string (e.g. /compare?states=KL,GJ)
  const initialStates = useMemo(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const statesParam = searchParams.get('states');
      if (statesParam) {
        const codes = statesParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const validCodes = codes.filter(code => STATE_FACTS.some(f => f.stateCode === code));
        if (validCodes.length >= 2) return validCodes.slice(0, 3);
      }
    } catch {
      // fallback
    }
    return ['KL', 'GJ'];
  }, []);

  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialStates);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'radar' | 'indicators' | 'cag'>('overview');

  // Sync state changes with URL query string
  useEffect(() => {
    const url = `/compare?states=${selectedCodes.join(',')}`;
    window.history.replaceState(null, '', url);
  }, [selectedCodes]);

  const selectedStates: StateFact[] = useMemo(() => {
    return selectedCodes
      .map(code => STATE_FACTS.find(f => f.stateCode === code))
      .filter((s): s is StateFact => Boolean(s));
  }, [selectedCodes]);

  const handleAddState = (code: string) => {
    if (selectedCodes.includes(code)) return;
    if (selectedCodes.length >= 3) {
      setSelectedCodes([selectedCodes[0], selectedCodes[1], code]);
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const handleRemoveState = (code: string) => {
    if (selectedCodes.length <= 2) return; // Keep at least 2 states
    setSelectedCodes(selectedCodes.filter(c => c !== code));
  };

  const handleReplaceState = (index: number, newCode: string) => {
    if (selectedCodes.includes(newCode)) return;
    const next = [...selectedCodes];
    next[index] = newCode;
    setSelectedCodes(next);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Prepare Radar Data ───────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    return COMPARISON_DIMENSIONS.map(dim => {
      const entry: Record<string, string | number> = {
        dimension: isHi ? t(dim.labelKey, { defaultValue: dim.defaultLabel }) : dim.defaultLabel,
      };
      selectedStates.forEach((state) => {
        entry[state.name] = getScore(state, dim.key);
      });
      return entry;
    });
  }, [selectedStates, isHi, t]);

  // ── Prepare Bar Comparison Data ─────────────────────────────────────────────
  const barData = useMemo(() => {
    return COMPARISON_DIMENSIONS.map(dim => {
      const entry: Record<string, string | number> = {
        dimension: isHi ? t(dim.labelKey, { defaultValue: dim.defaultLabel }) : dim.defaultLabel,
      };
      selectedStates.forEach(state => {
        entry[state.name] = getScore(state, dim.key);
      });
      return entry;
    });
  }, [selectedStates, isHi, t]);

  const stateDisplayName = (fact: StateFact) => {
    return isHi ? (stateNamesHi[fact.name] ?? fact.name) : fact.name;
  };

  const pageTitle = isHi
    ? `राज्य तुलना — ${selectedStates.map(stateDisplayName).join(' बनाम ')}`
    : `State Comparison — ${selectedStates.map(s => s.name).join(' vs ')}`;

  const pageDescription = isHi
    ? `${selectedStates.map(stateDisplayName).join(', ')} के शासन, अर्थव्यवस्था, शिक्षा, स्वास्थ्य, सुरक्षा और CAG ऑडिट निष्कर्षों की विस्तृत तुलना।`
    : `Side-by-side civic comparison of ${selectedStates.map(s => s.name).join(', ')} across Governance, Economy, Health, Education, Environment, and CAG audits.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={pageTitle}
        description={pageDescription}
        path={`/compare?states=${selectedCodes.join(',')}`}
        ogImage="/og/state-facts.jpg"
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Breadcrumbs & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Link href="/state-facts" className="hover:text-foreground transition-colors">
                {isHi ? 'राज्य तथ्य' : 'State Facts'}
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/rankings" className="hover:text-foreground transition-colors">
                {isHi ? 'रैंकिंग' : 'Rankings'}
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{isHi ? 'तुलना मैट्रिक्स' : 'Comparison Matrix'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
              <Layers className="w-7 h-7 text-primary flex-shrink-0" />
              <span>{isHi ? 'राज्यों की तुलना' : 'State-vs-State Comparison'}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isHi
                ? 'दो या तीन राज्यों का शासन, सामाजिक विकास और CAG ऑडिट परिणामों का सीधा विश्लेषण।'
                : 'Side-by-side benchmark of governance, developmental indicators, and CAG audit findings.'}
            </p>
          </div>

          {/* Share Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
              title="Copy share link"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? (isHi ? 'लिंक कॉपी हो गया!' : 'Link Copied!') : (isHi ? 'तुलना साझा करें' : 'Share Comparison')}</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{isHi ? 'सुझाई गई तुलनाएँ' : 'Popular Comparisons'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const isActive =
                preset.states.length === selectedCodes.length &&
                preset.states.every((s, i) => selectedCodes[i] === s);
              return (
                <button
                  key={preset.label}
                  onClick={() => setSelectedCodes(preset.states)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* State Selection Dropdowns */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isHi ? 'तुलना के लिए राज्य चुनें (अधिकतम 3)' : 'Select States to Compare (Up to 3)'}
            </span>
            {selectedCodes.length < 3 && (
              <span className="text-xs text-muted-foreground">
                {isHi ? '+ तीसरा राज्य जोड़ें' : '+ Add a 3rd state'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {selectedStates.map((state, idx) => {
              const color = STATE_COLORS[idx];
              return (
                <div
                  key={state.stateCode}
                  className={`relative p-4 rounded-lg border-2 ${color.border} ${color.bg} transition-all`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-background border border-border">
                      State {idx + 1}
                    </span>
                    {selectedStates.length > 2 && (
                      <button
                        onClick={() => handleRemoveState(state.stateCode)}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded hover:bg-background/80"
                        title="Remove state"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={state.stateCode}
                    onChange={(e) => handleReplaceState(idx, e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {STATE_FACTS.map((f) => (
                      <option
                        key={f.stateCode}
                        value={f.stateCode}
                        disabled={selectedCodes.includes(f.stateCode) && f.stateCode !== state.stateCode}
                      >
                        {isHi ? (stateNamesHi[f.name] ?? f.name) : f.name} ({f.stateCode})
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{state.region}</span>
                    <span>{isHi ? 'राजधानी:' : 'Capital:'} {state.capital}</span>
                  </div>
                </div>
              );
            })}

            {/* Slot for 3rd State if currently only 2 selected */}
            {selectedStates.length === 2 && (
              <div className="p-4 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center min-h-[120px] bg-muted/20 hover:bg-muted/40 transition-colors">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  {isHi ? 'तीसरा राज्य जोड़ें' : 'Add 3rd State'}
                </p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleAddState(e.target.value);
                  }}
                  className="bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="" disabled>
                    {isHi ? '-- राज्य चुनें --' : '-- Select State --'}
                  </option>
                  {STATE_FACTS.filter((f) => !selectedCodes.includes(f.stateCode)).map((f) => (
                    <option key={f.stateCode} value={f.stateCode}>
                      {isHi ? (stateNamesHi[f.name] ?? f.name) : f.name} ({f.stateCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border mb-6 gap-2 sm:gap-4 overflow-x-auto">
          {[
            { key: 'overview', label: isHi ? 'सिंहावलोकन' : 'Executive Summary' },
            { key: 'radar', label: isHi ? 'रडार व चार्ट तुलना' : 'Radar & Score Benchmark' },
            { key: 'indicators', label: isHi ? 'संकेतक-दर-संकेतक' : 'Indicator Breakdown' },
            { key: 'cag', label: isHi ? 'CAG ऑडिट तुलना' : 'CAG Audits' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 px-2 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: EXECUTIVE SUMMARY */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Leadership & Political Integrity Cards */}
            <div className={`grid grid-cols-1 ${selectedStates.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-6`}>
              {selectedStates.map((state, idx) => {
                const color = STATE_COLORS[idx];
                const cm = state.cm;
                const cmCriminalCases = cm?.criminalCases ?? 0;
                const cmSeriousCases = cm?.seriousCriminalCases ?? 0;
                const govScore = getScore(state, 'governance');

                return (
                  <div key={state.stateCode} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${color.badge}`}>
                            {state.stateCode}
                          </span>
                          <h2 className="text-xl font-bold text-foreground">
                            {stateDisplayName(state)}
                          </h2>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isHi ? 'राजधानी:' : 'Capital:'} {state.capital}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-mono font-bold text-primary">{govScore}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{isHi ? 'शासन स्कोर' : 'Gov Score'}</div>
                      </div>
                    </div>

                    {/* Chief Minister Information */}
                    {cm && (
                      <div className="bg-muted/40 rounded-lg p-3 border border-border/60">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          {isHi ? 'मुख्यमंत्री' : 'Chief Minister'}
                        </div>
                        <div className="font-semibold text-foreground text-sm">{cm.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{cm.party ?? 'State Govt'}</div>

                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{isHi ? 'आपराधिक मामले:' : 'Affidavit Cases:'}</span>
                          <span
                            className={`font-semibold font-mono ${
                              cmCriminalCases > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {cmCriminalCases > 0
                              ? `${cmCriminalCases} cases ${cmSeriousCases > 0 ? `(${cmSeriousCases} serious)` : ''}`
                              : '0 declared cases'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <div className="text-muted-foreground text-[10px] uppercase">{isHi ? 'क्षेत्र' : 'Region'}</div>
                        <div className="font-semibold text-foreground font-mono mt-0.5">{state.region}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <div className="text-muted-foreground text-[10px] uppercase">{isHi ? 'CAG ऑडिट्स' : 'CAG Audits'}</div>
                        <div className="font-semibold text-foreground font-mono mt-0.5">
                          {state.cagFindings?.length ?? 0} {isHi ? 'निष्कर्ष' : 'findings'}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/state-facts?state=${state.stateCode}`}
                      className="block text-center py-2 rounded-lg border border-border text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                    >
                      {isHi ? `${stateDisplayName(state)} का पूरा विवरण →` : `View Full ${state.name} Scorecard →`}
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* High-Level Dimension Summary Comparison */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                <span>{isHi ? 'सभी 9 आयामों का प्रत्यक्ष स्कोर' : 'Direct Dimension Score Comparison'}</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-3 px-4 font-semibold text-muted-foreground">{isHi ? 'आयाम / संकेतक' : 'Dimension / Indicator'}</th>
                      {selectedStates.map((state, idx) => (
                        <th key={state.stateCode} className="py-3 px-4 font-bold text-foreground text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATE_COLORS[idx].badge}`}>
                            {stateDisplayName(state)}
                          </span>
                        </th>
                      ))}
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-center">
                        {isHi ? 'शीर्ष प्रदर्शनकर्ता' : 'Top Performer'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {COMPARISON_DIMENSIONS.map((dim) => {
                      const Icon = dim.icon;
                      const scores = selectedStates.map(s => getScore(s, dim.key));
                      const maxScore = Math.max(...scores);
                      const bestIndex = scores.indexOf(maxScore);
                      const bestState = selectedStates[bestIndex];

                      return (
                        <tr key={dim.key} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 flex items-center gap-2.5 font-medium text-foreground">
                            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>{isHi ? t(dim.labelKey, { defaultValue: dim.defaultLabel }) : dim.defaultLabel}</span>
                          </td>
                          {selectedStates.map((state, idx) => {
                            const score = getScore(state, dim.key);
                            const isLeader = score === maxScore && scores.filter(s => s === maxScore).length === 1;
                            return (
                              <td key={state.stateCode} className="py-3 px-4 text-center font-mono">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                                    isLeader
                                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : 'bg-muted text-foreground'
                                  }`}
                                >
                                  {score}/100
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-center font-medium text-xs text-foreground">
                            {scores.every(s => s === scores[0]) ? (
                              <span className="text-muted-foreground">{isHi ? 'समान' : 'Tied'}</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {stateDisplayName(bestState)} ({maxScore})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RADAR & SCORE CHARTS */}
        {activeTab === 'radar' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Radar Chart */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col items-center">
                <h3 className="text-base font-bold text-foreground mb-2 self-start flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>{isHi ? 'समग्र रडार प्रोफाइल (9 आयाम)' : '9-Dimension Holistic Radar Profile'}</span>
                </h3>
                <p className="text-xs text-muted-foreground self-start mb-6">
                  {isHi
                    ? 'प्रत्येक आयाम में 0 से 100 तक का स्केल — बाहरी घेरा बेहतर प्रदर्शन दर्शाता है।'
                    : 'Scale of 0 to 100 for each dimension — outer edge represents superior performance.'}
                </p>

                <div className="w-full h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="75%">
                      <PolarGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--border)" />
                      {selectedStates.map((state, idx) => {
                        const color = STATE_COLORS[idx];
                        return (
                          <Radar
                            key={state.stateCode}
                            name={stateDisplayName(state)}
                            dataKey={state.name}
                            stroke={color.stroke}
                            fill={color.fill}
                            fillOpacity={0.25}
                          />
                        );
                      })}
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grouped Bar Chart */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
                <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  <span>{isHi ? 'स्तंभ-वार स्कोर तुलना' : 'Side-by-Side Dimension Bar Chart'}</span>
                </h3>
                <p className="text-xs text-muted-foreground mb-6">
                  {isHi ? 'आयामों में प्रत्यक्ष स्कोर तुलना' : 'Direct comparison across each civic metric.'}
                </p>

                <div className="w-full h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                      <XAxis
                        dataKey="dimension"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      {selectedStates.map((state, idx) => {
                        const color = STATE_COLORS[idx];
                        return (
                          <Bar
                            key={state.stateCode}
                            name={stateDisplayName(state)}
                            dataKey={state.name}
                            fill={color.fill}
                            radius={[4, 4, 0, 0]}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DETAILED INDICATOR BREAKDOWN */}
        {activeTab === 'indicators' && (
          <div className="space-y-8">
            {['economy', 'education', 'health', 'employment', 'safety', 'environment'].map((indKey) => {
              const dimConfig = COMPARISON_DIMENSIONS.find(d => d.key === indKey)!;
              const Icon = dimConfig.icon;

              return (
                <div key={indKey} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">
                          {isHi ? t(dimConfig.labelKey, { defaultValue: dimConfig.defaultLabel }) : dimConfig.defaultLabel}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {isHi ? 'प्रमुख सांख्यिकीय सूचकांक और स्रोत' : 'Key official indicators and ground statistics'}
                        </p>
                      </div>
                    </div>

                    {/* Scores badge comparison */}
                    <div className="flex items-center gap-2">
                      {selectedStates.map((state, idx) => (
                        <div key={state.stateCode} className="text-right">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${STATE_COLORS[idx].badge}`}>
                            {state.stateCode}: {getScore(state, indKey)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Indicator Headlines comparison */}
                  <div className={`grid grid-cols-1 ${selectedStates.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4 mb-6`}>
                    {selectedStates.map((state, idx) => {
                      const ind = state.indicators?.find(i => i.key === indKey);
                      const headline = isHi && ind?.headlineHi ? ind.headlineHi : ind?.headline;
                      return (
                        <div key={state.stateCode} className={`p-3.5 rounded-lg border ${STATE_COLORS[idx].border} bg-muted/20`}>
                          <div className="text-xs font-bold text-foreground mb-1">
                            {stateDisplayName(state)}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {headline ?? 'No headline data available.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Key Stats side-by-side comparison */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {isHi ? 'विस्तृत आंकड़े व स्रोत' : 'Detailed Official Statistics'}
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                      {selectedStates[0]?.indicators
                        ?.find(i => i.key === indKey)
                        ?.stats.slice(0, 4)
                        .map((baseStat, statIdx) => (
                          <div key={statIdx} className="bg-muted/30 rounded-lg p-3 border border-border/60">
                            <div className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
                              <span>{baseStat.label}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">{baseStat.source}</span>
                            </div>

                            <div className={`grid grid-cols-1 ${selectedStates.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
                              {selectedStates.map((state, sIdx) => {
                                const stateStat = state.indicators?.find(i => i.key === indKey)?.stats[statIdx];
                                const note = isHi && stateStat?.noteHi ? stateStat.noteHi : stateStat?.note;
                                return (
                                  <div key={state.stateCode} className="p-2 rounded bg-background border border-border/40">
                                    <div className="text-[11px] font-medium text-muted-foreground">
                                      {stateDisplayName(state)}:
                                    </div>
                                    <div className="text-base font-bold font-mono text-foreground mt-0.5">
                                      {stateStat?.value ?? 'N/A'}
                                    </div>
                                    {note && (
                                      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                        {note}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: CAG AUDITS COMPARISON */}
        {activeTab === 'cag' && (
          <div className="space-y-8">
            <div className={`grid grid-cols-1 ${selectedStates.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-6`}>
              {selectedStates.map((state, idx) => {
                const audits = state.cagFindings ?? [];
                const criticalCount = audits.filter(a => a.severity === 'critical').length;
                const majorCount = audits.filter(a => a.severity === 'major').length;
                const minorCount = audits.filter(a => a.severity === 'minor').length;

                return (
                  <div key={state.stateCode} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div>
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${STATE_COLORS[idx].badge}`}>
                          {state.stateCode}
                        </span>
                        <h3 className="text-lg font-bold text-foreground mt-1">
                          {stateDisplayName(state)}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold font-mono text-foreground">{audits.length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{isHi ? 'कुल निष्कर्ष' : 'Total Audits'}</div>
                      </div>
                    </div>

                    {/* Severity breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                        <div className="font-bold text-red-600 dark:text-red-400 font-mono">{criticalCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{isHi ? 'गंभीर' : 'Critical'}</div>
                      </div>
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                        <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">{majorCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{isHi ? 'प्रमुख' : 'Major'}</div>
                      </div>
                      <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                        <div className="font-bold text-blue-600 dark:text-blue-400 font-mono">{minorCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{isHi ? 'गौण' : 'Minor'}</div>
                      </div>
                    </div>

                    {/* Audit List */}
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {audits.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          {isHi ? 'कोई CAG निष्कर्ष दर्ज नहीं है।' : 'No CAG audit findings recorded.'}
                        </p>
                      ) : (
                        audits.map((finding, fIdx) => (
                          <div key={fIdx} className="p-3 rounded-lg bg-muted/30 border border-border/60 text-xs space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-foreground truncate">{finding.scheme}</span>
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                  finding.severity === 'critical'
                                    ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                    : finding.severity === 'major'
                                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                    : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                {finding.severity}
                              </span>
                            </div>

                            <p className="text-muted-foreground text-[11px] line-clamp-3">
                              {isHi && finding.findingHi ? finding.findingHi : finding.finding}
                            </p>

                            <div className="text-[10px] text-muted-foreground pt-1 flex items-center justify-between">
                              <span>Report: {finding.reportRef} ({finding.reportYear})</span>
                              {finding.sourceUrl && (
                                <a
                                  href={finding.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  CAG Source ↗
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

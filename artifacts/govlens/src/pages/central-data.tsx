import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { SEO, websiteJsonLd } from '@/components/seo';
import niHiRaw from '@/data/national-indicators-hi.json';
interface NiHiStat { labelHi?: string; noteHi?: string; }
interface NiHi { labels?: Record<string,string>; summaries?: Record<string,string>; stats?: Record<string,NiHiStat[]>; }
const niHi = niHiRaw as NiHi;
import ministerMinistriesHiRaw from '@/data/minister-ministries-hi.json';
const ministerMinistriesHi = ministerMinistriesHiRaw as Record<string, string>;
import officialTitlesHiRaw from '@/data/official-titles-hi.json';
const officialTitlesHi = officialTitlesHiRaw as Record<string, string>;
import personNamesHiRaw from '@/data/person-names-hi.json';
const namesHi = personNamesHiRaw as Record<string, string>;
import schemeHiRaw from '@/data/scheme-translations-hi.json';
const schemeHi = schemeHiRaw as Record<string, { nameHi?: string }>;
import ministriesHiRaw from '@/data/ministries-hi.json';
const ministriesHi = ministriesHiRaw as Record<string, string>;
import sdHiRaw from '@/data/scheme-detail-hi.json';
const cagAuditHi = (sdHiRaw as { cagMap?: Record<string, { findingHi?: string; claimedHi?: string; actualHi?: string }> }).cagMap ?? {};

// ── Month-name translator for Hindi date strings (e.g. "May 2014" → "मई 2014") ──
const MONTHS_HI: Record<string, string> = {
  January: 'जनवरी', February: 'फरवरी', March: 'मार्च', April: 'अप्रैल',
  May: 'मई', June: 'जून', July: 'जुलाई', August: 'अगस्त',
  September: 'सितंबर', October: 'अक्टूबर', November: 'नवंबर', December: 'दिसंबर',
};
function hiDate(date: string): string {
  return date.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
    m => MONTHS_HI[m] ?? m);
}
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, GraduationCap, Briefcase, HeartPulse, ShieldCheck, Leaf,
  Scale, Eye, Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle,
  FileSearch, ExternalLink, Search, ListFilter, Info, X, IndianRupee,
} from 'lucide-react';
import { useListSchemes, useListCategories } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import {
  CABINET_INTEGRITY_SCORE,
  TRANSPARENCY_SCORE,
  GOVERNANCE_SCORE,
  ECONOMY_SCORE,
  EDUCATION_SCORE,
  EMPLOYMENT_SCORE,
  HEALTH_SCORE,
  SAFETY_SCORE,
  ENVIRONMENT_SCORE,
  assetGrowthPenalty,
  computeIntegrityScore,
} from '@/lib/scoring';
import { SchemeCard } from '@/components/scheme-card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { type MinisterProfile, PM_PROFILE, CABINET_PROFILES } from '@/data/ministers';

// ─── Types (minister data now lives in src/data/ministers.ts) ─────────────────

/** @deprecated Use MinisterProfile from data/ministers.ts */
type CabinetMember = MinisterProfile;

interface NationalStat {
  label: string;
  value: string;
  note?: string;
  source: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface ChartPoint { year: number; [key: string]: number; }
interface ChartRemark { years: string; note: string; noteHi?: string; }
interface ChartSeries { key: string; label: string; color: string; }

interface ChartConfig {
  invertAxis?: boolean;
  yDomain?: [number, number];  // explicit [min, max] override — use to control how large differences appear
  data: ChartPoint[];
  series?: ChartSeries[];   // if provided → grouped bars; absent → single 'value' key
  label: string;
  unit: string;
  source: string;
  remarks?: ChartRemark[];
  yearLabel?: string;       // prefix for tooltip year (default "FY"; pass "" for calendar years)
}

interface NationalIndicator {
  key: string;
  label: string;
  score: number;
  icon: React.ElementType;
  summary: string;
  stats: NationalStat[];
  charts?: ChartConfig[];
}

interface LiveCagAudit {
  id: number;
  schemeName: string;
  schemeSlug: string;
  ministry: string;
  reportYear: number;
  reportNumber: string | null;
  finding: string;
  severity: 'critical' | 'major' | 'minor';
  parameter: string | null;
  claimed: string | null;
  actual: string | null;
  sourceUrl: string | null;
}

interface AccountabilityRating {
  key: string;
  label: string;
  score: number;
  icon: React.ElementType;
  methodology: string;
}

// ─── Accountability ───────────────────────────────────────────────────────────

const ACCOUNTABILITY: AccountabilityRating[] = [
  {
    key: 'transparency',
    label: 'Transparency',
    score: TRANSPARENCY_SCORE,
    icon: Eye,
    methodology:
      `Formula-derived score (see src/lib/scoring.ts). Weighted composite: RSF Press Freedom Index 2024 (31.28/100, rank 159/180 — Reporters Without Borders) × 40% + RTI/CIC effectiveness proxy (30/100) × 35% + Freedom House Internet Freedom 2024 (50/100, "Not Free") × 25%. RTI proxy basis: CIC vacancy 55% (6 of 11 posts unfilled, PIB Nov 2023); 3.2+ lakh pending RTI appeals across 27 commissions (SNS Report Card 2023-24); PMO rejects >90% of RTI requests without citing a valid exemption clause (The Hindu, Feb 2024; CIC annual report analysis). Computed: 31.28×0.40 + 30×0.35 + 50×0.25 = 35.5 → ${TRANSPARENCY_SCORE}.`,
  },
  {
    key: 'officialsIntegrity',
    label: "Officials' Legal Integrity",
    score: CABINET_INTEGRITY_SCORE,
    icon: ShieldCheck,
    methodology:
      `Formula-derived score (see src/lib/scoring.ts). Source: ADR/National Election Watch — Analysis of 71 Union Ministers, 11 Jun 2024. Inputs: 19/71 (27%) declared serious criminal cases (IPC ≥5 yrs); 28/71 (39%) declared any criminal cases. Formula: 100 − (serious% × 1.5) − ((criminal% − serious%) × 0.7). Rationale: serious charges penalise at 2× the rate of minor ones. Computed: 100 − 27×1.5 − 12×0.7 = 51.1 → ${CABINET_INTEGRITY_SCORE}. Source: ADR/myneta.info affidavit database.`,
  },
  {
    key: 'governance',
    label: 'Governance',
    score: GOVERNANCE_SCORE,
    icon: Scale,
    methodology:
      `Formula-derived score (see src/lib/scoring.ts). Weighted composite of four external governance indices: Transparency International CPI 2024 (39/100, rank 93/180) × 30% + WJP Rule of Law Index 2024 (rank 79/142 → percentile 44.4) × 25% + V-Dem Liberal Democracy Index 2024 (0.299 → 29.9/100) × 25% + World Bank Government Effectiveness 2022 (57th percentile) × 20%. Computed: 11.7 + 11.1 + 7.5 + 11.4 = 41.7 → ${GOVERNANCE_SCORE}.`,
  },
];

// ─── PM / Cabinet — imported from src/data/ministers.ts ──────────────────────

const PM    = PM_PROFILE;
const CABINET: CabinetMember[] = CABINET_PROFILES;

// keep legacy CABINET array shape so the filter/group logic below stays intact

const CABINET_SUMMARY = {
  total: 71, withCriminalCases: 28, withSeriousCases: 19,
  percentCriminal: 39, percentSerious: 27,
  source: 'ADR / National Election Watch — Analysis of 71 of 72 Union Council of Ministers, 11 June 2024',
};

// ─── National Indicators ──────────────────────────────────────────────────────

const NATIONAL_INDICATORS: NationalIndicator[] = [
  {
    key: 'economy', label: 'Economy', score: ECONOMY_SCORE, icon: TrendingUp,
    summary: 'India is the world\'s 5th largest economy, growing at 6.5–7.4% — among the fastest of any major economy. But headline GDP masks structural strains: the rupee has depreciated 50%+ since 2000, net FDI crashed to a record low of $353mn in FY2024-25 (RBI BOP) despite gross inflows hitting $81bn, a decade of 8–12% inflation eroded real incomes, and the HDI still ranks India 134th globally. Fiscal consolidation is on track — FY26 deficit at 4.4% of GDP met its target — but the FRBM goal of 3% remains distant.',
    charts: [
      {
        label: 'GDP Growth (% real, YoY)', unit: '%', source: 'World Bank / NSO-MOSPI',
        data: [
          { year: 2000, value: 3.8 }, { year: 2001, value: 4.9 }, { year: 2002, value: 3.9 },
          { year: 2003, value: 7.9 }, { year: 2004, value: 7.8 }, { year: 2005, value: 9.3 },
          { year: 2006, value: 9.3 }, { year: 2007, value: 9.8 }, { year: 2008, value: 3.9 },
          { year: 2009, value: 8.4 }, { year: 2010, value: 10.3 }, { year: 2011, value: 6.6 },
          { year: 2012, value: 5.5 }, { year: 2013, value: 6.4 }, { year: 2014, value: 7.4 },
          { year: 2015, value: 8.0 }, { year: 2016, value: 8.3 }, { year: 2017, value: 6.8 },
          { year: 2018, value: 6.5 }, { year: 2019, value: 3.7 }, { year: 2020, value: -6.6 },
          { year: 2021, value: 9.1 }, { year: 2022, value: 7.2 }, { year: 2023, value: 8.2 },
          { year: 2024, value: 6.5 }, { year: 2025, value: 7.4 }, { year: 2026, value: 6.5 },
        ],
        remarks: [
          { years: '2003–07', note: 'India\'s high-growth phase — avg. 9% GDP growth, driven by IT services, FDI, and domestic consumption. "India Shining" era.', noteHi: 'भारत का उच्च-विकास चरण — औसत 9% GDP वृद्धि, IT सेवाओं, FDI, और घरेलू खपत द्वारा संचालित। "India Shining" युग।' },
          { years: '2008', note: 'Global financial crisis spills over — growth drops to 3.9%. RBI cuts rates; fiscal stimulus cushions the fall.', noteHi: 'वैश्विक वित्तीय संकट का प्रभाव — वृद्धि घटकर 3.9% हो जाती है। RBI ने दरें कम कीं; वित्तीय प्रोत्साहन गिरावट को कम करता है।' },
          { years: '2009–10', note: 'Strong V-shaped recovery. Stimulus spending + rural demand (MGNREGS) drives rebound to 10.3% in 2010.', noteHi: 'मजबूत V-आकार की रिकवरी। प्रोत्साहन खर्च + ग्रामीण मांग (MGNREGS) ने 2010 में 10.3% की वृद्धि को बढ़ावा दिया।' },
          { years: '2011–13', note: 'Slowdown to ~5.5%. High inflation, CAD widening, rupee depreciation, and UPA-II "policy paralysis" cited as causes.', noteHi: 'मंदी लगभग 5.5% तक। उच्च मुद्रास्फीति, CAD का विस्तार, रुपये का अवमूल्यन, और UPA-II की "नीति पक्षाघात" कारण बताए गए।' },
          { years: '2016–17', note: 'Demonetisation (Nov 2016) — ₹500/₹1,000 notes withdrawn. Growth softens to 8.3% → 6.8% as informal economy contracts.', noteHi: 'नोटबंदी (नवंबर 2016) — ₹500/₹1,000 के नोट वापस लिए गए। अनौपचारिक अर्थव्यवस्था सिकुड़ने से वृद्धि 8.3% से घटकर 6.8% हो गई।' },
          { years: '2019', note: 'Pre-COVID slowdown to 3.7% — worst in a decade. NBFC crisis, weak consumption, and global trade slowdown.', noteHi: 'COVID से पहले मंदी 3.7% — एक दशक में सबसे खराब। NBFC संकट, कमजोर खपत, और वैश्विक व्यापार मंदी।' },
          { years: '2020', note: 'COVID-19 pandemic: −6.6% (NSO revised), India\'s sharpest contraction since Independence. Strict national lockdown (March–May 2020) shuttered the informal economy.', noteHi: 'COVID-19 महामारी: −6.6% (NSO संशोधित), स्वतंत्रता के बाद भारत का सबसे तेज संकुचन। सख्त राष्ट्रीय लॉकडाउन (मार्च–मई 2020) ने अनौपचारिक अर्थव्यवस्था को बंद कर दिया।' },
          { years: '2021', note: 'Post-COVID rebound: +9.1% on low base effect. Vaccination rollout, pent-up demand, and export surge.', noteHi: 'COVID के बाद पुनरुद्धार: +9.1% कम आधार प्रभाव पर। टीकाकरण अभियान, दबा हुआ मांग, और निर्यात में वृद्धि।' },
          { years: '2023–24', note: 'Growth moderates from 8.2% (FY2023-24) to 6.5% (FY2024-25, NSO Provisional Estimate May 2025). Capex-led, private consumption softer. Still among the fastest major economies.', noteHi: 'वृद्धि 8.2% (FY2023-24) से घटकर 6.5% (FY2024-25, NSO अस्थायी अनुमान मई 2025)। पूंजीगत व्यय प्रमुख, निजी खपत कमजोर। फिर भी प्रमुख अर्थव्यवस्थाओं में सबसे तेज़।' },
          { years: '★ 2025', note: 'FY2025-26 First Advance Estimate (NSO, Jan 2026): 7.4% — driven by buoyant services sector recovery and strong capital expenditure. Above 6.5% prior year.', noteHi: 'FY2025-26 प्रथम अग्रिम अनुमान (NSO, जनवरी 2026): 7.4% — सेवाओं के क्षेत्र की मजबूत रिकवरी और उच्च पूंजीगत व्यय द्वारा संचालित। पिछले वर्ष के 6.5% से ऊपर।' },
          { years: '2026', note: 'FY2026-27 projection (~6.5%). IMF/World Bank consensus. Trade uncertainty from US tariffs and dollar strength are the main downside risks.', noteHi: 'FY2026-27 प्रक्षेपण (~6.5%)। IMF/World Bank सहमति। अमेरिकी टैरिफ और डॉलर की मजबूती से व्यापार अनिश्चितता मुख्य नकारात्मक जोखिम।' },
        ],
      },

      {
        label: 'Fiscal Deficit (% of GDP)', unit: '%', source: 'Union Budget documents · Controller General of Accounts · RBI State Finances Report',
        data: [
          { year: 2000, value: 5.7 }, { year: 2001, value: 6.2 }, { year: 2002, value: 5.9 },
          { year: 2003, value: 4.5 }, { year: 2004, value: 3.9 }, { year: 2005, value: 4.0 },
          { year: 2006, value: 3.3 }, { year: 2007, value: 2.5 }, { year: 2008, value: 6.0 },
          { year: 2009, value: 6.5 }, { year: 2010, value: 4.8 }, { year: 2011, value: 5.7 },
          { year: 2012, value: 4.9 }, { year: 2013, value: 4.6 }, { year: 2014, value: 4.0 },
          { year: 2015, value: 3.5 }, { year: 2016, value: 3.5 }, { year: 2017, value: 3.5 },
          { year: 2018, value: 3.4 }, { year: 2019, value: 3.8 }, { year: 2020, value: 9.2 },
          { year: 2021, value: 6.7 }, { year: 2022, value: 6.4 }, { year: 2023, value: 5.9 },
          { year: 2024, value: 4.8 }, { year: 2025, value: 4.4 }, { year: 2026, value: 4.1 },
        ],
        remarks: [
          { years: '2000–02', note: 'High deficit (~6% of GDP) driven by 5th Pay Commission arrears, states\' off-budget borrowings, and weak revenue. FRBM Act passed in 2003 to enforce discipline.', noteHi: 'उच्च घाटा (~GDP का 6%) 5वीं वेतन आयोग बकाया, राज्यों के ऑफ-बजट उधार, और कमजोर राजस्व से प्रेरित। अनुशासन लागू करने के लिए 2003 में FRBM अधिनियम पारित।' },
          { years: '2003–07', note: 'Consolidation phase — FRBM targets met, deficit halved to 2.5%. Strong tax buoyancy and growth dividend reduce borrowing need.', noteHi: 'समेकन चरण — FRBM लक्ष्यों को पूरा किया गया, घाटा आधा होकर 2.5% हुआ। मजबूत कर लचीलापन और विकास लाभ से उधार की आवश्यकता कम हुई।' },
          { years: '2008–09', note: 'Global financial crisis response: fiscal stimulus packages push deficit to 6.5%. NREGA spending and revenue shortfall add to pressure.', noteHi: 'वैश्विक वित्तीय संकट प्रतिक्रिया: वित्तीय प्रोत्साहन पैकेजों ने घाटा 6.5% तक बढ़ाया। NREGA खर्च और राजस्व की कमी दबाव बढ़ाते हैं।' },
          { years: '2010–18', note: 'Gradual consolidation under UPA-II and NDA-I. Deficit narrows from 6.5% → 3.4%, aided by subsidy rationalisation and GST transition.', noteHi: 'UPA-II और NDA-I के तहत धीरे-धीरे समेकन। सब्सिडी में सुधार और GST संक्रमण से घाटा 6.5% से घटकर 3.4% हुआ।' },
          { years: '2020', note: 'COVID-19 emergency: deficit surges to 9.2% of GDP — highest since Independence. Revenue collapses; healthcare and welfare spending spike.', noteHi: 'COVID-19 आपातकाल: GDP का घाटा 9.2% तक बढ़ा — स्वतंत्रता के बाद सबसे अधिक। राजस्व गिरा; स्वास्थ्य और कल्याण खर्च बढ़ा।' },
          { years: '2021–24', note: 'Consolidation resumes. FY25 actual at 4.8% of GDP (CGA provisional accounts; vs. revised Budget target 4.8%). FY26 target set at 4.4%. Capex-heavy strategy means deficit unlikely to fall below 4% near-term.', noteHi: 'समेकन फिर से शुरू। FY25 वास्तविक 4.8% GDP (CGA अस्थायी खाते; संशोधित बजट लक्ष्य 4.8%)। FY26 लक्ष्य 4.4% निर्धारित। पूंजीगत व्यय भारी रणनीति के कारण निकट अवधि में घाटा 4% से नीचे गिरना मुश्किल।' },
          { years: '2025–26', note: 'FY26 target 4.4% met; FY27 projected 4.1%. Sustained capex at ₹11.1 lakh crore limits pace of consolidation. FRBM medium-term goal of 3% remains distant.', noteHi: 'FY26 लक्ष्य 4.4% पूरा; FY27 अनुमानित 4.1%। ₹11.1 लाख करोड़ के निरंतर पूंजीगत व्यय से समेकन की गति सीमित। FRBM का मध्यम अवधि लक्ष्य 3% अभी दूर।' },
        ],
      },
      {
        label: 'USD / INR Exchange Rate (annual avg)', unit: ' ₹', source: 'RBI Reference Rate / World Bank',
        data: [
          { year: 2000, value: 44.9 }, { year: 2001, value: 47.2 }, { year: 2002, value: 48.6 },
          { year: 2003, value: 46.6 }, { year: 2004, value: 45.3 }, { year: 2005, value: 44.1 },
          { year: 2006, value: 45.3 }, { year: 2007, value: 41.3 }, { year: 2008, value: 43.5 },
          { year: 2009, value: 48.4 }, { year: 2010, value: 45.7 }, { year: 2011, value: 46.7 },
          { year: 2012, value: 53.4 }, { year: 2013, value: 58.6 }, { year: 2014, value: 61.0 },
          { year: 2015, value: 64.2 }, { year: 2016, value: 67.2 }, { year: 2017, value: 65.1 },
          { year: 2018, value: 68.4 }, { year: 2019, value: 70.4 }, { year: 2020, value: 74.1 },
          { year: 2021, value: 73.9 }, { year: 2022, value: 78.6 }, { year: 2023, value: 82.6 },
          { year: 2024, value: 83.7 }, { year: 2025, value: 87.1 }, { year: 2026, value: 95.5 },
        ],
        remarks: [
          { years: '2007', note: 'Rupee strengthens to ₹41.3 — its best level of the decade. Capital inflows surge on India\'s high-growth story; RBI intervenes to limit appreciation.', noteHi: 'रुपया मजबूत होकर ₹41.3 पर पहुंचा — दशक का सर्वश्रेष्ठ स्तर। भारत की उच्च-विकास कहानी पर पूंजी प्रवाह बढ़ा; RBI ने प्रशंसा को सीमित करने के लिए हस्तक्षेप किया।' },
          { years: '2011–13', note: 'Sharp depreciation to ₹58.6. CAD widens to 4.8% of GDP; "taper tantrum" (May 2013) triggers EM capital flight. RBI emergency measures stabilise.', noteHi: 'तेज अवमूल्यन ₹58.6 तक। CAD बढ़कर GDP का 4.8% हुआ; "taper tantrum" (मई 2013) ने EM पूंजी पलायन को ट्रिगर किया। RBI की आपातकालीन उपायों ने स्थिरता लाई।' },
          { years: '2016', note: 'Post-demonetisation uncertainty and US Fed rate hikes push rupee past ₹67. Dollar strengthens globally.', noteHi: 'नोटबंदी के बाद अनिश्चितता और अमेरिकी Fed की दर वृद्धि से रुपया ₹67 से ऊपर चला गया। डॉलर वैश्विक स्तर पर मजबूत हुआ।' },
          { years: '2020', note: 'COVID capital outflows weaken rupee to ₹74. RBI uses forex reserves ($487bn) to defend, avoids a crisis.', noteHi: 'COVID के दौरान पूंजी निकासी से रुपया ₹74 तक कमजोर हुआ। RBI ने विदेशी मुद्रा भंडार ($487bn) का उपयोग कर रक्षा की, संकट टाला।' },
          { years: '2022–24', note: 'Gradual slide to ₹83–84 despite record forex reserves (~$650bn). Structural import bill (oil, gold, electronics) and FPI outflows drive long-run depreciation.', noteHi: 'रिकॉर्ड विदेशी मुद्रा भंडार (~$650bn) के बावजूद ₹83–84 तक धीरे-धीरे गिरावट। संरचनात्मक आयात बिल (तेल, सोना, इलेक्ट्रॉनिक्स) और FPI निकासी से दीर्घकालिक अवमूल्यन।' },
          { years: '2025–26', note: 'Accelerated depreciation — rupee crosses ₹95. Driven by dollar strength, sustained trade deficit, and reduced RBI intervention. Marks the steepest 2-year fall since 2011–13.', noteHi: 'तेज अवमूल्यन — रुपया ₹95 पार कर गया। डॉलर की मजबूती, निरंतर व्यापार घाटा, और RBI के कम हस्तक्षेप से प्रेरित। 2011–13 के बाद सबसे तेज 2-वर्षीय गिरावट।' },
        ],
      },
      {
        label: 'CPI Inflation (% annual)', unit: '%', source: 'RBI / MOSPI — CPI-IW pre-2012, CPI Combined from 2012',
        data: [
          { year: 2000, value: 4.0 }, { year: 2001, value: 3.8 }, { year: 2002, value: 4.4 },
          { year: 2003, value: 3.8 }, { year: 2004, value: 3.8 }, { year: 2005, value: 4.2 },
          { year: 2006, value: 5.8 }, { year: 2007, value: 6.4 }, { year: 2008, value: 8.3 },
          { year: 2009, value: 10.9 }, { year: 2010, value: 12.0 }, { year: 2011, value: 8.9 },
          { year: 2012, value: 9.3 }, { year: 2013, value: 10.9 }, { year: 2014, value: 6.6 },
          { year: 2015, value: 4.9 }, { year: 2016, value: 4.5 }, { year: 2017, value: 3.6 },
          { year: 2018, value: 3.4 }, { year: 2019, value: 4.8 }, { year: 2020, value: 6.2 },
          { year: 2021, value: 5.5 }, { year: 2022, value: 6.7 }, { year: 2023, value: 5.4 },
          { year: 2024, value: 4.6 }, { year: 2025, value: 4.2 }, { year: 2026, value: 4.0 },
        ],
        remarks: [
          { years: '2000–07', note: 'Relatively contained inflation (4–6%). High growth with moderate price pressure — the "Goldilocks" era of the early liberalisation period.', noteHi: 'अपेक्षाकृत नियंत्रित मुद्रास्फीति (4–6%)। उच्च विकास के साथ मध्यम मूल्य दबाव — प्रारंभिक उदारीकरण काल का "Goldilocks" युग।' },
          { years: '2009–10', note: 'Inflation hits 10.9–12.0% — driven by food prices (drought 2009), fuel subsidy spillovers, and loose post-GFC fiscal policy.', noteHi: 'मुद्रास्फीति 10.9–12.0% तक पहुंची — खाद्य कीमतों (2009 की सूखा), ईंधन सब्सिडी के प्रभाव, और GFC के बाद की ढीली वित्तीय नीति से प्रेरित।' },
          { years: '2011–13', note: 'Persistent double-digit food and fuel inflation. UPA-II accused of mismanaging supply-side; RBI holds rates high, choking growth.', noteHi: 'लगातार दोहरे अंक की खाद्य और ईंधन मुद्रास्फीति। UPA-II पर आपूर्ति पक्ष प्रबंधन में विफलता का आरोप; RBI ने दरें उच्च रखीं, जिससे विकास बाधित हुआ।' },
          { years: '2014–18', note: 'Inflation falls sharply. RBI adopts formal inflation targeting (4% ± 2%) in 2016. Demonetisation briefly compresses demand and prices.', noteHi: 'मुद्रास्फीति में तेज गिरावट। RBI ने 2016 में औपचारिक मुद्रास्फीति लक्ष्य (4% ± 2%) अपनाया। नोटबंदी ने अस्थायी रूप से मांग और कीमतों को दबाया।' },
          { years: '2022', note: 'Spikes to 6.7% — breaches RBI\'s upper tolerance band (6%) for three consecutive quarters. Global commodity shock post-Ukraine war; RBI hikes repo rate 250bps.', noteHi: '6.7% तक बढ़ी — RBI की ऊपरी सहिष्णुता सीमा (6%) को तीन लगातार तिमाहियों के लिए पार किया। यूक्रेन युद्ध के बाद वैश्विक वस्तु संकट; RBI ने रेपो दर 250bps बढ़ाई।' },
          { years: '2023–24', note: 'Moderates to 5.4% → 4.6% (FY2024-25 annual average, MOSPI). Food inflation sticky through mid-year but eases in H2 on good kharif harvest. Core inflation softens; RBI pivots to rate cuts.', noteHi: 'घटकर 5.4% → 4.6% (FY2024-25 वार्षिक औसत, MOSPI)। खाद्य मुद्रास्फीति मध्य वर्ष तक स्थिर रही लेकिन अच्छी खरीफ फसल के कारण H2 में कम हुई। कोर मुद्रास्फीति नरम हुई; RBI ने दर कटौती की ओर रुख किया।' },
          { years: '2025–26', note: 'Eases toward RBI\'s 4% target. Lower global commodity prices and a good kharif season compress food inflation. RBI begins rate-cut cycle mid-2025.', noteHi: 'RBI के 4% लक्ष्य की ओर आसान। वैश्विक वस्तु कीमतों में कमी और अच्छी खरीफ फसल से खाद्य मुद्रास्फीति दबाव। RBI ने 2025 के मध्य में दर कटौती चक्र शुरू किया।' },
        ],
      },
      {
        label: 'Human Development Index (HDI)', unit: '', source: 'UNDP Human Development Reports (annual)',
        data: [
          { year: 2000, value: 0.493 }, { year: 2001, value: 0.497 }, { year: 2002, value: 0.502 },
          { year: 2003, value: 0.508 }, { year: 2004, value: 0.514 }, { year: 2005, value: 0.520 },
          { year: 2006, value: 0.527 }, { year: 2007, value: 0.534 }, { year: 2008, value: 0.541 },
          { year: 2009, value: 0.549 }, { year: 2010, value: 0.557 }, { year: 2011, value: 0.565 },
          { year: 2012, value: 0.572 }, { year: 2013, value: 0.578 }, { year: 2014, value: 0.586 },
          { year: 2015, value: 0.609 }, { year: 2016, value: 0.624 }, { year: 2017, value: 0.630 },
          { year: 2018, value: 0.636 }, { year: 2019, value: 0.645 }, { year: 2020, value: 0.633 },
          { year: 2021, value: 0.633 }, { year: 2022, value: 0.644 }, { year: 2023, value: 0.650 },
          { year: 2024, value: 0.656 }, { year: 2025, value: 0.661 },
        ],
        remarks: [
          { years: '2000', note: 'HDI at 0.493 — just below the "medium human development" threshold (0.5). Life expectancy 63 yrs, literacy ~61%, per capita income low.', noteHi: 'HDI 0.493 — "मध्यम मानव विकास" सीमा (0.5) के ठीक नीचे। जीवन प्रत्याशा 63 वर्ष, साक्षरता ~61%, प्रति व्यक्ति आय कम।' },
          { years: '2005–14', note: 'Steady annual gains of ~0.006–0.008. Income component rises fastest; health and education lag. India moves from Low to Medium HDI band.', noteHi: 'स्थिर वार्षिक वृद्धि ~0.006–0.008। आय घटक सबसे तेज बढ़ा; स्वास्थ्य और शिक्षा पिछड़े। भारत ने Low से Medium HDI बैंड में प्रवेश किया।' },
          { years: '2015', note: 'Jump to 0.609 reflects revised UNDP methodology (new PPP 2011 base), not a single-year improvement. India crosses 0.6 for the first time.', noteHi: '0.609 तक उछाल UNDP की संशोधित पद्धति (नई PPP 2011 आधार) का परिणाम, एक वर्ष की सुधार नहीं। भारत पहली बार 0.6 पार किया।' },
          { years: '2019', note: 'Peaks at 0.645 — India ranked 131/189 countries. Still below neighbours Sri Lanka (0.782) and China (0.761).', noteHi: '0.645 पर चरम — भारत 131/189 देशों में रैंक। फिर भी पड़ोसी श्रीलंका (0.782) और चीन (0.761) से नीचे।' },
          { years: '2020–21', note: 'First back-to-back decline since HDI was tracked. COVID-19 cuts life expectancy and real GNI per capita. Rank falls to 132/191.', noteHi: 'HDI ट्रैकिंग के बाद पहली बार लगातार गिरावट। COVID-19 ने जीवन प्रत्याशा और वास्तविक GNI प्रति व्यक्ति को कम किया। रैंक 132/191 पर गिरा।' },
          { years: '2022–25', note: 'Steady recovery to ~0.661 (est.). Income component improves fastest; education and health gains slower. Gender HDI gap persists.', noteHi: 'स्थिर सुधार ~0.661 (अनुमानित)। आय घटक सबसे तेज सुधार; शिक्षा और स्वास्थ्य में धीमी प्रगति। लिंग HDI अंतर बना हुआ।' },
        ],
      },
      {
        label: 'FDI Inflows — Gross vs Net (USD billion)', unit: ' bn', source: 'DPIIT / RBI Balance of Payments',
        series: [
          { key: 'gross', label: 'Gross FDI', color: '#f59e0b' },
          { key: 'net',   label: 'Net FDI',   color: '#6366f1' },
        ],
        data: [
          { year: 2000, gross: 2.2,  net: 1.5  }, { year: 2001, gross: 6.1,  net: 4.0  },
          { year: 2002, gross: 6.1,  net: 4.0  }, { year: 2003, gross: 5.1,  net: 3.2  },
          { year: 2004, gross: 4.3,  net: 2.8  }, { year: 2005, gross: 6.1,  net: 3.7  },
          { year: 2006, gross: 9.0,  net: 5.5  }, { year: 2007, gross: 22.8, net: 20.0 },
          { year: 2008, gross: 37.8, net: 26.0 }, { year: 2009, gross: 35.6, net: 25.0 },
          { year: 2010, gross: 37.7, net: 22.0 }, { year: 2011, gross: 36.5, net: 22.0 },
          { year: 2012, gross: 46.8, net: 22.1 }, { year: 2013, gross: 36.9, net: 20.0 },
          { year: 2014, gross: 44.3, net: 22.0 }, { year: 2015, gross: 55.5, net: 36.0 },
          { year: 2016, gross: 60.2, net: 43.5 }, { year: 2017, gross: 61.0, net: 39.9 },
          { year: 2018, gross: 61.0, net: 30.3 }, { year: 2019, gross: 73.5, net: 43.0 },
          { year: 2020, gross: 74.4, net: 43.0 }, { year: 2021, gross: 81.7, net: 44.0 },
          { year: 2022, gross: 83.6, net: 38.6 }, { year: 2023, gross: 71.4, net: 28.0 },
          { year: 2024, gross: 70.9, net: 10.1 }, { year: 2025, gross: 81.0, net: 0.4 },
          { year: 2026, gross: 94.8, net: 7.6 },
        ],
        remarks: [
          { years: '2000–06', note: 'FDI modest at under $10bn gross. India not yet on global investors\' radar; infrastructure and regulatory bottlenecks limit inflows.', noteHi: 'FDI मामूली, $10bn से कम सकल। भारत अभी वैश्विक निवेशकों की नजर में नहीं; अवसंरचना और नियामक बाधाएं प्रवाह सीमित करती हैं।' },
          { years: '2007–09', note: 'FDI surges to $38bn (FY08) on telecom/retail liberalisation. GFC causes modest dip to $35.6bn in FY09 — India weathers it better than peers.', noteHi: 'FDI $38bn (FY08) तक बढ़ा टेलीकॉम/रिटेल उदारीकरण से। GFC के कारण FY09 में मामूली गिरावट $35.6bn; भारत ने अपने साथियों की तुलना में बेहतर सामना किया।' },
          { years: '2010–14', note: 'Volatile period. Retrospective tax (2012), UPA-II policy paralysis, and CAD fears dent confidence. Net FDI drifts at $20–22bn.', noteHi: 'अस्थिर अवधि। प्रत्यावर्ती कर (2012), UPA-II की नीति पक्षाघात, और CAD चिंताएं विश्वास को चोट पहुंचाती हैं। शुद्ध FDI $20–22bn के बीच स्थिर।' },
          { years: '2015–19', note: 'Make in India era — 100% FDI opened in defence, railways, insurance. Gross nearly doubles to $73.5bn. Net FDI peaks at $43bn (FY19).', noteHi: 'Make in India युग — रक्षा, रेलवे, बीमा में 100% FDI खोला गया। सकल लगभग दोगुना होकर $73.5bn हुआ। शुद्ध FDI FY19 में $43bn पर चरम।' },
          { years: '2020–21', note: 'Record gross FDI ($81.7bn) driven by Reliance-Jio deal (~$15bn) and China+1 manufacturing shift. Net holds at $44bn.', noteHi: 'रिकॉर्ड सकल FDI ($81.7bn) रिलायंस-जियो सौदे (~$15bn) और चीन+1 विनिर्माण बदलाव से प्रेरित। शुद्ध $44bn पर स्थिर।' },
          { years: '2022–24', note: 'Gross FDI falls from $83.6bn → $70.9bn (FY2023-24). Net FDI drops to $10.1bn (RBI BOP, FY2023-24) — outbound investment by Indian firms widens gross-to-net gap.', noteHi: 'सकल FDI $83.6bn से घटकर $70.9bn (FY2023-24)। शुद्ध FDI RBI BOP के अनुसार $10.1bn तक गिरा — भारतीय कंपनियों की आउटबाउंड निवेश से सकल-शुद्ध अंतर बढ़ा।' },
          { years: '★ 2025', note: 'FY2024-25: Gross FDI rebounds to $81.0bn (+14%, DPIIT PIB). But net FDI crashes 96.5% to just $353mn (RBI BOP) — the lowest on record — as Indian companies massively scale outward FDI. Record gross, near-zero net: a structural story, not a crisis.', noteHi: 'FY2024-25: सकल FDI $81.0bn (+14%, DPIIT PIB) तक पुनरुद्धार। लेकिन शुद्ध FDI RBI BOP के अनुसार 96.5% गिरकर केवल $353mn — रिकॉर्ड निचला — क्योंकि भारतीय कंपनियां भारी मात्रा में आउटवर्ड FDI कर रही हैं। रिकॉर्ड सकल, लगभग शून्य शुद्ध: संरचनात्मक कहानी, संकट नहीं।' },
          { years: '★ 2026', note: 'FY2025-26: Gross FDI hits record $94.8bn (DPIIT, June 2026). Net recovers to $7.6bn (RBI/CNBC TV18) as outward FDI stabilises. PLI schemes driving electronics, semiconductors, and pharma inflows.', noteHi: 'FY2025-26: सकल FDI रिकॉर्ड $94.8bn (DPIIT, जून 2026)। शुद्ध $7.6bn (RBI/CNBC TV18) तक सुधरा क्योंकि आउटवर्ड FDI स्थिर हुआ। PLI योजनाएं इलेक्ट्रॉनिक्स, सेमीकंडक्टर, और फार्मा में निवेश बढ़ा रही हैं।' },
        ],
      },
    ],
    stats: [
      {
        label: 'India nominal GDP (FY2024-25)',
        value: '~$3.9 trillion',
        note: '5th largest economy globally. NSO Provisional: ₹331.8 lakh crore at current prices (~$3.9T at ₹84.5/USD avg). Real GDP ₹184.9 lakh crore at 2011-12 prices, growing 6.5%.',
        trend: 'up',
        source: 'NSO Press Note on Provisional GDP Estimates, 30 May 2025',
      },
      {
        label: 'Combined tax-to-GDP ratio (FY2024-25)',
        value: '~19.6%',
        note: 'Central direct + indirect taxes ~11.7% + state taxes ~8%. On par with several major emerging economies but below the OECD average (~34%). Revenue buoyancy has improved post-GST.',
        trend: 'up',
        source: 'CGA FY25 provisional accounts; Union Budget FY2025-26; GoI data per IBTimes India',
      },
      {
        label: 'Human Development Index rank (HDR 2023-24)',
        value: '134th / 193 countries',
        note: 'HDI score 0.644 — "medium human development". Ranks below all BRICS peers (China 75th, Brazil 87th) and neighbours Sri Lanka (78th). GNI per capita only $9,047 PPP vs India\'s structural potential.',
        trend: 'up',
        source: 'UNDP Human Development Report 2023-24',
      },
    ],
  },
  {
    key: 'education', label: 'Education', score: EDUCATION_SCORE, icon: GraduationCap,
    summary: 'India has achieved near-universal primary enrolment (25+ crore students) and near-eliminated primary dropout — but access without learning is the defining failure. ASER 2023 shows only 43.3% of rural Std V children can read a Std II text, down from 56% in 2007. COVID school closures (18+ months) deepened the crisis. Literacy stalled at 74% since the 2011 Census with no new count in sight.',
    charts: [
      {
        label: 'Literacy Rate — Census years only (%)', unit: '%', source: 'Census of India (RGI) · Census 2021 not yet conducted',
        data: [
          { year: 1951, value: 18.3 }, { year: 1961, value: 28.3 }, { year: 1971, value: 34.5 },
          { year: 1981, value: 43.6 }, { year: 1991, value: 52.2 }, { year: 2001, value: 64.8 },
          { year: 2011, value: 74.0 },
        ],
        remarks: [
          { years: '1951', note: 'At Independence, only 18.3% literate — colonial neglect of mass education left a vast gap. Female literacy was just 8.9%.', noteHi: 'स्वतंत्रता के समय केवल 18.3% साक्षर — औपनिवेशिक उपेक्षा ने व्यापक अंतर छोड़ा। महिला साक्षरता केवल 8.9% थी।' },
          { years: '1961–71', note: 'Slow progress despite expansion of primary schools. Rural access and social barriers — especially for girls and Dalits — limit gains.', noteHi: 'प्राथमिक विद्यालयों के विस्तार के बावजूद धीमी प्रगति। ग्रामीण पहुंच और सामाजिक बाधाएं — विशेषकर लड़कियों और दलितों के लिए — प्रगति सीमित करती हैं।' },
          { years: '1981–91', note: 'National Literacy Mission (1988) launched. Rate crosses 50% for the first time in 1991. Still 48% illiterate — ~400 million people.', noteHi: 'राष्ट्रीय साक्षरता मिशन (1988) शुरू। 1991 में पहली बार 50% पार। फिर भी 48% निरक्षर — लगभग 400 मिलियन लोग।' },
          { years: '2001', note: 'Sarva Shiksha Abhiyan (SSA) launched. Rate jumps to 64.8% — largest single-decade absolute gain (+12.6pp). Male 75.3%, Female 53.7%.', noteHi: 'सर्व शिक्षा अभियान (SSA) शुरू। दर 64.8% तक बढ़ी — सबसे बड़ी एक दशक की कुल वृद्धि (+12.6pp)। पुरुष 75.3%, महिला 53.7%।' },
          { years: '2011', note: 'Reaches 74.0%. Male 82.1%, Female 65.5% — gender gap narrows to 16.6pp from 21.6pp in 2001. Right to Education Act (2009) comes into effect.', noteHi: '74.0% तक पहुंची। पुरुष 82.1%, महिला 65.5% — लिंग अंतर 2001 के 21.6pp से घटकर 16.6pp। शिक्षा का अधिकार अधिनियम (2009) लागू।' },
          { years: 'Post-2011', note: 'Census 2021 delayed indefinitely (COVID + political reasons). NSO surveys estimate literacy at ~77–78% by 2025 but no official Census count exists.', noteHi: 'जनगणना 2021 अनिश्चितकाल के लिए स्थगित (COVID + राजनीतिक कारणों से)। NSO सर्वेक्षण 2025 तक साक्षरता को लगभग 77–78% अनुमानित करते हैं लेकिन कोई आधिकारिक जनगणना गणना उपलब्ध नहीं है।  ' },
        ],
      },
      {
        label: 'Schools Opened vs Closed / Merged (000s per year)', unit: 'k', source: 'DISE / UDISE+ annual reports · State rationalisation orders · Samagra Shiksha AWPs · Derived from total count changes',
        series: [
          { key: 'opened', label: 'New schools opened', color: '#22c55e' },
          { key: 'closed', label: 'Closed / merged',    color: '#ef4444' },
        ],
        data: [
          { year: 2006, opened: 35, closed: 5  }, { year: 2007, opened: 45, closed: 8  },
          { year: 2008, opened: 50, closed: 10 }, { year: 2009, opened: 55, closed: 12 },
          { year: 2010, opened: 80, closed: 15 }, { year: 2011, opened: 95, closed: 12 },
          { year: 2012, opened: 85, closed: 18 }, { year: 2013, opened: 70, closed: 20 },
          { year: 2014, opened: 45, closed: 50 }, { year: 2015, opened: 30, closed: 55 },
          { year: 2016, opened: 38, closed: 45 }, { year: 2017, opened: 42, closed: 38 },
          { year: 2018, opened: 45, closed: 32 }, { year: 2019, opened: 40, closed: 38 },
          { year: 2020, opened: 20, closed: 28 }, { year: 2021, opened: 18, closed: 95 },
          { year: 2022, opened: 28, closed: 15 }, { year: 2023, opened: 32, closed: 12 },
          { year: 2024, opened: 28, closed: 10 }, { year: 2025, opened: 25, closed: 8  },
        ],
        remarks: [
          { years: 'Note', note: 'Figures derived from UDISE+ total school counts and state rationalisation reports. New openings and closures are not published together in a single dataset — treat as indicative orders of magnitude, not precise counts.', noteHi: 'आंकड़े UDISE+ कुल स्कूल गणना और राज्य तर्कसंगतता रिपोर्टों से प्राप्त हैं। नए स्कूल खोलने और बंद करने की जानकारी एक ही डेटासेट में प्रकाशित नहीं होती — इन्हें सटीक गणना नहीं बल्कि संकेतात्मक मात्रा के रूप में लें।  ' },
          { years: '2006–11', note: 'SSA expansion peak — up to 95,000 new schools opened in a single year (2011). Focus on access: every child within 1km of a school. Total school count crosses 14 lakh.', noteHi: 'SSA विस्तार का चरम — एक वर्ष में 95,000 तक नए स्कूल खुले (2011)। पहुंच पर ध्यान: हर बच्चे के लिए 1 किमी के भीतर स्कूल। कुल स्कूल संख्या 14 लाख पार कर गई।  ' },
          { years: '2014–16', note: 'Rationalisation begins under NDA. States close schools with fewer than 20 students — UP, Bihar, Rajasthan shut tens of thousands. Closures exceed openings for the first time.', noteHi: 'NDA के तहत तर्कसंगतता शुरू होती है। राज्य 20 से कम छात्रों वाले स्कूल बंद करते हैं — यूपी, बिहार, राजस्थान ने हजारों स्कूल बंद किए। पहली बार बंद होने वाले स्कूलों की संख्या नए खुले स्कूलों से अधिक हुई।  ' },
          { years: '2017–19', note: 'Stabilisation — Samagra Shiksha Abhiyan (2018) shifts focus from quantity to quality. Openings and closures broadly balance; net school count holds ~15.5 lakh.', noteHi: 'स्थिरीकरण — समग्र शिक्षा अभियान (2018) मात्रा से गुणवत्ता पर ध्यान केंद्रित करता है। खुलने और बंद होने वाले स्कूल लगभग बराबर; कुल स्कूल संख्या लगभग 15.5 लाख बनी रहती है।  ' },
          { years: '2021', note: 'Largest single-year closure wave — ~95,000 schools shut or merged, many triggered by NEP 2020\'s school complex model and state consolidation drives. Total count falls from ~15.5L to ~14.7L.', noteHi: 'सबसे बड़ी एक-वर्षीय बंदी की लहर — लगभग 95,000 स्कूल बंद या विलयित हुए, कई NEP 2020 के स्कूल कॉम्प्लेक्स मॉडल और राज्य समेकन पहलों के कारण। कुल संख्या लगभग 15.5 लाख से घटकर 14.7 लाख हुई।  ' },
          { years: '2022–25', note: 'Post-consolidation equilibrium. Openings (~25–32k/yr) modestly exceed closures. Focus shifts to upgrading existing schools (PM SHRI scheme — 14,500 model schools) over building new ones.', noteHi: 'समेकन के बाद संतुलन। खुलने वाले स्कूल (~25–32 हजार/वर्ष) बंद होने वाले से थोड़े अधिक। ध्यान नए स्कूल बनाने की बजाय मौजूदा स्कूलों के उन्नयन पर (PM SHRI योजना — 14,500 मॉडल स्कूल)।  ' },
        ],
      },
      {
        label: 'PM Poshan / Mid-Day Meal — Children Covered (crore)', unit: ' cr', source: 'MoE Annual Reports · PM POSHAN portal · MDM scheme data',
        data: [
          { year: 2004, value: 10.5 }, { year: 2005, value: 11.2 }, { year: 2006, value: 13.0 },
          { year: 2007, value: 14.0 }, { year: 2008, value: 14.6 }, { year: 2009, value: 14.0 },
          { year: 2010, value: 11.4 }, { year: 2011, value: 10.8 }, { year: 2012, value: 10.5 },
          { year: 2013, value: 10.4 }, { year: 2014, value: 10.0 }, { year: 2015, value: 9.9  },
          { year: 2016, value: 9.9  }, { year: 2017, value: 9.6  }, { year: 2018, value: 9.5  },
          { year: 2019, value: 9.4  }, { year: 2020, value: -3.5 }, { year: 2021, value: 9.8  },
          { year: 2022, value: 11.2 }, { year: 2023, value: 11.5 }, { year: 2024, value: 11.8 },
          { year: 2025, value: 12.0 },
        ],
        remarks: [
          { years: '2004–09', note: 'Rapid expansion under UPA-I after SC order (2001) mandated cooked meals. Coverage nearly doubles to 14.6 crore. Upper primary (Std VI–VIII) added 2007-08.', noteHi: 'UPA-I के तहत तेजी से विस्तार, SC के आदेश (2001) के बाद जो पकवान भोजन अनिवार्य किया। कवरेज लगभग दोगुना होकर 14.6 करोड़ हो गया। उच्च प्राथमिक (कक्षा VI–VIII) 2007-08 में जोड़ा गया।  ' },
          { years: '2010–13', note: 'Apparent fall from 14.6→10.5 crore is partly a data recalibration — upper primary figures were previously double-counted. Effective coverage remains ~10–11 crore.', noteHi: '14.6→10.5 करोड़ की स्पष्ट गिरावट आंशिक रूप से डेटा पुनर्मूल्यांकन है — उच्च प्राथमिक आंकड़े पहले दो बार गिने गए थे। प्रभावी कवरेज लगभग 10–11 करोड़ बनी रहती है।  ' },
          { years: '2014–19', note: 'Gradual decline (~9.4 crore) mirrors school rationalisation and enrolment contraction. Per-meal cost revised upward; states struggle to meet centre\'s cost-sharing 60:40 ratio.', noteHi: 'धीरे-धीरे गिरावट (~9.4 करोड़) स्कूल तर्कसंगतता और नामांकन में कमी को दर्शाती है। प्रति भोजन लागत बढ़ाई गई; राज्य केंद्र के 60:40 लागत साझा अनुपात को पूरा करने में संघर्ष कर रहे हैं।  ' },
          { years: '2020', note: 'COVID school closures suspend cooked meals. Centre directs states to provide dry food rations (rice, dal) directly to families — ~3.5 crore children reached, majority missed.', noteHi: 'COVID के कारण स्कूल बंद होने पर पकवान भोजन निलंबित। केंद्र ने राज्यों को परिवारों को सीधे सूखा राशन (चावल, दाल) देने का निर्देश दिया — लगभग 3.5 करोड़ बच्चों तक पहुंचा, अधिकांश बच्चे छूट गए।  ' },
          { years: '2021–22', note: 'Schools reopen; scheme renamed PM POSHAN (Sep 2021). Coverage recovers to 11.2 crore. Scope expanded to include pre-primary (Balvatikas) in 2022.', noteHi: 'स्कूल फिर से खुले; योजना का नाम बदलकर PM POSHAN (सितंबर 2021) किया गया। कवरेज 11.2 करोड़ तक पहुंचा। 2022 में पूर्व-प्राथमिक (बालवाटिकाएं) को भी शामिल किया गया।  ' },
          { years: '2023–25', note: 'Coverage at 11.5–12 crore — highest since 2009. CAG 2023 audit flagged ₹1,968 crore unspent in 15 states and cook wages below minimum wage in 11 states.', noteHi: 'कवरेज 11.5–12 करोड़ — 2009 के बाद सबसे अधिक। CAG 2023 ऑडिट ने 15 राज्यों में ₹1,968 करोड़ अप्रयुक्त और 11 राज्यों में रसोइया मजदूरी न्यूनतम मजदूरी से कम होने की बात उठाई।  ' },
        ],
      },
      {
        label: 'Total Student Enrollment (crore, all levels)', unit: ' cr', source: 'DISE / UDISE+ Annual Reports · MoE',
        data: [
          { year: 2006, value: 18.8 }, { year: 2007, value: 19.5 }, { year: 2008, value: 20.0 },
          { year: 2009, value: 20.6 }, { year: 2010, value: 21.0 }, { year: 2011, value: 21.8 },
          { year: 2012, value: 22.5 }, { year: 2013, value: 23.0 }, { year: 2014, value: 22.8 },
          { year: 2015, value: 23.1 }, { year: 2016, value: 23.2 }, { year: 2017, value: 23.4 },
          { year: 2018, value: 23.5 }, { year: 2019, value: 24.5 }, { year: 2020, value: 25.0 },
          { year: 2021, value: 25.4 }, { year: 2022, value: 25.1 }, { year: 2023, value: 24.8 },
          { year: 2024, value: 25.0 }, { year: 2025, value: 25.2 },
        ],
        remarks: [
          { years: '2006–13', note: 'SSA-driven expansion — enrollment grows from 18.8 → 23 crore (+4.2 crore). Near-universal primary coverage achieved; upper primary and secondary enrolment catching up.', noteHi: 'SSA-प्रेरित विस्तार — नामांकन 18.8 → 23 करोड़ (+4.2 करोड़) बढ़ा। लगभग सार्वभौमिक प्राथमिक कवरेज हासिल; उच्च प्राथमिक और माध्यमिक नामांकन पकड़ बना रहा है।  ' },
          { years: '2014–18', note: 'Growth stalls at ~23 crore. School rationalisation closes low-enrolment schools; demographic stabilisation in south and urban India; some students shift to private schools.', noteHi: 'वृद्धि लगभग 23 करोड़ पर रुक गई। स्कूल तर्कसंगतता ने कम नामांकन वाले स्कूल बंद किए; दक्षिण और शहरी भारत में जनसांख्यिकीय स्थिरीकरण; कुछ छात्र निजी स्कूलों में चले गए।  ' },
          { years: '2019–21', note: 'Jump to 25.4 crore. Partly genuine — PM SHRI, KGBV expansion. Partly data artefact: COVID-era relief linkage inflated government school rolls as families left private schools.', noteHi: '25.4 करोड़ तक छलांग। आंशिक रूप से वास्तविक — PM SHRI, KGBV विस्तार। आंशिक रूप से डेटा त्रुटि: COVID-कालीन राहत से सरकारी स्कूलों के नामांकन बढ़े क्योंकि परिवार निजी स्कूल छोड़ गए।  ' },
          { years: '2022–23', note: 'Slight dip back to 24.8 crore as private school enrolment recovers post-COVID and government rolls self-correct. UDISE 2022-23 counts 14.89 lakh schools.', noteHi: 'COVID के बाद निजी स्कूल नामांकन के पुनरुद्धार और सरकारी नामांकन के स्व-सुधार के कारण हल्की गिरावट 24.8 करोड़ पर। UDISE 2022-23 में 14.89 लाख स्कूल गिने गए।  ' },
          { years: '2024–25', note: 'Estimated recovery to 25+ crore. NEP 2020 integration of Balvatikas (pre-primary) set to add ~1.5 crore new entrants over next 3–5 years if fully implemented.', noteHi: 'अनुमानित पुनर्प्राप्ति 25+ करोड़ तक। NEP 2020 के तहत बालवाटिकाओं (पूर्व-प्राथमिक) का समावेशन अगले 3–5 वर्षों में लगभग 1.5 करोड़ नए प्रवेशकों को जोड़ने वाला है यदि पूरी तरह लागू हुआ।  ' },
        ],
      },
      {
        label: 'Learning Outcomes — Std V, Rural India (%)', unit: '%', source: 'ASER / PRATHAM Annual Reports 2005–2023 · Gap years: no regular survey conducted',
        series: [
          { key: 'reading',    label: 'Reading (Std II text)', color: '#f59e0b' },
          { key: 'arithmetic', label: 'Arithmetic (division)',  color: '#6366f1' },
        ],
        data: [
          { year: 2005, reading: 52.1, arithmetic: 35.9 }, { year: 2006, reading: 54.6, arithmetic: 37.2 },
          { year: 2007, reading: 56.2, arithmetic: 37.8 }, { year: 2008, reading: 56.0, arithmetic: 37.2 },
          { year: 2009, reading: 52.8, arithmetic: 36.0 }, { year: 2010, reading: 53.4, arithmetic: 35.9 },
          { year: 2011, reading: 48.2, arithmetic: 29.9 }, { year: 2012, reading: 46.8, arithmetic: 26.1 },
          { year: 2013, reading: 47.0, arithmetic: 26.0 }, { year: 2014, reading: 48.1, arithmetic: 26.1 },
          { year: 2016, reading: 50.4, arithmetic: 26.1 }, { year: 2018, reading: 50.5, arithmetic: 27.9 },
          { year: 2023, reading: 43.3, arithmetic: 42.7 },
        ],
        remarks: [
          { years: '2005–07', note: 'Baseline era — ~52–56% of Std V rural children can read a Std II text. Arithmetic ability at ~36–38%. School enrolment rising under SSA but quality not tracked.', noteHi: 'आधार युग — लगभग 52–56% ग्रामीण कक्षा V के बच्चे कक्षा II का पाठ पढ़ सकते हैं। अंकगणित क्षमता लगभग 36–38%। SSA के तहत स्कूल नामांकन बढ़ रहा है लेकिन गुणवत्ता पर निगरानी नहीं।  ' },
          { years: '2011–14', note: 'Sharp fall in both metrics after RTE Act (2009) introduced "no detention" policy — students promoted without passing, removing accountability. Reading falls to 46–48%.', noteHi: 'RTE अधिनियम (2009) के "नो डिटेंशन" नीति लागू होने के बाद दोनों मापदंडों में तेज गिरावट — छात्र बिना पास हुए प्रमोट किए गए, जवाबदेही खत्म हुई। पढ़ाई 46–48% तक गिर गई।  ' },
          { years: '2016–18', note: 'Marginal recovery as states begin rolling back no-detention for Classes 5 & 8. Reading returns to ~50.5% — still below 2007 peak.', noteHi: 'मामूली सुधार क्योंकि राज्य कक्षा 5 और 8 के लिए नो-डिटेंशन नीति वापस लेने लगे। पढ़ाई लगभग 50.5% पर लौट आई — फिर भी 2007 के चरम से कम।  ' },
          { years: '2019–22', note: 'ASER 2019 delayed; 2020 not conducted (COVID); 2021 phone survey (limited comparability); 2022 "Beyond Basics" covered 14–18 age group only — no Std V data.', noteHi: 'ASER 2019 विलंबित; 2020 COVID के कारण नहीं हुआ; 2021 फोन सर्वेक्षण (सीमित तुलनात्मकता); 2022 "Beyond Basics" केवल 14–18 आयु वर्ग को कवर करता है — कक्षा V का डेटा नहीं।  ' },
          { years: '2023', note: 'Reading falls to 43.3% — COVID school closures (18+ months for many states) cause sharp learning loss. Arithmetic paradoxically improves to 42.7%, possibly from remedial numeracy push post-COVID.', noteHi: 'पढ़ाई 43.3% तक गिर गई — COVID के कारण स्कूल बंद (कई राज्यों में 18+ महीने) से तेज सीखने की हानि। अंकगणित आश्चर्यजनक रूप से 42.7% तक बढ़ा, संभवतः COVID के बाद सुधारात्मक गणित प्रयासों से।  ' },
        ],
      },
    ],
    stats: [
      {
        label: 'Gross Enrolment Ratio — Higher Education (2022-23)',
        value: '29.5%',
        note: 'Up from 23.7% in 2014-15. Total enrolment reached a record 4.5 crore students. Female GER (30.0%) now exceeds male GER (28.9%) — a structural shift. Targets 50% GER by 2035 under NEP 2020.',
        trend: 'up',
        source: 'AISHE 2022-23, Ministry of Education, 13th Edition',
      },
      {
        label: 'Rural Std V students who can read a Std II text (ASER 2023)',
        value: '43.3%',
        note: 'Down from 50.5% in 2018 and 56.2% in 2007. COVID school closures (18+ months) caused the sharpest recorded learning loss. Nearly 6 in 10 Std V rural children cannot read a basic text.',
        trend: 'down',
        source: 'ASER (Annual Status of Education Report) 2023, PRATHAM Education Foundation',
      },
      {
        label: 'Official literacy rate (latest Census)',
        value: '74.0%',
        note: 'From Census 2011 — no new Census count since. NSO PLFS surveys estimate literacy at ~77-78% by 2025, but unverified without an official Census. Male 82.1%, Female 65.5% (2011). Census 2021 still delayed.',
        trend: 'neutral',
        source: 'Census of India 2011, Registrar General of India; Census 2021 not yet conducted',
      },
    ],
  },
  {
    key: 'employment', label: 'Employment', score: EMPLOYMENT_SCORE, icon: Briefcase,
    summary: 'India\'s 3.2% headline unemployment masks deep structural dysfunction. Youth unemployment runs at 3× the headline rate. ~90% of the workforce — roughly 50 crore workers — remain in informal employment with no written contract or social protection, a share that has barely moved in 20 years despite sustained GDP growth. MGNREGS generated ~267 crore person-days in FY2024-25 — still elevated above pre-2020 norms, signalling the rural safety net remains structurally embedded.\n\nThe government\'s flagship skilling response — PMKVY — spent ₹10,194 crore across three phases (2015–2022) and certified 1.10 crore candidates, yet CAG\'s December 2025 performance audit (Report No. 20 of 2025) found the programme riddled with systemic fraud. Bank account details were missing, null, or plainly invalid — "11111111111", "123456", single-digit numbers — for 94.53% of 95.90 lakh PMKVY 2.0/3.0 beneficiary records on the Skill India Portal. Only 41% of certified candidates were independently verified as placed (the Ministry had publicly claimed 68%, based on training-partner self-reporting). Field inspections found training centres locked shut on dates the portal showed live training; the same photograph appeared simultaneously as attendance proof in Bihar, UP, Maharashtra, and Rajasthan; defunct companies continued to certify candidates — including one that claimed training took place on 31st February. As of October 2024, 34 lakh certified candidates had still not received their ₹500 DBT incentive. Despite a decade of PMKVY spending, only 4.4% of Indians aged 15–29 have received formal vocational training (Economic Survey 2023-24) — statistically unchanged from before the scheme launched.',
    charts: [
      {
        label: 'Unemployment Rate — Usual Status, age 15+ (%)', unit: '%', source: 'NSS EUS (quinquennial, 2004–2012) · PLFS Annual (2018–2025, MOSPI) · Methods differ — not fully comparable across break',
        data: [
          { year: 2004, value: 8.3 }, { year: 2010, value: 9.4 },
          { year: 2012, value: 5.0 }, { year: 2018, value: 6.1 },
          { year: 2019, value: 5.8 }, { year: 2020, value: 4.8 },
          { year: 2021, value: 4.2 }, { year: 2022, value: 4.1 },
          { year: 2023, value: 3.2 }, { year: 2024, value: 3.2 },
          { year: 2025, value: 3.1 },
        ],
        remarks: [
          { years: 'Note', note: 'Pre-2018 figures from NSS Employment-Unemployment Surveys (quinquennial, Current Weekly Status basis). Post-2018 from PLFS (annual, Usual Status). Different reference periods and sampling make direct comparison indicative only.', noteHi: '2018 से पहले के आंकड़े NSS रोजगार-अरोजगार सर्वेक्षणों (पांच वर्षीय, वर्तमान साप्ताहिक स्थिति आधार) से; 2018 के बाद PLFS (वार्षिक, सामान्य स्थिति)। विभिन्न संदर्भ अवधि और नमूना के कारण सीधे तुलना संकेतात्मक है।  ' },
          { years: '2004–10', note: 'Unemployment rises 8.3% → 9.4% despite high GDP growth — a "jobless growth" phase. IT and services boom absorbs educated workers but manufacturing fails to absorb the mass labour force.', noteHi: 'बेरोजगारी 8.3% से बढ़कर 9.4% हुई जबकि GDP वृद्धि उच्च थी — यह "बेरोजगार विकास" चरण है। IT और सेवा क्षेत्र शिक्षित श्रमिकों को अवशोषित करते हैं लेकिन विनिर्माण बड़े पैमाने पर श्रम बल को अवशोषित करने में विफल रहता है।  ' },
          { years: '2012', note: 'NSS 2011-12 showed a sharp fall to 5.0% — disputed by economists. NSS EUS was discontinued after 2011-12; the 2017-18 PLFS showed 6.1%, suggesting the drop was partly methodological.', noteHi: 'NSS 2011-12 ने 5.0% तक तेज गिरावट दिखाई — अर्थशास्त्रियों द्वारा विवादित। NSS EUS 2011-12 के बाद बंद हो गया; 2017-18 PLFS ने 6.1% दिखाया, जो गिरावट को आंशिक रूप से विधिक बताता है।  ' },
          { years: '2020', note: 'PLFS shows 4.8% during COVID — counterintuitive. Usual Status methodology counts returning migrants as "employed in agriculture." CMIE\'s contemporaneous data showed urban unemployment peaking at 24%.', noteHi: 'PLFS ने COVID के दौरान 4.8% दिखाया — विरोधाभासी। सामान्य स्थिति पद्धति लौटे प्रवासियों को "कृषि में रोजगार" मानती है। CMIE के समकालीन आंकड़ों ने शहरी बेरोजगारी 24% तक पहुंची दिखाई।  ' },
          { years: '2021–23', note: 'Steady decline to 3.2%. Formal job creation (EPFO net additions ~1.4 crore/yr) and rural LFPR surge drive headline down. Youth and urban unemployment remain significantly higher.', noteHi: 'स्थिर गिरावट 3.2% तक। औपचारिक नौकरी सृजन (EPFO शुद्ध वृद्धि ~1.4 करोड़/वर्ष) और ग्रामीण LFPR वृद्धि ने मुख्य दर को कम किया। युवा और शहरी बेरोजगारी अभी भी काफी अधिक है।  ' },
          { years: '2024–25', note: 'Holds at 3.1–3.2% — near record low by this measure. Structural concern: ~90% of workers remain informal with no written contract or social protection (ILO 2024).', noteHi: '3.1–3.2% पर स्थिर — इस माप से लगभग रिकॉर्ड निम्न। संरचनात्मक चिंता: लगभग 90% श्रमिक अनौपचारिक हैं जिनके पास कोई लिखित अनुबंध या सामाजिक सुरक्षा नहीं है (ILO 2024)।  ' },
        ],
      },
      {
        label: 'Youth Unemployment Rate — age 15–29, Usual Status (%)', unit: '%', source: 'NSS EUS (2004–2012) · PLFS Annual (2018–2025, MOSPI)',
        data: [
          { year: 2004, value: 15.5 }, { year: 2010, value: 18.0 },
          { year: 2012, value: 14.0 }, { year: 2018, value: 17.8 },
          { year: 2019, value: 17.5 }, { year: 2020, value: 15.5 },
          { year: 2021, value: 12.9 }, { year: 2022, value: 12.4 },
          { year: 2023, value: 10.2 }, { year: 2024, value: 10.2 },
          { year: 2025, value: 9.8  },
        ],
        remarks: [
          { years: '2004–10', note: 'Youth unemployment rises to 18% — 5× the headline rate. Education expansion creates more degree-holders than formal jobs; credential inflation sets in.', noteHi: 'युवा बेरोजगारी 18% तक बढ़ी — मुख्य दर का 5 गुना। शिक्षा विस्तार से अधिक डिग्रीधारक बन रहे हैं बनिस्बत औपचारिक नौकरियों के; योग्यता मुद्रास्फीति शुरू हो गई है।  ' },
          { years: '2018', note: 'PLFS era begins. Youth at 17.8% vs headline 6.1% — the gap reveals how heavily the headline is dragged down by subsistence agricultural work among older cohorts.', noteHi: 'PLFS युग शुरू। युवा 17.8% बनाम मुख्य दर 6.1% — यह अंतर दर्शाता है कि मुख्य दर वृद्ध आयु वर्ग के कृषि कार्यों से भारी रूप से प्रभावित है।  ' },
          { years: '2020', note: 'Falls to 15.5% during COVID — same Usual Status distortion as headline. Returning youth counted as family farm labour. Urban educated youth unemployment was far higher.', noteHi: 'COVID के दौरान 15.5% तक गिरावट — वही सामान्य स्थिति विकृति। लौटे युवा परिवार के खेत मजदूर माने गए। शहरी शिक्षित युवा बेरोजगारी कहीं अधिक थी।  ' },
          { years: '2021–23', note: 'Declines to 10.2% — partly rural pull (MGNREGS, agriculture) and partly growth in gig/platform work counted as employed. Quality of jobs not captured.', noteHi: '10.2% तक गिरावट — आंशिक रूप से ग्रामीण आकर्षण (MGNREGS, कृषि) और आंशिक रूप से गिग/प्लेटफॉर्म कार्य में वृद्धि को रोजगार माना गया। नौकरी की गुणवत्ता नहीं मापी गई।  ' },
          { years: '2024–25', note: 'Holds ~9.8–10.2%. Still 3× the headline rate. ILO estimates India needs 9 crore new non-farm jobs by 2030 to absorb the demographic dividend — current pace falls short.', noteHi: 'लगभग 9.8–10.2% पर स्थिर। अभी भी मुख्य दर का 3 गुना। ILO का अनुमान है कि भारत को 2030 तक 9 करोड़ नए गैर-कृषि रोजगार चाहिए ताकि जनसांख्यिकीय लाभांश को अवशोषित किया जा सके — वर्तमान गति कम है।  ' },
        ],
      },
      {
        label: 'MGNREGS — Person-Days Generated (crore / FY)', unit: ' cr', source: 'MoRD MGNREGS MIS portal (mgnregs.nic.in)',
        data: [
          { year: 2007, value: 90.5  }, { year: 2008, value: 143.5 }, { year: 2009, value: 216.3 },
          { year: 2010, value: 283.6 }, { year: 2011, value: 257.6 }, { year: 2012, value: 218.8 },
          { year: 2013, value: 229.9 }, { year: 2014, value: 166.2 }, { year: 2015, value: 166.5 },
          { year: 2016, value: 218.1 }, { year: 2017, value: 233.7 }, { year: 2018, value: 235.8 },
          { year: 2019, value: 268.8 }, { year: 2020, value: 265.4 }, { year: 2021, value: 389.7 },
          { year: 2022, value: 363.3 }, { year: 2023, value: 295.1 }, { year: 2024, value: 309.0 },
          { year: 2025, value: 267.0 },
        ],
        remarks: [
          { years: '2007–09', note: 'Scheme rolls out nationally (launched Feb 2006). Demand ramps fast — droughts in 2009 push person-days to 216 crore. Initially covers only 200 districts, expanded to all rural districts by 2008.', noteHi: 'योजना राष्ट्रीय स्तर पर लागू (फरवरी 2006 में शुरू)। मांग तेजी से बढ़ी — 2009 के सूखे ने व्यक्ति-दिन 216 करोड़ तक पहुंचा दिए। शुरू में केवल 200 जिलों को कवर किया गया, 2008 तक सभी ग्रामीण जिलों में विस्तार।  ' },
          { years: '2010', note: 'All-time high of 283.6 crore — 2009 drought (worst in 37 years) drives massive rural distress. ~5.2 crore households employed.', noteHi: 'सर्वकालिक उच्चतम 283.6 करोड़ — 2009 का सूखा (37 वर्षों में सबसे खराब) ने ग्रामीण संकट को बढ़ाया। लगभग 5.2 करोड़ परिवार रोजगारित।  ' },
          { years: '2013–15', note: 'Sharp drop to ~166 crore. UPA-II budget cuts 2013-14; NDA-I initially sceptical — PM Modi called it "a living monument to UPA failure" in Parliament (Feb 2015). Wage arrears mount.', noteHi: 'तेज गिरावट लगभग 166 करोड़ तक। UPA-II के बजट कटौती 2013-14; NDA-I शुरू में संदेहास्पद — पीएम मोदी ने इसे संसद में "UPA की विफलता की जीवित स्मृति" कहा (फरवरी 2015)। मजदूरी बकाया बढ़े।  ' },
          { years: '2016–20', note: 'Gradual rehabilitation — NDA accepts scheme\'s safety-net role. Demand rises to 265 crore. Wage rates revised but still lag state minimum wages in most states.', noteHi: 'धीरे-धीरे पुनर्वास — NDA ने योजना की सुरक्षा जाल भूमिका स्वीकार की। मांग बढ़कर 265 करोड़ हुई। मजदूरी दरें संशोधित लेकिन अधिकांश राज्यों में अभी भी न्यूनतम मजदूरी से कम।  ' },
          { years: '2021', note: 'Record 389.7 crore — COVID lockdowns collapse informal urban jobs; millions of migrants return to villages and demand MGNREGS work. Budget supplementary allocation of ₹40,000 crore rushed through.', noteHi: 'रिकॉर्ड 389.7 करोड़ — COVID लॉकडाउन ने अनौपचारिक शहरी नौकरियां ध्वस्त कर दीं; लाखों प्रवासी गांव लौटे और MGNREGS काम की मांग बढ़ी। ₹40,000 करोड़ का बजट अतिरिक्त आवंटन तेजी से पारित।  ' },
          { years: '2023–24', note: 'Decline from 295.1 crore (FY23) to 309.0 crore (FY24, PTI/MoRD). Rural demand remains above pre-COVID levels but budget tightening and partial rural recovery moderate the figures.', noteHi: 'FY23 के 295.1 करोड़ से गिरकर FY24 में 309.0 करोड़ (PTI/MoRD)। ग्रामीण मांग COVID से पहले के स्तर से ऊपर बनी लेकिन बजट कड़ाई और आंशिक ग्रामीण सुधार ने आंकड़ों को मध्यम किया।  ' },
          { years: '★ 2025', note: 'FY2024-25 provisional: ~267 crore person-days (MoRD Year End Review shows 196.30 crore for April–December 2024; full-year estimate per MIS trend). Demand fell sharply from FY21 peak — driven by budget rationalisation and a partial rural employment recovery.', noteHi: 'FY2024-25 अस्थायी: लगभग 267 करोड़ व्यक्ति-दिन (MoRD वर्ष अंत समीक्षा में अप्रैल–दिसंबर 2024 के लिए 196.30 करोड़; पूर्ण वर्ष का अनुमान MIS प्रवृत्ति के अनुसार)। मांग FY21 चरम से तेज गिरावट — बजट तर्कसंगतता और आंशिक ग्रामीण रोजगार सुधार के कारण।  ' },
        ],
      },
      {
        label: 'Informal Employment Share — % of total workforce', unit: '%', source: 'NCEUS (2004–2011) · PLFS / ILO India Labour Market Updates (2017–2025)',
        data: [
          { year: 2004, value: 93.0 }, { year: 2009, value: 92.0 },
          { year: 2011, value: 90.8 }, { year: 2017, value: 90.7 },
          { year: 2018, value: 90.2 }, { year: 2019, value: 89.8 },
          { year: 2020, value: 90.3 }, { year: 2021, value: 90.2 },
          { year: 2022, value: 90.1 }, { year: 2023, value: 90.0 },
          { year: 2024, value: 89.8 }, { year: 2025, value: 89.5 },
        ],
        remarks: [
          { years: 'Definition', note: 'Informal = workers without a written job contract AND without employer-paid social protection (EPF/ESI). Includes own-account workers, unpaid family labour, casual wage workers, and contract workers without formal terms.', noteHi: 'अनौपचारिक = बिना लिखित नौकरी अनुबंध वाले और बिना नियोक्ता-भुगतान सामाजिक सुरक्षा (EPF/ESI) वाले श्रमिक। इसमें स्व-स्वामित्व वाले श्रमिक, अप्रत्यक्ष पारिवारिक श्रम, आकस्मिक मजदूर और बिना औपचारिक शर्तों के संविदा श्रमिक शामिल हैं।  ' },
          { years: '2004–11', note: 'NCEUS (2004) first quantified India\'s informal economy at 93% of the workforce — 395 million workers. Despite 8%+ GDP growth in 2004–08, the formal-job share barely moved. High growth absorbed into informal trade, construction and services.', noteHi: 'NCEUS (2004) ने पहली बार भारत की अनौपचारिक अर्थव्यवस्था को 93% कार्यबल के रूप में मापा — 395 मिलियन श्रमिक। 2004–08 में 8%+ GDP वृद्धि के बावजूद औपचारिक नौकरी हिस्सा लगभग स्थिर रहा। उच्च वृद्धि अनौपचारिक व्यापार, निर्माण और सेवा क्षेत्रों में समाहित हुई।  ' },
          { years: '2017–19', note: 'PLFS era — informal share at ~90%. Demonetisation (Nov 2016) temporarily disrupted informal cash-based businesses; some formalisation via EPFO enrollment. GST registration added ~1.2 crore new formal units by 2019.', noteHi: 'PLFS युग — अनौपचारिक हिस्सा लगभग 90%। नोटबंदी (नवंबर 2016) ने अस्थायी रूप से नकद आधारित अनौपचारिक व्यवसायों को बाधित किया; EPFO नामांकन के माध्यम से कुछ औपचारिकता आई। GST पंजीकरण ने 2019 तक लगभग 1.2 करोड़ नए औपचारिक इकाइयां जोड़ीं।  ' },
          { years: '2020', note: 'COVID reversal — informal share ticks back up to 90.3% as migrant workers, gig workers and urban casual labour lost formal-sector jobs and re-entered subsistence work.', noteHi: 'COVID उलटफेर — अनौपचारिक हिस्सा 90.3% तक बढ़ गया क्योंकि प्रवासी श्रमिक, गिग श्रमिक और शहरी आकस्मिक मजदूर औपचारिक क्षेत्र की नौकरियां खोकर पुनः जीविकोपार्जन कार्य में लौटे।  ' },
          { years: '2021–25', note: 'Marginal decline to ~89.5% — driven by EPFO net payroll additions (~1.4 crore/yr) and PM Vishwakarma / PMEGP formalisation. At this pace, India reaches 85% informal share only by ~2045.', noteHi: 'मामूली गिरावट लगभग 89.5% — EPFO शुद्ध पेरोल वृद्धि (~1.4 करोड़/वर्ष) और PM विश्वकर्मा / PMEGP औपचारिकता के कारण। इस गति से भारत 85% अनौपचारिक हिस्से तक लगभग 2045 में पहुंचेगा।  ' },
        ],
      },
      {
        label: 'PMKVY — Annual Candidates Enrolled (lakh / FY, all components)',
        unit: ' lakh',
        source: 'MSDE Year-End Reviews 2016–2025; PIB press releases; CAG Report No. 20 of 2025',
        data: [
          { year: 2016, value: 24.0 }, { year: 2017, value: 20.0 },
          { year: 2018, value: 21.0 }, { year: 2019, value: 18.0 },
          { year: 2020, value: 10.0 }, { year: 2021, value: 6.0  },
          { year: 2022, value: 7.0  }, { year: 2023, value: 18.0 },
          { year: 2024, value: 27.0 }, { year: 2025, value: 9.0  },
        ],
        remarks: [
          { years: 'Note', note: 'Includes Short-Term Training (STT), Recognition of Prior Learning (RPL) and Special Projects. RPL certifies already-employed workers (artisans, construction workers) — not fresh job-seekers — and forms a large share of the total count. Enrollment ≠ placement.', noteHi: 'इसमें शॉर्ट-टर्म ट्रेनिंग (STT), पूर्व ज्ञान की मान्यता (RPL) और विशेष परियोजनाएं शामिल हैं। RPL पहले से रोजगारित श्रमिकों (कारीगर, निर्माण श्रमिक) को प्रमाणित करता है — नए नौकरी चाहने वालों को नहीं — और कुल संख्या का बड़ा हिस्सा बनाता है। नामांकन ≠ प्लेसमेंट।  ' },
          { years: '2016', note: 'PMKVY 1.0 (FY2015-16) pilot: 24 lakh target met — one of the few PMKVY phases to achieve its stated enrollment goal. Training partner ecosystem established; NSDC accredits 1,500+ training centres nationwide.', noteHi: 'PMKVY 1.0 (FY2015-16) पायलट: 24 लाख लक्ष्य पूरा — PMKVY के कुछ चरणों में से एक जिसने नामांकन लक्ष्य हासिल किया। प्रशिक्षण भागीदार पारिस्थितिकी तंत्र स्थापित; NSDC ने देशभर में 1,500+ प्रशिक्षण केंद्रों को मान्यता दी।  ' },
          { years: '2020–21', note: 'COVID-19 collapses training centre operations. PMKVY 3.0 launched Dec 2020 with just ₹948 crore budget for 8 lakh candidates — a sharp downgrade from PMKVY 2.0\'s ₹12,000 crore for 1 crore. Actual enrollment for FY2021 falls to ~6 lakh.', noteHi: 'COVID-19 ने प्रशिक्षण केंद्रों के संचालन को ध्वस्त कर दिया। PMKVY 3.0 दिसंबर 2020 में केवल ₹948 करोड़ बजट के साथ 8 लाख उम्मीदवारों के लिए शुरू हुआ — PMKVY 2.0 के ₹12,000 करोड़ बजट और 1 करोड़ उम्मीदवारों की तुलना में भारी कटौती। FY2021 में वास्तविक नामांकन लगभग 6 लाख रह गया।  ' },
          { years: '2023–25', note: 'PMKVY 4.0 (2022-26) ramps up with ₹6,000 crore allocation. FY2024 hits a new high of 27 lakh driven by Industry 4.0 courses (AI, drones, green energy) and on-the-job training mandates. FY2025 data is partial (Apr–Sep 2024).', noteHi: 'PMKVY 4.0 (2022-26) ₹6,000 करोड़ आवंटन के साथ तेज़ी से बढ़ा। FY2024 में 27 लाख का नया उच्च स्तर Industry 4.0 पाठ्यक्रमों (AI, ड्रोन, हरित ऊर्जा) और ऑन-द-जॉब प्रशिक्षण अनिवार्यों से प्रेरित। FY2025 का डेटा आंशिक (अप्रैल–सितंबर 2024)।' },
        ],
      },
      {
        label: 'PMKVY Short-Term Training — Cumulative Training-to-Placement Pipeline (lakh)',
        unit: ' lakh',
        source: 'CAG Report No. 20 of 2025; PIB (MSDE); NSDC MIS; CAG Report No. 3 of 2025 (Uttarakhand)',
        series: [
          { key: 'enrolled',  label: 'Enrolled (STT)',  color: '#3b82f6' },
          { key: 'certified', label: 'Certified',        color: '#f59e0b' },
          { key: 'placed',    label: 'Placed (verified)', color: '#10b981' },
        ],
        data: [
          { year: 2019, enrolled: 37, certified: 28, placed: 15 },
          { year: 2022, enrolled: 50, certified: 40, placed: 18 },
          { year: 2025, enrolled: 63, certified: 56, placed: 24 },
        ],
        remarks: [
          { years: 'Definition', note: 'STT = Short-Term Training only. Excludes RPL (Recognition of Prior Learning), where placement is not the metric — those candidates are already employed. Placed = verified employment or self-employment as independently audited by CAG.', noteHi: 'STT = केवल Short-Term Training। इसमें RPL (Recognition of Prior Learning) शामिल नहीं है, जहाँ प्लेसमेंट मेट्रिक नहीं है — वे उम्मीदवार पहले से ही रोजगार में हैं। Placed = CAG द्वारा स्वतंत्र रूप से ऑडिट किए गए सत्यापित रोजगार या स्वरोजगार।' },
          { years: '2025 (CAG) — bank fraud', note: 'CAG Report No. 20 of 2025: 94.53% of 95.90 lakh PMKVY 2.0/3.0 beneficiary records had missing or invalid bank accounts on the Skill India Portal — including entries like "11111111111", "123456", and single-digit numbers. 12,122 account numbers were reused for 52,381+ candidates; one number appeared for 2,106 different people.', noteHi: 'CAG रिपोर्ट संख्या 20, 2025: Skill India Portal पर 95.90 लाख PMKVY 2.0/3.0 लाभार्थी रिकॉर्ड में से 94.53% के बैंक खाते गायब या अमान्य थे — जिनमें "11111111111", "123456" और एक-अंकीय नंबर जैसे प्रविष्टियाँ शामिल थीं। 12,122 खाता नंबर 52,381+ उम्मीदवारों के लिए पुनः उपयोग किए गए; एक नंबर 2,106 विभिन्न लोगों के लिए दिखाई दिया।' },
          { years: '2025 (CAG) — placement', note: 'Of 56 lakh certified under STT and Special Projects, only 23 lakh (41%) were placed. Ministry had claimed 68% placement in PIB press releases — based entirely on training-partner self-reporting. CAG could not independently verify placement data in UP or Kerala; Kerala partners submitted forged placement documents.', noteHi: 'STT और Special Projects के तहत 56 लाख प्रमाणित में से केवल 23 लाख (41%) प्लेस हुए। मंत्रालय ने PIB प्रेस विज्ञप्तियों में 68% प्लेसमेंट का दावा किया था — जो पूरी तरह से प्रशिक्षण-भागीदारों की स्व-रिपोर्टिंग पर आधारित था। CAG यूपी या केरल में प्लेसमेंट डेटा को स्वतंत्र रूप से सत्यापित नहीं कर सका; केरल के भागीदारों ने जाली प्लेसमेंट दस्तावेज़ प्रस्तुत किए।' },
          { years: 'Ghost companies', note: 'Defunct firms still certifying on the portal: Radiate Designs (struck off 2015) certified 15,218 people; Neelima Moving Pictures (shut 5-6 years) claimed 33,000 trainees; Jaipur Cultural Society claimed training on 31st February. Same photos used as training proof in Bihar, UP, Maharashtra and Rajasthan simultaneously.', noteHi: 'पोर्टल पर अभी भी बंद हो चुकी फर्में प्रमाणन कर रही हैं: Radiate Designs (2015 में बंद) ने 15,218 लोगों को प्रमाणित किया; Neelima Moving Pictures (5-6 साल से बंद) ने 33,000 प्रशिक्षुओं का दावा किया; Jaipur Cultural Society ने 31 फरवरी को प्रशिक्षण का दावा किया। बिहार, यूपी, महाराष्ट्र और राजस्थान में एक ही फोटो प्रशिक्षण प्रमाण के रूप में एक साथ उपयोग किए गए।' },
        ],
      },
      {
        label: 'PMKVY — Budget Allocation vs Expenditure (₹ crore, by phase)',
        unit: ' ₹cr',
        yearLabel: '',
        source: 'CAG Report No. 24 of 2022; PIB Dec 2020 (PMKVY 3.0 launch); MSDE Annual Reports; Union Budget documents',
        series: [
          { key: 'allocated', label: 'Allocated', color: '#6366f1' },
          { key: 'spent',     label: 'Spent',     color: '#f43f5e' },
        ],
        data: [
          { year: 2016, allocated: 1120,  spent: 980  },
          { year: 2020, allocated: 12000, spent: 9200 },
          { year: 2021, allocated: 948,   spent: 700  },
          { year: 2025, allocated: 6000,  spent: 3100 },
        ],
        remarks: [
          { years: 'X-axis', note: 'Each bar represents a PMKVY phase. X-axis shows the phase end year: 2016 = PMKVY 1.0 (₹1,120 cr); 2020 = PMKVY 2.0 (₹12,000 cr); 2021 = PMKVY 3.0 (₹948 cr); 2025 = PMKVY 4.0 (₹6,000 cr allocated; ₹3,100 cr spent through FY2025, with one year remaining).', noteHi: 'प्रत्येक बार PMKVY चरण का प्रतिनिधित्व करता है। X-अक्ष चरण के समाप्ति वर्ष को दिखाता है: 2016 = PMKVY 1.0 (₹1,120 करोड़); 2020 = PMKVY 2.0 (₹12,000 करोड़); 2021 = PMKVY 3.0 (₹948 करोड़); 2025 = PMKVY 4.0 (₹6,000 करोड़ आवंटित; FY2025 तक ₹3,100 करोड़ खर्च, एक वर्ष शेष)।' },
          { years: 'CAG FY22 (verified)', note: 'CAG Report No. 24 of 2022 confirmed ₹2,676.65 crore allocated vs ₹2,112.67 crore spent in FY2022 alone — a 21% under-utilisation (₹563.98 crore unspent). Persistent under-utilisation across all phases points to absorptive capacity constraints at training partners, not a lack of government funding.', noteHi: 'CAG रिपोर्ट संख्या 24, 2022 ने पुष्टि की ₹2,676.65 करोड़ आवंटित बनाम ₹2,112.67 करोड़ केवल FY2022 में खर्च — 21% कम उपयोग (₹563.98 करोड़ अप्रयुक्त)। सभी चरणों में लगातार कम उपयोग प्रशिक्षण भागीदारों की अवशोषण क्षमता की कमी को दर्शाता है, न कि सरकार के धन की कमी को।' },
          { years: 'PMKVY 2.0 note', note: 'PMKVY 2.0 (2016-20) was the largest skill-development budget in Indian history at ₹12,000 crore. CAG audits of multiple states found that training quality standards, biometric attendance, and captive placement guidelines were consistently violated by accredited training partners.', noteHi: 'PMKVY 2.0 (2016-20) भारतीय इतिहास का सबसे बड़ा कौशल विकास बजट था ₹12,000 करोड़। कई राज्यों के CAG ऑडिट में पाया गया कि प्रशिक्षण गुणवत्ता मानक, बायोमेट्रिक उपस्थिति, और कैप्टिव प्लेसमेंट दिशानिर्देशों का लगातार उल्लंघन किया गया।' },
        ],
      },

    ],
    stats: [
      {
        label: 'Unemployment rate (PLFS Jul 2023–Jun 2024)',
        value: '3.2%',
        note: 'Usual principal status, age 15+. Unchanged from 3.2% the prior year. Headline masks structural strain: youth unemployment (15–29 yrs) runs at ~17%, and the rate counts informal and casual work as "employed".',
        trend: 'neutral',
        source: 'PLFS Annual Report Jul 2023–Jun 2024, MOSPI — released 23 Sep 2024',
      },
      {
        label: 'Female Labour Force Participation Rate (PLFS 2023-24)',
        value: '~41.7%',
        note: 'Up from 30.0% in 2017-18 — a 12pp rise in six years. Rural FLFPR (~47%) drives the gain; urban FLFPR lags at ~25%. Critics note much of the rise is in unpaid family agriculture, not formal employment.',
        trend: 'up',
        source: 'PLFS Annual Report 2023-24, MOSPI; PIB press note 23 Sep 2024',
      },
      {
        label: 'Informal workforce share (est. 2024)',
        value: '~89.5%',
        note: '~450 million of ~500 million workers lack a written contract or employer-paid social protection. Share has barely moved from 93% in 2004 despite 6%+ GDP growth. EPFO net payroll additions (~1.4 crore/yr) represent only a fraction of new entrants.',
        trend: 'up',
        source: 'PLFS 2023-24 (MOSPI); NCEUS baseline 2004; EPFO Annual Report 2023-24',
      },
      {
        label: 'PMKVY total candidates trained/oriented (2015–Mar 2025)',
        value: '1.60 crore',
        note: 'Includes STT (Short-Term Training), RPL (Recognition of Prior Learning) and Special Projects across all four phases. RPL—certifying already-employed workers—forms a large share. Cumulative figure per MSDE Year-End Review 2025 and PIB press release of Mar 2025.',
        trend: 'up',
        source: 'PIB (MSDE) Mar 2025 · MSDE Year-End Review 2025',
      },
      {
        label: 'PMKVY bank account records — valid and traceable (CAG audit)',
        value: '5.47%',
        note: '94.53% of 95.90 lakh PMKVY 2.0/3.0 beneficiary records on the Skill India Portal had missing, blank, null, or clearly invalid bank details — including entries like "11111111111", "123456", and single-digit numbers. 12,122 account numbers were reused across 52,381 candidates; one number shared by 2,106 different people. DBT incentives had not reached 34 lakh certified candidates as of Oct 2024.',
        trend: 'down',
        source: 'CAG Report No. 20 of 2025 (Performance Audit, PMKVY phases 2015–2022)',
      },
      {
        label: 'PMKVY STT placement rate — CAG verified',
        value: '41%',
        note: 'Of 56 lakh certified under Short-Term Training and Special Projects, only 23 lakh were verifiably placed. Ministry claimed 68% based on training-partner self-reporting. Defunct companies with Skill India Portal access certified tens of thousands: Radiate Designs (struck off 2015, certified 15,218), Neelima Moving Pictures (shut 5-6 years, claimed 33,000 trainees). Same photos submitted as proof of training across multiple states.',
        trend: 'down',
        source: 'CAG Report No. 20 of 2025 · CAG Report No. 3 of 2023 (Kerala)',
      },
      {
        label: 'PMKVY total expenditure (phases 1–3, 2015–2022)',
        value: '₹10,194 crore',
        note: 'Spent across PMKVY 1.0, 2.0, and 3.0 (combined outlay ₹14,450 crore). CAG found that despite this scale of spending, data integrity, placement outcomes, and beneficiary identification were all severely compromised. Only 4.4% of Indians aged 15–29 have received formal vocational training (Economic Survey 2023-24) — unchanged despite years of large-scale expenditure.',
        trend: 'down',
        source: 'CAG Report No. 20 of 2025 · Economic Survey 2023-24 (MoF)',
      },
    ],
  },
  {
    key: 'health', label: 'Health', score: HEALTH_SCORE, icon: HeartPulse,
    summary: 'India has made genuine gains — infant mortality halved since 2000, maternal deaths down from 384 to ~70 per lakh, likely meeting the SDG target early. But the system is mid-transition and under pressure on multiple fronts. TB at 195 cases per lakh remains the world\'s highest burden. Child malnutrition is unmoved: 35.5% stunting, 19.3% wasting. NCDs now cause 67% of all deaths (up from 53% in 2000), driven by a diabetes epidemic affecting 11.4% of adults and rapidly rising obesity — 24% of women and 23% of men are overweight, nearly double the 2006 rate. India carries the world\'s largest "double burden": mass undernutrition alongside surging metabolic disease. Out-of-pocket costs at 47% of health spending — triple China\'s — push ~55 million into poverty each year. On the global HAQ Index, India ranks 145/195, below Bangladesh and Sri Lanka, with public health spending at 2.1% of GDP still short of the government\'s own 2.5% target.',
    charts: [
      {
        label: 'Infant Mortality Rate (per 1,000 live births) · 2024–25: SRS provisional', unit: ' /1k', source: 'Sample Registration System (SRS) / RGI · 2024–25 provisional SRS estimates', yearLabel: '',
        data: [
          { year: 2000, value: 68 }, { year: 2001, value: 66 }, { year: 2002, value: 64 },
          { year: 2003, value: 62 }, { year: 2004, value: 60 }, { year: 2005, value: 58 },
          { year: 2006, value: 55 }, { year: 2007, value: 53 }, { year: 2008, value: 52 },
          { year: 2009, value: 50 }, { year: 2010, value: 47 }, { year: 2011, value: 44 },
          { year: 2012, value: 42 }, { year: 2013, value: 40 }, { year: 2014, value: 39 },
          { year: 2015, value: 37 }, { year: 2016, value: 34 }, { year: 2017, value: 32 },
          { year: 2018, value: 30 }, { year: 2019, value: 28 }, { year: 2020, value: 28 },
          { year: 2021, value: 25 }, { year: 2022, value: 24 }, { year: 2023, value: 23 },
          { year: 2024, value: 22 }, { year: 2025, value: 21 },
        ],
        remarks: [
          { years: '★ 2024–25', note: 'Provisional SRS estimates — final SRS bulletins for 2024 and 2025 not yet published as of mid-2026; values based on SRS abridged life-table trend.', noteHi: 'अस्थायी SRS अनुमान — 2024 और 2025 के अंतिम SRS बुलेटिन मध्य 2026 तक प्रकाशित नहीं हुए; मान SRS संक्षिप्त जीवन-तालिका प्रवृत्ति पर आधारित हैं।' },
          { years: '2000–05', note: 'IMR starts at 68 — one in 14 newborns dies before age 1. ICDS and pulse-polio campaigns underway but rural cold-chain gaps persist.', noteHi: 'IMR 68 से शुरू होता है — हर 14 नवजात में से एक 1 वर्ष से पहले मर जाता है। ICDS और पल्स-पोलियो अभियान चल रहे हैं लेकिन ग्रामीण ठंडा-श्रृंखला में कमी बनी हुई है।' },
          { years: '2005–12', note: 'NRHM (2005) transforms primary healthcare — JSY cash transfers incentivise institutional deliveries, driving IMR down to 42 by 2012.', noteHi: 'NRHM (2005) ने प्राथमिक स्वास्थ्य देखभाल को बदल दिया — JSY नकद हस्तांतरण संस्थागत प्रसव को प्रोत्साहित करते हैं, जिससे IMR 2012 तक 42 तक गिर गया।' },
          { years: '2014–19', note: 'Continued decline to 28 — Mission Indradhanush immunisation push (2014) raises full-vaccination coverage from 65% to 76%. Neonatal care quality improves.', noteHi: 'गिरावट जारी रही 28 तक — Mission Indradhanush टीकाकरण अभियान (2014) ने पूर्ण टीकाकरण कवरेज 65% से 76% तक बढ़ाया। नवजात देखभाल की गुणवत्ता में सुधार हुआ।' },
          { years: '2020–23', note: 'Falls to 23 (confirmed 2023 SRS). Ayushman Bharat health & wellness centres expand last-mile access. SDG target of ≤12 by 2030 is within reach if current pace holds.', noteHi: '23 तक गिरा (2023 SRS पुष्टि)। Ayushman Bharat स्वास्थ्य एवं कल्याण केंद्र अंतिम मील पहुंच का विस्तार करते हैं। 2030 तक ≤12 का SDG लक्ष्य वर्तमान गति बनी रहने पर संभव है।' },
        ],
      },
      {
        label: 'Maternal Mortality Ratio (per 1,00,000 live births) · 2023–25: projected', unit: ' /1L', source: 'SRS Special Bulletin / RGI (2000–2022 official); 2023–25 WHO/MoHFW trend projections', yearLabel: '',
        data: [
          { year: 2000, value: 384 }, { year: 2002, value: 327 }, { year: 2004, value: 301 },
          { year: 2006, value: 254 }, { year: 2008, value: 212 }, { year: 2010, value: 178 },
          { year: 2012, value: 167 }, { year: 2014, value: 130 }, { year: 2016, value: 130 },
          { year: 2017, value: 122 }, { year: 2018, value: 113 }, { year: 2019, value: 103 },
          { year: 2020, value: 97  }, { year: 2021, value: 93  }, { year: 2022, value: 86  },
          { year: 2023, value: 80  }, { year: 2024, value: 75  }, { year: 2025, value: 70  },
        ],
        remarks: [
          { years: '★ 2023–25', note: 'Projected — SRS Special Bulletins are published with a 2–3 year lag; 2023, 2024 and 2025 values are WHO/MoHFW trend extrapolations from the confirmed 2020 figure (97) and 2022 provisional (86).', noteHi: 'अनुमानित — SRS विशेष बुलेटिन 2–3 वर्ष की देरी से प्रकाशित होते हैं; 2023, 2024 और 2025 के मान WHO/MoHFW प्रवृत्ति अनुमान हैं जो 2020 (97) और 2022 अस्थायी (86) आंकड़ों पर आधारित हैं।' },
          { years: '2000–05', note: 'MMR at 384 — one of the highest in Asia. Skilled birth attendance below 50%. Sepsis and haemorrhage dominate maternal deaths.', noteHi: 'MMR 384 पर — एशिया में सबसे उच्च में से एक। कुशल जन्म सहायता 50% से कम। मातृ मृत्यु में सेप्सिस और रक्तस्राव प्रमुख कारण हैं।' },
          { years: '2005–13', note: 'NRHM / JSY scheme drives institution deliveries from 39% (2005) to 80% (2014). MMR falls by more than half — from 254 to 130 in eight years.', noteHi: 'NRHM / JSY योजना ने संस्थागत प्रसव को 39% (2005) से 80% (2014) तक बढ़ाया। MMR आठ वर्षों में 254 से 130 तक आधा से अधिक गिरा।' },
          { years: '2014–20', note: 'Progress slows — southern states at MMR <40 while UP, Rajasthan, Assam remain above 150. PM Surakshit Matritva Abhiyan (2016) targets ANC gaps.', noteHi: 'प्रगति धीमी हुई — दक्षिणी राज्यों में MMR <40 जबकि यूपी, राजस्थान, असम 150 से ऊपर बने हुए हैं। PM Surakshit Matritva Abhiyan (2016) ANC अंतराल को लक्षित करता है।' },
          { years: '2021–22', note: 'MMR confirmed at 93 (2021) and ~86 (2022). If the projected 2025 figure of 70 holds, India will have met the SDG target (≤70 by 2030) five years early. LaQshya labour-room quality programme credited for late-stage gains.', noteHi: 'MMR 93 (2021) और लगभग 86 (2022) पर पुष्टि। यदि 2025 का अनुमानित आंकड़ा 70 सही रहता है, तो भारत SDG लक्ष्य (2030 तक ≤70) पांच साल पहले पूरा कर लेगा। LaQshya लेबर-रूम गुणवत्ता कार्यक्रम को अंतिम चरण की प्रगति के लिए श्रेय दिया जाता है।' },
        ],
      },
      {
        label: 'TB Incidence (cases per 1,00,000 population) · 2024–25: WHO projected', unit: ' /1L', source: 'WHO Global TB Report 2024 (official 2000–2023) · 2024–25 WHO/MoHFW projected estimates', yearLabel: '',
        data: [
          { year: 2000, value: 289 }, { year: 2002, value: 281 }, { year: 2004, value: 270 },
          { year: 2006, value: 261 }, { year: 2008, value: 253 }, { year: 2010, value: 249 },
          { year: 2012, value: 238 }, { year: 2014, value: 227 }, { year: 2016, value: 217 },
          { year: 2017, value: 204 }, { year: 2018, value: 199 }, { year: 2019, value: 193 },
          { year: 2020, value: 188 }, { year: 2021, value: 210 }, { year: 2022, value: 199 },
          { year: 2023, value: 195 }, { year: 2024, value: 187 }, { year: 2025, value: 178 },
        ],
        remarks: [
          { years: '★ 2024–25', note: 'Projected — WHO Global TB Report 2024 provides official figures through 2023; 2024–25 values are WHO/MoHFW modelled estimates.', noteHi: 'अनुमानित — WHO Global TB Report 2024 आधिकारिक आंकड़े 2023 तक प्रदान करता है; 2024–25 के मान WHO/MoHFW मॉडल अनुमान हैं।' },
          { years: '2000–15', note: 'Slow decline despite DOTS expansion. India accounts for ~27% of global TB burden — more than China and Pakistan combined. Drug-resistant strains emerging.', noteHi: 'DOTS विस्तार के बावजूद धीमी गिरावट। भारत वैश्विक टीबी बोझ का लगभग 27% हिस्सा है — जो चीन और पाकिस्तान से अधिक है। दवा-प्रतिरोधी स्ट्रेन उभर रहे हैं।' },
          { years: '2017', note: 'Government launches "TB Harega Desh Jeetega" — bold elimination target of <1 case per 1 lakh by 2025 (25 years ahead of global SDG target). Free diagnostics and nutrition support rolled out.', noteHi: 'सरकार ने "TB Harega Desh Jeetega" लॉन्च किया — 2025 तक <1 केस प्रति 1 लाख का साहसिक उन्मूलन लक्ष्य (वैश्विक SDG लक्ष्य से 25 साल पहले)। मुफ्त निदान और पोषण सहायता शुरू की गई।' },
          { years: '2021', note: 'COVID-19 disrupts TB services: incidence spikes to 210 as health systems diverted. Lockdowns limited testing; ~1.5 million cases estimated to have gone undetected in 2020.', noteHi: 'COVID-19 ने टीबी सेवाओं को बाधित किया: स्वास्थ्य प्रणाली के विचलित होने से घटनाएं 210 तक बढ़ीं। लॉकडाउन ने परीक्षण सीमित किया; 2020 में लगभग 1.5 मिलियन मामले अनदेखे रहे।' },
          { years: '2022–23', note: 'Recovery — confirmed incidence at 199 (2022) and 195 (2023). Elimination target of <1/lakh by 2025 will be missed by a wide margin. WHO projects elimination for India around 2040–45 at current pace.', noteHi: 'सुधार — पुष्टि की गई घटनाएं 199 (2022) और 195 (2023)। 2025 तक <1/लाख का उन्मूलन लक्ष्य व्यापक रूप से चूक जाएगा। WHO वर्तमान गति पर भारत के लिए 2040–45 के आसपास उन्मूलन का अनुमान लगाता है।' },
        ],
      },
      {
        label: 'Child Malnutrition — Stunting & Wasting (Under-5, %)',
        unit: '%',
        source: 'NFHS-2 (1998-99) · NFHS-3 (2005-06) · NFHS-4 (2015-16) · NFHS-5 (2019-21) · IIPS / MoHFW',
        yearLabel: '',
        series: [
          { key: 'stunting', label: 'Stunting (height-for-age)', color: '#f59e0b' },
          { key: 'wasting',  label: 'Wasting (weight-for-height)', color: '#ef4444' },
        ],
        data: [
          { year: 1999, stunting: 51.0, wasting: 20.0 },
          { year: 2006, stunting: 48.0, wasting: 19.8 },
          { year: 2016, stunting: 38.4, wasting: 21.0 },
          { year: 2021, stunting: 35.5, wasting: 19.3 },
        ],
        remarks: [
          { years: '1999', note: 'Half of all Indian children under-5 are stunted — a hidden crisis embedded in poverty, poor sanitation, and maternal anaemia. Wasting at 20% exceeds the WHO emergency threshold of 15%.', noteHi: 'भारत के आधे से अधिक 5 वर्ष से कम उम्र के बच्चे कुपोषित हैं — गरीबी, खराब स्वच्छता और मातृ एनीमिया में छिपा संकट। 20% वेस्टिंग WHO आपातकालीन सीमा 15% से अधिक है।' },
          { years: '2006–16', note: 'Stunting declines but wasting barely moves. Midday Meal Scheme and ICDS expansion help, but quality and coverage remain uneven. Open defecation\'s link to malnutrition finally documented.', noteHi: 'स्टंटिंग में गिरावट आई है लेकिन वेस्टिंग लगभग स्थिर है। मिडडे मील योजना और ICDS विस्तार मदद करते हैं, लेकिन गुणवत्ता और कवरेज असमान हैं। खुले में शौच का कुपोषण से संबंध अंततः दस्तावेजीकृत हुआ।' },
          { years: '2021', note: 'NFHS-5 reveals stunting at 35.5% and wasting at 19.3% — both above global averages. India accounts for ~30% of the world\'s stunted children. Swachh Bharat (sanitation) and Poshan Abhiyaan (nutrition) yet to show population-level impact.', noteHi: 'NFHS-5 में स्टंटिंग 35.5% और वेस्टिंग 19.3% दर्ज की गई — दोनों वैश्विक औसत से ऊपर। भारत विश्व के लगभग 30% कुपोषित बच्चों का हिस्सा है। स्वच्छ भारत (स्वच्छता) और पोषण अभियान अभी तक जनसंख्या स्तर पर प्रभाव नहीं दिखा पाए हैं।' },
        ],
      },
      {
        label: 'Out-of-Pocket Health Expenditure (% of Current Health Expenditure) · 2023–25: est.', unit: '%', source: 'WHO Global Health Expenditure Database / NHA (MoHFW) through 2022 · 2023–25 provisional NHA estimates', yearLabel: '',
        data: [
          { year: 2000, value: 74.3 }, { year: 2002, value: 73.1 }, { year: 2004, value: 72.0 },
          { year: 2006, value: 70.8 }, { year: 2008, value: 68.5 }, { year: 2010, value: 64.9 },
          { year: 2012, value: 63.2 }, { year: 2014, value: 61.4 }, { year: 2016, value: 58.7 },
          { year: 2017, value: 54.8 }, { year: 2018, value: 51.6 }, { year: 2019, value: 50.0 },
          { year: 2020, value: 47.1 }, { year: 2021, value: 47.4 }, { year: 2022, value: 46.7 },
          { year: 2023, value: 46.0 }, { year: 2024, value: 45.2 }, { year: 2025, value: 44.5 },
        ],
        remarks: [
          { years: '2000', note: 'OOP at 74% — among the highest in the world. Nearly 63 million Indians pushed into poverty each year by healthcare costs (World Bank). Government health spending was under 1% of GDP.', noteHi: 'OOP 74% है — विश्व में सबसे अधिक में से एक। हर साल लगभग 63 मिलियन भारतीय स्वास्थ्य देखभाल लागतों के कारण गरीबी में धकेले जाते हैं (World Bank)। सरकारी स्वास्थ्य व्यय GDP का 1% से कम था।' },
          { years: '2008–14', note: 'RSBY (2008) brings hospitalisation cover to BPL families. State insurance schemes multiply. OOP edges down but slowly — most outpatient spending remains uncovered.', noteHi: 'RSBY (2008) ने BPL परिवारों को अस्पताल में भर्ती कवर दिया। राज्य बीमा योजनाएं बढ़ीं। OOP धीरे-धीरे कम हुआ — अधिकांश आउटपेशेंट खर्च कवर नहीं होता।' },
          { years: '2018', note: 'Ayushman Bharat PM-JAY launched — world\'s largest government health insurance (₹5 lakh/family/year for ~55 crore beneficiaries). OOP drops from 58.7% to 47.1% by 2020.', noteHi: 'Ayushman Bharat PM-JAY लॉन्च हुआ — विश्व का सबसे बड़ा सरकारी स्वास्थ्य बीमा (₹5 लाख/परिवार/वर्ष लगभग 55 करोड़ लाभार्थियों के लिए)। OOP 58.7% से 47.1% तक 2020 तक गिरा।' },
          { years: '2020–22', note: 'Pandemic strains household finances — OOP ticks up to 47.4% in 2021, then resumes decline to 46.7% (2022 confirmed). Compare: global average ~18%, China ~29%. India\'s public health spending at 2.1% of GDP remains below the 2.5% NHP target.', noteHi: 'महामारी ने घरेलू वित्तीय स्थिति को प्रभावित किया — OOP 2021 में 47.4% तक बढ़ा, फिर 2022 में 46.7% (पुष्टि) तक गिरा। तुलना करें: वैश्विक औसत ~18%, चीन ~29%। भारत का सार्वजनिक स्वास्थ्य व्यय 2.1% GDP पर है, जो 2.5% NHP लक्ष्य से कम है।' },
        ],
      },
      {
        label: 'NCD Share of Total Deaths (%) · Non-communicable diseases · 2022–25: est.',
        unit: '%', source: 'WHO Global Health Estimates 2024 (2000–2021 official) · 2022–25 WHO/ICMR projected estimates', yearLabel: '',
        yDomain: [0, 100],
        data: [
          { year: 2000, value: 53.0 }, { year: 2002, value: 54.0 }, { year: 2004, value: 55.0 },
          { year: 2006, value: 56.2 }, { year: 2008, value: 57.5 }, { year: 2010, value: 58.9 },
          { year: 2012, value: 60.3 }, { year: 2014, value: 61.6 }, { year: 2016, value: 63.4 },
          { year: 2018, value: 64.8 }, { year: 2019, value: 66.0 }, { year: 2020, value: 66.5 },
          { year: 2021, value: 67.0 }, { year: 2022, value: 67.5 }, { year: 2023, value: 68.1 },
          { year: 2024, value: 68.6 }, { year: 2025, value: 69.0 },
        ],
        remarks: [
          { years: '★ 2022–25', note: 'Projected — WHO GHE 2024 provides official NCD shares through 2021; 2022–25 values are WHO/ICMR modelled trend extrapolations.', noteHi: 'अनुमानित — WHO GHE 2024 आधिकारिक NCD हिस्से 2021 तक प्रदान करता है; 2022–25 के मान WHO/ICMR मॉडल प्रवृत्ति अनुमान हैं।' },
          { years: '2000', note: 'NCDs account for 53% of all deaths — cardiovascular diseases lead (28%), followed by chronic respiratory diseases and cancer. Communicable diseases, maternal and nutritional deaths still claim 35% of lives, far above the global average.', noteHi: 'NCDs सभी मौतों का 53% हिस्सा हैं — हृदय रोग प्रमुख (28%), इसके बाद क्रॉनिक श्वसन रोग और कैंसर। संक्रामक रोग, मातृ और पोषण संबंधी मौतें अभी भी 35% जीवन लेती हैं, जो वैश्विक औसत से बहुत अधिक है।' },
          { years: '2005–16', note: 'Epidemiological transition accelerates. Urbanisation, sedentary lifestyles, processed food consumption, and tobacco use push CVD and diabetes mortality steadily upward. NCD share crosses 60% for the first time around 2012.', noteHi: 'महामारी विज्ञान संक्रमण तेज हुआ। शहरीकरण, निष्क्रिय जीवनशैली, प्रसंस्कृत खाद्य सेवन, और तंबाकू उपयोग से CVD और मधुमेह मृत्यु दर लगातार बढ़ी। NCD हिस्सा पहली बार लगभग 2012 में 60% पार किया।' },
          { years: '2019–21', note: 'NCD share reaches 67% — India\'s health system is now predominantly an NCD challenge, yet primary healthcare infrastructure remains oriented toward infectious disease. CVD alone accounts for ~28% of all deaths; diabetes-related deaths doubled since 2000.', noteHi: 'NCD हिस्सा 67% तक पहुंच गया — भारत की स्वास्थ्य प्रणाली अब मुख्य रूप से NCD चुनौती है, फिर भी प्राथमिक स्वास्थ्य देखभाल संरचना संक्रामक रोगों पर केंद्रित है। केवल CVD सभी मौतों का लगभग 28% हिस्सा है; मधुमेह से संबंधित मौतें 2000 से दोगुनी हुई हैं।' },
        ],
      },
      {
        label: 'Adult Overweight & Obesity (BMI ≥ 25, % of adults) · Men vs Women · 2022–25: est.',
        unit: '%', source: 'NFHS-2 (1998-99) · NFHS-3 (2005-06) · NFHS-4 (2015-16) · NFHS-5 (2019-21) · WHO NCD Country Profiles 2022–25 estimates', yearLabel: '',
        yDomain: [0, 50],
        series: [
          { key: 'women', label: 'Women', color: '#f59e0b' },
          { key: 'men',   label: 'Men',   color: '#3b82f6' },
        ],
        data: [
          { year: 1999, women: 10.6, men: 7.8 },
          { year: 2006, women: 12.6, men: 9.3 },
          { year: 2016, women: 20.6, men: 18.6 },
          { year: 2021, women: 24.0, men: 22.9 },
          { year: 2023, women: 26.5, men: 25.0 },
          { year: 2025, women: 28.5, men: 27.0 },
        ],
        remarks: [
          { years: '★ 2023–25', note: 'Estimated — NFHS is conducted every ~10 years; post-2021 values extrapolate NFHS-5 (2019-21) trends using WHO NCD Country Profiles and ICMR-INDIAB registry data.', noteHi: 'अनुमानित — NFHS लगभग हर 10 वर्षों में होता है; 2021 के बाद के मान NFHS-5 (2019-21) प्रवृत्तियों को WHO NCD कंट्री प्रोफाइल और ICMR-INDIAB रजिस्ट्री डेटा से बढ़ाकर निकाले गए हैं।' },
          { years: '1999–2006', note: 'NFHS-2 and NFHS-3: overweight/obesity rates are low but rising — 10.6% of women and 7.8% of men in 1999, edging up to 12.6% and 9.3% by 2006. Urban-rural gap is wide; urban women already at 25%+.', noteHi: 'NFHS-2 और NFHS-3: अधिक वजन/मोटापे की दरें कम लेकिन बढ़ रही हैं — 1999 में महिलाएं 10.6% और पुरुष 7.8%, 2006 तक बढ़कर 12.6% और 9.3%। शहरी-ग्रामीण अंतर व्यापक; शहरी महिलाएं पहले से ही 25%+ पर हैं।' },
          { years: '2006–16', note: 'NFHS-4 reveals a near-doubling in a decade — women jump from 12.6% to 20.6%, men from 9.3% to 18.6%. Rapid urbanisation, processed food penetration, and declining physical activity are key drivers.', noteHi: 'NFHS-4 में एक दशक में लगभग दोगुनी वृद्धि — महिलाएं 12.6% से 20.6% और पुरुष 9.3% से 18.6% तक बढ़े। तेज शहरीकरण, प्रसंस्कृत खाद्य का प्रसार, और शारीरिक गतिविधि में कमी मुख्य कारण हैं।' },
          { years: '2021–25', note: 'NFHS-5 confirms the trend: 24% of women and 22.9% of men are now overweight or obese. Combined with persistent undernutrition (35.5% stunting), India faces a "double burden of malnutrition" — the world\'s largest. Diabetes, hypertension, and NAFLD are direct downstream consequences.', noteHi: 'NFHS-5 ने प्रवृत्ति की पुष्टि की: अब 24% महिलाएं और 22.9% पुरुष अधिक वजन या मोटापे वाले हैं। लगातार कुपोषण (35.5% स्टंटिंग) के साथ, भारत "दोहरे पोषण बोझ" का सामना कर रहा है — विश्व का सबसे बड़ा। मधुमेह, उच्च रक्तचाप, और NAFLD इसके सीधे परिणाम हैं।' },
        ],
      },
      {
        label: 'Global Health Rank — HAQ Index · out of 195 countries · lower rank = better · 1995–2025: interpolated/est.',
        unit: '',
        source: 'GBD 2016 HAQ Index, Lancet May 2018 (confirmed anchors: 1990 rank 153, score 24.7; 2016 rank 145, score 41.2) · Intermediate years interpolated · 2017–25 estimated trend',
        yearLabel: '',
        invertAxis: true,
        yDomain: [0, 200],
        data: [
          { year: 1990, value: 153 }, { year: 1995, value: 152 }, { year: 2000, value: 153 },
          { year: 2005, value: 151 }, { year: 2010, value: 149 }, { year: 2012, value: 148 },
          { year: 2014, value: 147 }, { year: 2015, value: 146 }, { year: 2016, value: 145 },
          { year: 2017, value: 144 }, { year: 2018, value: 143 }, { year: 2019, value: 143 },
          { year: 2020, value: 142 }, { year: 2021, value: 141 }, { year: 2022, value: 140 },
          { year: 2023, value: 139 }, { year: 2024, value: 138 }, { year: 2025, value: 137 },
        ],
        remarks: [
          { years: '✓ 1990', note: 'Confirmed: India rank 153/195, HAQ score 24.7 — GBD 2016 HAQ Index (Lancet, May 2018). One of the lowest in Asia; high OOP burden, low public health spend (<0.8% GDP), and large rural–urban gaps.', noteHi: 'पुष्टि: भारत रैंक 153/195, HAQ स्कोर 24.7 — GBD 2016 HAQ इंडेक्स (Lancet, मई 2018)। एशिया में सबसे कम में से एक; उच्च OOP बोझ, कम सार्वजनिक स्वास्थ्य व्यय (<0.8% GDP), और बड़े ग्रामीण-शहरी अंतर।' },
          { years: '✓ 2016', note: 'Confirmed: India rank 145/195, HAQ score 41.2 — GBD 2016 HAQ Index (Lancet, May 2018). Despite a 16.5-point score gain since 1990, India still ranks below Bangladesh (132), Bhutan (134), and Sri Lanka (71). Goa/Kerala scored above 60; Assam/UP below 40.', noteHi: 'पुष्टि: भारत रैंक 145/195, HAQ स्कोर 41.2 — GBD 2016 HAQ इंडेक्स (Lancet, मई 2018)। 1990 से 16.5 अंक की वृद्धि के बावजूद, भारत अभी भी बांग्लादेश (132), भूटान (134), और श्रीलंका (71) से नीचे है। गोवा/केरल ने 60 से ऊपर स्कोर किया; असम/यूपी 40 से नीचे।' },
          { years: '2000–14', note: 'Interpolated — no official intermediate-year HAQ ranks published for India. Trend is consistent with NRHM (2005) gains on IMR/MMR driving score from ~24.7 (1990) toward 41.2 (2016). Actual intermediate ranks may vary.', noteHi: 'इंटरपोलेटेड — भारत के लिए कोई आधिकारिक मध्यवर्ती वर्ष HAQ रैंक प्रकाशित नहीं हुए। प्रवृत्ति NRHM (2005) के IMR/MMR सुधारों के अनुरूप है, जो स्कोर को लगभग 24.7 (1990) से 41.2 (2016) की ओर ले जाती है। वास्तविक मध्यवर्ती रैंक भिन्न हो सकते हैं।' },
          { years: '2017–25', note: 'Estimated — GBD 2019 HAQ Index (Lancet 2022) expanded the country set to 204, making rank numbers not directly comparable to the GBD 2016 series. Post-2016 values here extrapolate the confirmed 1990–2016 trend as a directional indicator only.', noteHi: 'अनुमानित — GBD 2019 HAQ इंडेक्स (Lancet 2022) ने देशों की संख्या 204 तक बढ़ाई, जिससे रैंक संख्याएं GBD 2016 श्रृंखला से सीधे तुलना योग्य नहीं हैं। 2016 के बाद के मान यहां 1990–2016 की पुष्टि की गई प्रवृत्ति का दिशात्मक संकेतक हैं।' },
        ],
      },
    ],
    stats: [
      {
        label: 'Maternal Mortality Ratio (SRS 2018-20)',
        value: '97 per lakh live births',
        note: 'Down from 130 (2014-16) and 384 (2000). Meets India\'s NHP target of <100 per lakh. SDG goal is ≤70 by 2030 — India\'s SRS 2021 provisional figure of ~93 suggests the target is within reach.',
        trend: 'up',
        source: 'SRS Special Bulletin on Maternal Mortality 2018-20, RGI; PIB MoHFW 2022',
      },
      {
        label: 'Infant Mortality Rate (SRS 2020)',
        value: '28 per 1,000 live births',
        note: 'Down from 68/1,000 in 2000 — India halved IMR in two decades. Rural IMR (31) remains higher than urban (19). Neonatal mortality (18/1,000) accounts for ~64% of infant deaths — critical first-week gap.',
        trend: 'up',
        source: 'SRS Statistical Report 2020, Registrar General of India',
      },
      {
        label: 'Child stunting under-5 (NFHS-5, 2019-21)',
        value: '35.5%',
        note: 'Improved from 38.4% (NFHS-4, 2015-16) but India accounts for ~30% of the world\'s stunted children. Wasting: 19.3% — above WHO emergency threshold of 15%. Underweight: 32.1%. Poshan Abhiyaan yet to show Census-scale impact.',
        trend: 'up',
        source: 'NFHS-5 (2019-21), International Institute for Population Sciences / MoHFW',
      },
      {
        label: 'Out-of-pocket share of total health spending (NHA 2021-22)',
        value: '46.7%',
        note: 'Down from 74.3% in 2000 but still 2.5× the global average (~18%) and more than triple China\'s (~15%). Pushes ~55 million Indians into poverty annually. PM-JAY covers hospitalisation for ~55 crore but outpatient costs remain uncovered.',
        trend: 'up',
        source: 'National Health Accounts 2021-22, MoHFW; WHO GHED 2024',
      },
    ],
  },
  {
    key: 'safety', label: 'Safety', score: SAFETY_SCORE, icon: ShieldCheck,
    summary: 'Crimes against women have risen every year since 2012, reaching 4.6 lakh registered cases in 2023 — yet just 1 in 4 rape accused is convicted. The conviction rate has flatlined at 26–32% for over a decade despite the Criminal Law Amendment Act (2013) and Fast Track Special Courts (2019), exposing deep failures in evidence, prosecution, and witness protection. Cybercrime registrations have grown 25× since 2012 to 86,400 in 2023, with the I4C portal logging ~15 lakh complaints separately — but charge-sheet rates remain below 30%. Underpinning all of this is a justice system under severe structural strain: 5.4 crore cases pending across all courts, 77% of prisoners unconvicted undertrials, and 25% of High Court judge posts vacant.',
    charts: [
      {
        label: 'Crimes Against Women — registered cases (thousands)', unit: 'k', source: 'NCRB Crime in India (annual reports) 2010–2023', yearLabel: '',
        data: [
          { year: 2010, value: 213.6 }, { year: 2011, value: 228.7 }, { year: 2012, value: 244.3 },
          { year: 2013, value: 309.5 }, { year: 2014, value: 337.9 }, { year: 2015, value: 329.2 },
          { year: 2016, value: 338.9 }, { year: 2017, value: 359.8 }, { year: 2018, value: 378.2 },
          { year: 2019, value: 405.9 }, { year: 2020, value: 371.5 }, { year: 2021, value: 428.3 },
          { year: 2022, value: 445.3 }, { year: 2023, value: 461.1 },
        ],
        remarks: [
          { years: '2012–13', note: 'Delhi gang rape (Dec 2012) triggers nationwide outrage. NCRB registrations surge 27% in 2013 — partly rising crime, partly improved reporting after Criminal Law Amendment Act 2013 widens definitions.', noteHi: 'दिल्ली गैंग रेप (दिसंबर 2012) ने पूरे देश में आक्रोश भड़काया। NCRB पंजीकरण 2013 में 27% बढ़े — आंशिक रूप से बढ़ती अपराध दर, आंशिक रूप से Criminal Law Amendment Act 2013 के बाद बेहतर रिपोर्टिंग के कारण।' },
          { years: '2014–19', note: 'Steady rise — cruelty by husband/relatives (~31%), assault on women (~22%), and kidnapping/abduction (~22%) dominate. Rape cases double from 2012 to 2019 (24,923 → 32,033).', noteHi: 'स्थिर वृद्धि — पति/रिश्तेदारों द्वारा क्रूरता (~31%), महिलाओं पर हमला (~22%), और अपहरण/गुमशुदगी (~22%) प्रमुख हैं। रेप मामलों में 2012 से 2019 तक दोगुनी वृद्धि (24,923 → 32,033) हुई।' },
          { years: '2020', note: 'COVID lockdowns show a temporary dip to 3.71 lakh — but NCRB cautions this reflects reporting difficulty, not actual decline. Domestic violence helpline calls spiked 3× during lockdowns (NCW data).', noteHi: 'COVID लॉकडाउन में अस्थायी गिरावट 3.71 लाख तक — लेकिन NCRB चेतावनी देता है कि यह रिपोर्टिंग कठिनाई को दर्शाता है, वास्तविक गिरावट नहीं। घरेलू हिंसा हेल्पलाइन कॉल लॉकडाउन के दौरान 3 गुना बढ़ीं (NCW डेटा)।' },
          { years: '2021–23', note: 'Registrations reach all-time highs. Uttar Pradesh, Rajasthan, Maharashtra account for ~43% of total. Conviction rate in rape cases: 27.4% (2022 NCRB) — meaning ~3 in 4 accused walk free.', noteHi: 'पंजीकरण सर्वकालिक उच्च स्तर पर पहुंच गए। उत्तर प्रदेश, राजस्थान, महाराष्ट्र कुल का लगभग 43% हिस्सा हैं। रेप मामलों में सजा दर: 27.4% (2022 NCRB) — मतलब लगभग 3 में से 4 आरोपी बरी हो जाते हैं।' },
        ],
      },
      {
        label: 'Rape Conviction Rate (%) — cases decided that year · 2023: est.', unit: '%', source: 'NCRB Crime in India annual reports 2012–2023 · 2023 provisional NCRB estimate', yearLabel: '',
        yDomain: [0, 100],
        data: [
          { year: 2012, value: 24.2 }, { year: 2013, value: 27.1 }, { year: 2014, value: 28.8 },
          { year: 2015, value: 29.2 }, { year: 2016, value: 25.5 }, { year: 2017, value: 32.2 },
          { year: 2018, value: 27.2 }, { year: 2019, value: 27.8 }, { year: 2020, value: 30.0 },
          { year: 2021, value: 28.6 }, { year: 2022, value: 27.4 }, { year: 2023, value: 26.5 },
        ],
        remarks: [
          { years: 'Metric', note: 'Conviction rate = convictions ÷ (convictions + acquittals + discharges) among cases decided in that calendar year — not the same year the FIR was filed. A low rate reflects judicial capacity gaps and evidentiary weaknesses, not just filing-to-outcome trends.', noteHi: 'सजा दर = सजा ÷ (सजा + बरी + रिहाई) उन मामलों में जो उस कैलेंडर वर्ष में निर्णयित हुए — FIR दर्ज होने वाले वर्ष से अलग। कम दर न्यायिक क्षमता की कमी और साक्ष्य कमजोरियों को दर्शाती है, केवल फाइलिंग से परिणाम तक के रुझान को नहीं।' },
          { years: '2012–13', note: 'Post-Nirbhaya, the Criminal Law Amendment Act 2013 widened the definition of rape and increased minimum sentencing. Registrations nearly doubled, but conviction infrastructure did not scale with it — courts inherited a backlog almost immediately.', noteHi: 'निर्भया के बाद, Criminal Law Amendment Act 2013 ने रेप की परिभाषा बढ़ाई और न्यूनतम सजा बढ़ाई। पंजीकरण लगभग दोगुने हुए, लेकिन सजा प्रणाली का विस्तार नहीं हुआ — अदालतों को तुरंत ही बैकलॉग मिला।' },
          { years: '2016', note: 'Rate dips to 25.5% — partly a reflection of an older case mix (cases decided in 2016 were filed years earlier) and the surge in FIRs post-2013 entering the trial pipeline. Acquittals and discharges outpace convictions.', noteHi: 'दर 25.5% तक गिर गई — आंशिक रूप से पुराने मामले के मिश्रण (2016 में निर्णयित मामले वर्षों पहले दर्ज हुए थे) और 2013 के बाद FIR में वृद्धि के कारण। बरी और रिहाई सजा से अधिक हैं।' },
          { years: '2017–23', note: 'Rate oscillates in a narrow 26–32% band despite Fast Track Special Courts (FTSCs) introduced in 2019 for rape and POCSO cases. By 2023, ~1.8 lakh rape cases remain pending trial. 3 in 4 accused are ultimately acquitted or discharged.', noteHi: 'दर 26–32% के संकरे दायरे में उतार-चढ़ाव करती है, जबकि 2019 में रेप और POCSO मामलों के लिए Fast Track Special Courts (FTSCs) शुरू किए गए। 2023 तक लगभग 1.8 लाख रेप मामले परीक्षण के लिए लंबित हैं। 4 में से 3 आरोपी अंततः बरी या रिहा हो जाते हैं।' },
        ],
      },
      {
        label: 'Cybercrime — NCRB Registered Cases (thousands)', unit: 'k', source: 'NCRB Crime in India annual reports 2012–2023',
        yearLabel: '',
        data: [
          { year: 2012, value: 3.5  }, { year: 2013, value: 5.7  }, { year: 2014, value: 9.6  },
          { year: 2015, value: 11.6 }, { year: 2016, value: 12.3 }, { year: 2017, value: 21.8 },
          { year: 2018, value: 27.2 }, { year: 2019, value: 44.5 }, { year: 2020, value: 50.0 },
          { year: 2021, value: 52.9 }, { year: 2022, value: 65.9 }, { year: 2023, value: 86.4 },
        ],
        remarks: [
          { years: 'Metric', note: 'Figures are NCRB cognizable cybercrime cases (IPC + IT Act) registered by police across India — distinct from the I4C National Cybercrime Reporting Portal (NCRP) complaint count, which is far higher (~15 lakh complaints in 2023) but does not equate to registered FIRs.', noteHi: 'आंकड़े NCRB के संज्ञानात्मक साइबरक्राइम मामलों (IPC + IT Act) के हैं जो भारत भर में पुलिस द्वारा दर्ज किए गए — जो I4C National Cybercrime Reporting Portal (NCRP) की शिकायत संख्या से अलग हैं, जो कहीं अधिक (~15 लाख शिकायतें 2023 में) है लेकिन पंजीकृत FIR के बराबर नहीं है।' },
          { years: '2012–16', note: 'Early cybercrime era — mostly phishing and IT Act Sec 66A cases (SC struck down 66A in 2015). Registration infrastructure thin; most police stations lacked digital forensics capability.', noteHi: 'प्रारंभिक साइबर अपराध युग — मुख्यतः फिशिंग और IT Act Sec 66A के मामले (SC ने 2015 में 66A को रद्द किया)। पंजीकरण अवसंरचना कमजोर; अधिकांश पुलिस थानों में डिजिटल फोरेंसिक क्षमता नहीं थी।  ' },
          { years: '2017–19', note: 'UPI and digital payments adoption accelerates cybercrime — financial fraud becomes the dominant category. NCRB registered cases more than double in two years to 44,500.', noteHi: 'UPI और डिजिटल भुगतान के अपनाने से साइबर अपराध में तेजी — वित्तीय धोखाधड़ी प्रमुख श्रेणी बन गई। NCRB में दर्ज मामले दो वर्षों में दोगुने से अधिक होकर 44,500 हो गए।  ' },
          { years: '2020–22', note: 'COVID online migration + work-from-home expands the attack surface. Vishing, KYC scams, and OTP fraud proliferate. Only ~27% of registered cyber cases result in charge-sheets (NCRB 2022).', noteHi: 'COVID के कारण ऑनलाइन माइग्रेशन और वर्क-फ्रॉम-होम से हमले की सतह बढ़ी। विशिंग, KYC घोटाले, और OTP धोखाधड़ी फैल गई। केवल लगभग 27% दर्ज साइबर मामलों में चार्जशीट होती है (NCRB 2022)।  ' },
          { years: '2023', note: 'NCRB Crime in India 2023 records 86,400 registered cybercrime cases — a 31% jump over 2022 as digital-fraud syndicates scale up. Separately, I4C NCRP received ~15 lakh complaints in 2023 (not FIRs). Charge-sheet rate for cybercrime cases remains below 30%.', noteHi: 'NCRB Crime in India 2023 में 86,400 दर्ज साइबर अपराध मामले दर्ज हैं — 2022 की तुलना में 31% की वृद्धि क्योंकि डिजिटल धोखाधड़ी सिंडिकेट्स बढ़ रहे हैं। अलग से, I4C NCRP को 2023 में लगभग 15 लाख शिकायतें मिलीं (FIR नहीं)। साइबर अपराध मामलों में चार्जशीट दर 30% से कम बनी हुई है।  ' },
        ],
      },
      {
        label: 'Judicial Pendency — Cases Pending in all Courts (crore) · 2025: est.', unit: ' cr', source: 'National Judicial Data Grid (NJDG) / Supreme Court of India (2010–2024) · 2025 provisional NJDG estimate', yearLabel: '',
        data: [
          { year: 2010, value: 3.10 }, { year: 2012, value: 3.29 }, { year: 2014, value: 3.53 },
          { year: 2016, value: 3.81 }, { year: 2018, value: 3.88 }, { year: 2019, value: 4.13 },
          { year: 2020, value: 4.43 }, { year: 2021, value: 4.65 }, { year: 2022, value: 5.02 },
          { year: 2023, value: 5.10 }, { year: 2024, value: 5.25 }, { year: 2025, value: 5.42 },
        ],
        remarks: [
          { years: '★ 2025', note: 'Provisional estimate — NJDG publishes live court-level data; 2025 figure is a mid-year snapshot extrapolation.', noteHi: 'अस्थायी अनुमान — NJDG लाइव कोर्ट-स्तरीय डेटा प्रकाशित करता है; 2025 का आंकड़ा मध्य-वर्ष स्नैपशॉट अनुमान है।  ' },
          { years: '2010–16', note: 'Pendency rises from 3.1 to 3.8 crore — institution-disposal gap persistent. Judge-to-population ratio at 21 per million (vs. USA 107, UK 51). Law Commission recommended 50 per million in 2014.', noteHi: 'लंबित मामले 3.1 करोड़ से बढ़कर 3.8 करोड़ हो गए — संस्थान-निपटान अंतर बना हुआ है। न्यायाधीश-से-जनसंख्या अनुपात 21 प्रति मिलियन है (USA में 107, UK में 51)। 2014 में Law Commission ने 50 प्रति मिलियन की सिफारिश की थी।  ' },
          { years: '2018–20', note: 'COVID further widens gap: courts suspended for months in 2020; pendency crosses 4.43 crore. e-Courts phase II and video hearings introduced to partially compensate.', noteHi: 'COVID ने अंतर और बढ़ाया: 2020 में अदालतें महीनों के लिए बंद रहीं; लंबित मामले 4.43 करोड़ पार कर गए। आंशिक रूप से क्षतिपूर्ति के लिए e-Courts फेज II और वीडियो सुनवाई शुरू की गई।  ' },
          { years: '2021–22', note: 'Post-COVID backlog peaks at 5.02 crore. ~77% of prisoners are undertrials (not yet convicted) — the highest proportion globally. Average undertrial detention exceeds 2.5 years.', noteHi: 'पोस्ट-COVID बैकलॉग 5.02 करोड़ पर पहुंच गया। लगभग 77% कैदी अंडरट्रायल हैं (अभी तक दोषी नहीं ठहराए गए) — यह वैश्विक स्तर पर सबसे अधिक अनुपात है। औसत अंडरट्रायल हिरासत 2.5 वर्ष से अधिक है।  ' },
          { years: '2023–24', note: 'Reaches 5.25 crore (2024 confirmed NJDG). 25% of judge posts vacant in High Courts. At current disposal rate, clearing the backlog would take 300+ years (DAKSH analysis 2023).', noteHi: 'यह 5.25 करोड़ तक पहुंच गया (2024 में NJDG द्वारा पुष्टि)। हाई कोर्ट में 25% न्यायाधीश पद खाली हैं। वर्तमान निपटान दर पर, बैकलॉग साफ करने में 300+ वर्ष लगेंगे (DAKSH विश्लेषण 2023)।  ' },
        ],
      },
    ],
    stats: [
      {
        label: 'High Court judge vacancies (as of 1 Aug 2024)',
        value: '357 of 1,114 posts vacant (32%)',
        note: 'Law Ministry confirmed 357 vacancies against sanctioned strength of 1,114 HC judges. 219 collegium proposals under process. Vacancies directly worsen pendency: over 62 lakh cases pending in High Courts alone.',
        trend: 'down',
        source: 'Law Ministry statement in Rajya Sabha; GoI HC Vacancy Statement dated 01.08.2024',
      },
      {
        label: 'Undertrial prisoners as % of total prison population (NCRB 2023)',
        value: '~77% of 5.54 lakh prisoners',
        note: 'Over 4.2 lakh of India\'s 5.54 lakh prisoners are awaiting trial — not yet convicted. Average undertrial detention exceeds 2.5 years. India\'s undertrial share is among the highest globally.',
        trend: 'down',
        source: 'NCRB Prison Statistics India 2023 (PSI-2023)',
      },
      {
        label: 'Cases pending across all courts (NJDG, 2024)',
        value: '5.25 crore',
        note: 'As of end-2024: 4.4 crore in district courts, 62 lakh in High Courts, ~82,000 in the Supreme Court. At current disposal rates, DAKSH analysis (2023) estimates clearing the backlog would take 300+ years.',
        trend: 'down',
        source: 'National Judicial Data Grid (NJDG), Supreme Court of India — 2024 confirmed snapshot',
      },
    ],
  },
  {
    key: 'environment', label: 'Environment', score: ENVIRONMENT_SCORE, icon: Leaf,
    summary: 'India\'s renewable energy push is real — solar grew from under 1 GW in 2010 to 106 GW by March 2025, total RE crossing 220 GW (MNRE FY2024-25). But every other environmental indicator is deteriorating or stagnant. CO₂ emissions have nearly tripled since 2000 to ~3 GT in 2023, making India the world\'s third-largest emitter; coal consumption hit an all-time high in FY24 even as renewables scaled. Air quality is a public health emergency: Delhi at 91 µg/m³ PM2.5 is 18× the WHO guideline. Polluted river stretches have grown from 121 in 2011 to 328 in 2022 — India\'s STP capacity treats only 37% of urban sewage generated, with the Ganga basin the worst affected. Groundwater extraction at 251 BCM a year exceeds the US and China combined; Punjab draws 166% of annual recharge and faces aquifer collapse within two decades. Forest cover is effectively flat at 21.76%, centuries from the 33% national target, with plantation numbers masking the loss of dense natural forest.',
    charts: [
      {
        label: 'Renewable Energy Installed Capacity (GW) — Solar, Wind & Other RE · 2025: provisional', unit: ' GW',
        source: 'MNRE Annual Reports · CEA / MoP (2010–2024 official) · 2025 provisional MNRE data',
        series: [
          { key: 'solar', label: 'Solar',    color: '#f59e0b' },
          { key: 'wind',  label: 'Wind',     color: '#3b82f6' },
          { key: 'other', label: 'Other RE', color: '#22c55e' },
        ],
        data: [
          { year: 2010, solar: 0.01, wind: 13.1, other: 22.4 },
          { year: 2011, solar: 0.46, wind: 16.1, other: 23.5 },
          { year: 2012, solar: 1.05, wind: 18.4, other: 24.3 },
          { year: 2013, solar: 2.21, wind: 21.2, other: 25.0 },
          { year: 2014, solar: 3.74, wind: 22.5, other: 25.9 },
          { year: 2015, solar: 5.05, wind: 25.1, other: 26.9 },
          { year: 2016, solar: 9.01, wind: 28.7, other: 27.9 },
          { year: 2017, solar: 12.3, wind: 32.8, other: 28.8 },
          { year: 2018, solar: 22.0, wind: 35.0, other: 29.7 },
          { year: 2019, solar: 30.1, wind: 37.7, other: 30.0 },
          { year: 2020, solar: 38.1, wind: 38.6, other: 31.2 },
          { year: 2021, solar: 49.3, wind: 40.1, other: 32.0 },
          { year: 2022, solar: 62.8, wind: 42.6, other: 33.1 },
          { year: 2023, solar: 73.3, wind: 44.7, other: 34.8 },
          { year: 2024, solar: 90.8, wind: 47.4, other: 36.0 },
          { year: 2025, solar: 106.0, wind: 51.2, other: 37.5 },
        ],
        remarks: [
          { years: '2010–14', note: 'Wind dominates early; solar negligible at <1 GW. Jawaharlal Nehru National Solar Mission (JNNSM, 2010) sets 20 GW target by 2022 — initially ridiculed as over-ambitious.', noteHi: 'प्रारंभ में पवन ऊर्जा प्रमुख; सौर ऊर्जा नगण्य <1 GW। Jawaharlal Nehru National Solar Mission (JNNSM, 2010) ने 2022 तक 20 GW का लक्ष्य रखा — शुरू में इसे अत्यधिक महत्वाकांक्षी कहा गया।  ' },
          { years: '2015–17', note: 'Solar cost crash changes everything. India revises the 2022 solar target to 100 GW. Tariffs fall from ₹17/unit (2010) to ₹3.15/unit (2017) — a 81% collapse in seven years.', noteHi: 'सौर ऊर्जा की लागत में भारी गिरावट ने सब कुछ बदल दिया। भारत ने 2022 के सौर लक्ष्य को 100 GW कर दिया। टैरिफ ₹17/यूनिट (2010) से ₹3.15/यूनिट (2017) तक गिरा — सात वर्षों में 81% की गिरावट।  ' },
          { years: '2020–22', note: 'India surpasses 100 GW total RE milestone in 2021. PM announces 500 GW RE target by 2030. Solar addition rate triples — driven by utility-scale parks in Rajasthan, Gujarat, Andhra Pradesh.', noteHi: 'भारत ने 2021 में 100 GW कुल RE मील का पत्थर पार किया। प्रधानमंत्री ने 2030 तक 500 GW RE लक्ष्य घोषित किया। सौर ऊर्जा की वृद्धि दर तीन गुना हो गई — राजस्थान, गुजरात, आंध्र प्रदेश में यूटिलिटी-स्केल पार्कों द्वारा संचालित।  ' },
          { years: '2024–25', note: 'RE total crosses 220 GW. Solar alone at 106 GW by March 2025 (MNRE FY2024-25 press release); wind crosses 50 GW milestone. 30 GW added in FY25 — a record single-year addition. The 500 GW 2030 target requires doubling again — ambitious but plausible if grid infrastructure keeps pace.', noteHi: 'कुल RE 220 GW पार कर गया। मार्च 2025 तक सौर ऊर्जा अकेले 106 GW (MNRE FY2024-25 प्रेस रिलीज); पवन ऊर्जा 50 GW मील का पत्थर पार कर गई। FY25 में 30 GW जोड़ा गया — एक रिकॉर्ड एकल-वर्षीय वृद्धि। 2030 का 500 GW लक्ष्य फिर से दोगुना करना होगा — महत्वाकांक्षी लेकिन संभव यदि ग्रिड अवसंरचना साथ दे।  ' },
        ],
      },
      {
        label: 'PM2.5 Annual Mean — Major Cities (µg/m³)', unit: ' µg/m³',
        source: 'CPCB NAQI stations · IQAir World Air Quality Report (2018–2025) · WHO guideline: 5 µg/m³',
        yearLabel: '',
        series: [
          { key: 'delhi',   label: 'Delhi',   color: '#ef4444' },
          { key: 'mumbai',  label: 'Mumbai',  color: '#f97316' },
          { key: 'kolkata', label: 'Kolkata', color: '#a855f7' },
          { key: 'chennai', label: 'Chennai', color: '#3b82f6' },
        ],
        data: [
          { year: 2018, delhi: 113, mumbai: 63,  kolkata: 59,  chennai: 36 },
          { year: 2019, delhi: 98,  mumbai: 58,  kolkata: 56,  chennai: 33 },
          { year: 2020, delhi: 84,  mumbai: 46,  kolkata: 44,  chennai: 28 },
          { year: 2021, delhi: 96,  mumbai: 55,  kolkata: 52,  chennai: 31 },
          { year: 2022, delhi: 92,  mumbai: 53,  kolkata: 50,  chennai: 29 },
          { year: 2023, delhi: 92,  mumbai: 53,  kolkata: 49,  chennai: 29 },
          { year: 2024, delhi: 91,  mumbai: 51,  kolkata: 48,  chennai: 28 },
          { year: 2025, delhi: 89,  mumbai: 49,  kolkata: 46,  chennai: 27 },
        ],
        remarks: [
          { years: 'WHO line', note: 'WHO annual PM2.5 guideline is 5 µg/m³. All four cities shown exceed this by 5×–18×. Even Chennai, India\'s cleanest major metro, is more than 5× above the WHO standard.', noteHi: 'WHO वार्षिक PM2.5 गाइडलाइन 5 µg/m³ है। दिखाए गए सभी चार शहर इस मानक से 5×–18× अधिक प्रदूषित हैं। यहां तक कि चेन्नई, भारत का सबसे स्वच्छ बड़ा मेट्रो, WHO मानक से 5× से अधिक प्रदूषित है।  ' },
          { years: '2020', note: 'COVID lockdowns produce the clearest air India has seen in decades — Delhi drops to 84 µg/m³ and Mumbaikars could see the Himalayas. Confirms vehicles and industry as primary contributors.', noteHi: 'COVID लॉकडाउन ने दशकों में भारत की सबसे साफ हवा दी — दिल्ली का PM2.5 स्तर 84 µg/m³ तक गिरा और मुंबईवासियों को हिमालय दिखाई दिया। यह वाहन और उद्योग को मुख्य प्रदूषक के रूप में पुष्टि करता है।  ' },
          { years: '2021', note: 'Post-lockdown rebound — Delhi spikes back to 96. Stubble burning, vehicles, construction, and coal power combine; no structural source reduction achieved.', noteHi: 'लॉकडाउन के बाद पुनरुद्धार — दिल्ली फिर से 96 µg/m³ तक पहुंच गया। पराली जलाना, वाहन, निर्माण, और कोयला बिजली संयंत्र मिलकर प्रदूषण बढ़ाते हैं; कोई संरचनात्मक स्रोत कमी नहीं हुई।  ' },
          { years: '2022–25', note: 'Delhi stabilises near 90 despite GRAP (Graded Response Action Plan), odd-even schemes, and NCR industrial closures. Marginal improvements do not change the fundamental health toll: particulate pollution shortens average Delhi life expectancy by ~12 years (Energy Policy Institute, UChicago).', noteHi: 'दिल्ली GRAP (Graded Response Action Plan), ऑड-ईवन योजना, और NCR औद्योगिक बंद के बावजूद लगभग 90 µg/m³ पर स्थिर है। मामूली सुधार स्वास्थ्य प्रभाव को नहीं बदलते: पार्टिकुलेट प्रदूषण दिल्ली की औसत जीवन प्रत्याशा को लगभग 12 वर्ष कम करता है (Energy Policy Institute, UChicago)।  ' },
        ],
      },
      {
        label: 'Forest Cover (% of total geographic area) · 2025: FSI provisional estimate', unit: '%', source: 'India State of Forest Report (ISFR) / Forest Survey of India (FSI) biennial assessments through ISFR 2023 · 2025 provisional', yearLabel: '',
        data: [
          { year: 2001, value: 20.55 }, { year: 2003, value: 20.64 }, { year: 2005, value: 20.60 },
          { year: 2007, value: 20.60 }, { year: 2009, value: 21.02 }, { year: 2011, value: 21.05 },
          { year: 2013, value: 21.23 }, { year: 2015, value: 21.34 }, { year: 2017, value: 21.54 },
          { year: 2019, value: 21.67 }, { year: 2021, value: 21.71 }, { year: 2023, value: 21.76 },
          { year: 2025, value: 21.82 },
        ],
        remarks: [
          { years: '★ 2025', note: 'Provisional estimate — ISFR is published biennially; the next official assessment is ISFR 2025, expected late 2025/early 2026. The 21.82% figure extrapolates ISFR 2023 trend.', noteHi: 'अस्थायी अनुमान — ISFR द्विवार्षिक प्रकाशित होता है; अगला आधिकारिक मूल्यांकन ISFR 2025 होगा, जो 2025 के अंत या 2026 की शुरुआत में अपेक्षित है। 21.82% आंकड़ा ISFR 2023 प्रवृत्ति का अनुमान है।  ' },
          { years: 'Context', note: 'National Forest Policy 1988 mandates 33% forest/tree cover. India is at 21.76% (ISFR 2023) — plantations move the headline number, but dense natural forest (Very Dense Forest) remains largely flat at ~2.8%.', noteHi: 'राष्ट्रीय वन नीति 1988 में 33% वन/वृक्ष आवरण अनिवार्य है। भारत 21.76% पर है (ISFR 2023) — वृक्षारोपण मुख्य संख्या बढ़ाते हैं, लेकिन घना प्राकृतिक वन (Very Dense Forest) लगभग स्थिर ~2.8% पर है।  ' },
          { years: '2001–09', note: 'Modest decline in natural forest offset by plantation expansion — the headline rises while old-growth cover shrinks. Compensatory Afforestation Fund (CAMPA) poorly monitored; trees planted, not forests grown.', noteHi: 'प्राकृतिक वन में मामूली गिरावट वृक्षारोपण विस्तार से संतुलित होती है — मुख्य संख्या बढ़ती है जबकि पुराना वन आवरण घटता है। Compensatory Afforestation Fund (CAMPA) की निगरानी कमजोर है; वृक्ष लगाए जाते हैं, वन नहीं उगाए जाते।  ' },
          { years: '2015–21', note: 'Agroforestry inclusion in FSI methodology inflates tree cover numbers. Satellite data shows northeast India — with 65%+ cover — losing dense canopy to jhum and hydropower projects.', noteHi: 'FSI पद्धति में Agroforestry शामिल करने से वृक्ष आवरण के आंकड़े बढ़ जाते हैं। उपग्रह डेटा दिखाता है कि पूर्वोत्तर भारत — जहां 65%+ आवरण है — जुम और जलविद्युत परियोजनाओं के कारण घने कूप को खो रहा है।  ' },
          { years: '2021–23', note: 'Incremental gains of 0.05 pp in two years (21.71% → 21.76%). At this rate, reaching the 33% target would take 250+ years. Northeastern states and Uttarakhand see real loss; Kerala records gains after flood-year recovery planting.', noteHi: 'दो वर्षों में 0.05 प्रतिशत अंक की मामूली वृद्धि (21.71% → 21.76%)। इस दर से 33% लक्ष्य तक पहुंचने में 250+ वर्ष लगेंगे। पूर्वोत्तर राज्य और उत्तराखंड में वास्तविक कमी; केरल में बाढ़ के बाद पुनः वृक्षारोपण से वृद्धि दर्ज हुई।  ' },
        ],
      },
      {
        label: 'Groundwater — Annual Extraction vs Exploitable Recharge (BCM) · 2023–25: est.',
        unit: ' BCM', source: 'Central Ground Water Board (CGWB) National Compilations 2004–2022 · 2023–25 CGWB trend estimates · BCM = billion cubic metres',
        yearLabel: '',
        series: [
          { key: 'extraction', label: 'Annual Extraction', color: '#ef4444' },
          { key: 'recharge',   label: 'Exploitable Recharge', color: '#3b82f6' },
        ],
        data: [
          { year: 2004, extraction: 231, recharge: 398 },
          { year: 2009, extraction: 243, recharge: 396 },
          { year: 2011, extraction: 245, recharge: 393 },
          { year: 2013, extraction: 248, recharge: 396 },
          { year: 2017, extraction: 249, recharge: 399 },
          { year: 2020, extraction: 244, recharge: 398 },
          { year: 2022, extraction: 251, recharge: 398 },
          { year: 2023, extraction: 254, recharge: 397 },
          { year: 2024, extraction: 256, recharge: 396 },
          { year: 2025, extraction: 258, recharge: 395 },
        ],
        remarks: [
          { years: '★ 2023–25', note: 'Estimated — CGWB compilations are published with a 2–3 year lag. 2023–25 values extrapolate the CGWB 2022 baseline using agricultural demand growth and monsoon recharge trend data.', noteHi: 'अनुमानित — CGWB संकलन 2–3 वर्ष की देरी से प्रकाशित होते हैं। 2023–25 के मान CGWB 2022 आधाररेखा को कृषि मांग वृद्धि और मानसून पुनर्भरण प्रवृत्ति डेटा से अनुमानित हैं।  ' },
          { years: 'Scale', note: 'India extracts ~251 BCM of groundwater annually — more than the USA and China combined, accounting for ~25% of global groundwater use. Agriculture drives ~90% of extraction (irrigation). The national headline looks sustainable, but averages mask severe regional stress.', noteHi: 'भारत वार्षिक लगभग 251 BCM भूजल निकालता है — जो USA और चीन के संयुक्त उपयोग से अधिक है, और वैश्विक भूजल उपयोग का लगभग 25% है। कृषि लगभग 90% निकासी (सिंचाई) का कारण है। राष्ट्रीय आंकड़ा स्थिर दिखता है, लेकिन औसत गंभीर क्षेत्रीय तनाव छुपाते हैं।  ' },
          { years: '2004–17', note: 'Extraction grows steadily as Green Revolution crop patterns (paddy, wheat) lock in groundwater dependence. CGWB 2017 finds 1,186 of 6,881 assessment units "overexploited" (17.2%) — concentrated in Punjab, Haryana, western Rajasthan, and parts of Tamil Nadu and Karnataka.', noteHi: 'निकासी लगातार बढ़ रही है क्योंकि ग्रीन रिवोल्यूशन की फसल पैटर्न (धान, गेहूं) भूजल निर्भरता को स्थिर कर देते हैं। CGWB 2017 ने 6,881 मूल्यांकन इकाइयों में से 1,186 को "अत्यधिक शोषित" (17.2%) पाया — पंजाब, हरियाणा, पश्चिमी राजस्थान, और तमिलनाडु तथा कर्नाटक के कुछ हिस्सों में केंद्रित।  ' },
          { years: '2022', note: 'CGWB 2022: 1,115 of 7,089 units overexploited (15.7%). Punjab extracts 166% of its annual recharge — aquifers are physically running dry. At current depletion rates, North India\'s breadbasket faces an agricultural water crisis within 15–20 years (World Bank). Jal Shakti Mission launched 2019 targets recharge but monitoring coverage remains thin.', noteHi: 'CGWB 2022: 7,089 इकाइयों में से 1,115 अत्यधिक शोषित (15.7%)। पंजाब अपनी वार्षिक पुनर्भरण का 166% निकाल रहा है — जलभृत सूख रहे हैं। वर्तमान क्षय दर पर, उत्तर भारत का अन्न भंडार 15–20 वर्षों में कृषि जल संकट का सामना करेगा (World Bank)। जल शक्ति मिशन 2019 में शुरू हुआ, पुनर्भरण पर केंद्रित है लेकिन निगरानी कवरेज कमजोर है।  ' },
        ],
      },
      {
        label: 'CPCB Polluted River Stretches — count of stretches classified critically/severely/moderately polluted',
        unit: '', source: 'CPCB Pollution Assessment Reports (2011–2022) · CPCB river monitoring data classified by BOD threshold exceedance', yearLabel: '',
        data: [
          { year: 2011, value: 121 }, { year: 2013, value: 194 },
          { year: 2015, value: 275 }, { year: 2016, value: 302 },
          { year: 2018, value: 351 }, { year: 2020, value: 311 },
          { year: 2022, value: 328 },
        ],
        remarks: [
          { years: 'Metric', note: 'A river stretch is classified "polluted" when BOD exceeds 3 mg/L (CPCB standard). "Critically polluted" = BOD > 6 mg/L. The count covers rivers across all states; a single river can have multiple polluted stretches.', noteHi: 'एक नदी खंड "प्रदूषित" तब माना जाता है जब BOD 3 mg/L से अधिक हो (CPCB मानक)। "गंभीर रूप से प्रदूषित" = BOD > 6 mg/L। यह गणना सभी राज्यों की नदियों को कवर करती है; एक नदी में कई प्रदूषित खंड हो सकते हैं।  ' },
          { years: '2011–18', note: 'Polluted stretches nearly triple from 121 to 351 — driven by population growth, rapid urbanisation, and woefully inadequate sewage treatment capacity. India\'s installed STP capacity treats only ~37% of the 72,368 MLD of urban sewage generated (CPCB 2021).', noteHi: 'प्रदूषित खंड लगभग तीन गुना बढ़कर 121 से 351 हो गए — जनसंख्या वृद्धि, तीव्र शहरीकरण, और अपूर्ण सीवेज उपचार क्षमता के कारण। भारत की स्थापित STP क्षमता केवल लगभग 37% शहरी सीवेज का उपचार करती है (CPCB 2021)।  ' },
          { years: '2018', note: 'Peak recorded at 351 polluted stretches across 323 rivers. Ganga basin dominates — UP alone contributes ~30% of total river pollution load. Yamuna through Delhi is effectively an open drain: BOD peaks at 70+ mg/L near Okhla during dry season.', noteHi: '351 प्रदूषित खंड 323 नदियों में रिकॉर्ड किए गए। गंगा बेसिन प्रमुख है — केवल यूपी कुल नदी प्रदूषण भार का लगभग 30% योगदान देता है। दिल्ली से होकर गुजरने वाली यमुना प्रभावी रूप से खुला नाला है: सूखे मौसम में ओखला के पास BOD 70+ mg/L तक पहुंच जाता है।  ' },
          { years: '2020–22', note: 'Slight improvement to 328 — partly reflecting COVID industrial shutdowns in 2020 and Namami Gange STP construction. However, CPCB cautions that monitoring coverage varies year to year, making strict YoY comparison difficult. Untreated sewage remains the dominant pollutant in 80%+ of polluted stretches.', noteHi: 'मामूली सुधार से 328 प्रदूषित खंड हुए — आंशिक रूप से 2020 के COVID औद्योगिक बंद और नमामि गंगे STP निर्माण के कारण। हालांकि, CPCB चेतावनी देता है कि निगरानी कवरेज वर्ष-दर-वर्ष भिन्न होती है, जिससे सख्त तुलना कठिन होती है। अपूर्ण सीवेज 80%+ प्रदूषित खंडों में प्रमुख प्रदूषक बना हुआ है।  ' },
        ],
      },
      {
        label: 'CO₂ Emissions (GT/year) · 2023–25: IEA provisional estimates',
        unit: ' GT', source: 'IEA CO₂ Emissions from Fuel Combustion / Global Carbon Project (2000–2022 official) · 2023–25 IEA/GCP provisional estimates', yearLabel: '',
        data: [
          { year: 2000, value: 1.19 }, { year: 2002, value: 1.23 }, { year: 2004, value: 1.30 },
          { year: 2006, value: 1.42 }, { year: 2008, value: 1.58 }, { year: 2010, value: 1.78 },
          { year: 2012, value: 2.01 }, { year: 2014, value: 2.24 }, { year: 2016, value: 2.31 },
          { year: 2017, value: 2.44 }, { year: 2018, value: 2.62 }, { year: 2019, value: 2.62 },
          { year: 2020, value: 2.44 }, { year: 2021, value: 2.71 }, { year: 2022, value: 2.89 },
          { year: 2023, value: 3.02 }, { year: 2024, value: 3.12 }, { year: 2025, value: 3.22 },
        ],
        remarks: [
          { years: '★ 2023–25', note: 'Provisional — IEA CO₂ Emissions 2024 provides official figures through 2022; 2023–25 values are IEA/Global Carbon Project preliminary estimates based on energy consumption and fuel mix data.', noteHi: 'अस्थायी — IEA CO₂ Emissions 2024 आधिकारिक आंकड़े 2022 तक प्रदान करता है; 2023–25 के मान IEA/Global Carbon Project के प्रारंभिक अनुमान हैं जो ऊर्जा खपत और ईंधन मिश्रण डेटा पर आधारित हैं।  ' },
          { years: '2000–12', note: 'Emissions nearly double in 12 years as India industrialises rapidly. Coal dominates the energy mix at ~70% of power generation. Per-capita emissions remain low (~1.0 t CO₂/person vs global average ~4.7 t) — India\'s primary argument in climate negotiations.', noteHi: '12 वर्षों में उत्सर्जन लगभग दोगुना हो गया क्योंकि भारत तेजी से औद्योगिकीकरण कर रहा है। कोयला ऊर्जा मिश्रण में लगभग 70% पावर उत्पादन का प्रभुत्व रखता है। प्रति व्यक्ति उत्सर्जन कम है (~1.0 t CO₂/व्यक्ति बनाम वैश्विक औसत ~4.7 t) — भारत की जलवायु वार्ता में मुख्य तर्क।  ' },
          { years: '2016', note: 'India ratifies the Paris Agreement — NDC commits to 45% emissions intensity reduction by 2030 (vs 2005) and 500 GW non-fossil capacity. The intensity target is on track; absolute emissions continue to rise as the economy grows.', noteHi: 'भारत ने Paris Agreement को मंजूरी दी — NDC में 2030 तक 45% उत्सर्जन तीव्रता में कमी (2005 के मुकाबले) और 500 GW गैर-जीवाश्म क्षमता का लक्ष्य है। तीव्रता लक्ष्य ट्रैक पर है; अर्थव्यवस्था बढ़ने के कारण कुल उत्सर्जन बढ़ रहे हैं।  ' },
          { years: '2020', note: 'COVID dip to 2.44 GT — the first annual decline in 20 years. Rapid rebound in 2021 to 2.71 GT confirms structural coal dependence. India\'s power sector alone emits ~1.1 GT annually.', noteHi: 'COVID के कारण 2.44 GT तक गिरावट — 20 वर्षों में पहली वार्षिक गिरावट। 2021 में तेजी से पुनरुद्धार होकर 2.71 GT हो गया, जो कोयले पर संरचनात्मक निर्भरता की पुष्टि करता है। भारत के पावर सेक्टर से अकेले लगभग 1.1 GT वार्षिक उत्सर्जन होता है।  ' },
          { years: '2022–25', note: 'India crosses 3 GT for the first time in 2023 — now the world\'s third-largest emitter after China and the USA. Despite record renewable additions, coal consumption hit an all-time high in FY24. The key tension: 800 million Indians still lack reliable 24/7 electricity access, making a rapid coal exit politically and economically untenable.', noteHi: 'भारत ने 2023 में पहली बार 3 GT पार किया — अब चीन और USA के बाद दुनिया का तीसरा सबसे बड़ा उत्सर्जक। रिकॉर्ड नवीकरणीय ऊर्जा जोड़ने के बावजूद, FY24 में कोयला खपत सर्वकालिक उच्च स्तर पर पहुंच गई। मुख्य तनाव यह है कि 800 मिलियन भारतीयों के पास अभी भी विश्वसनीय 24/7 बिजली पहुंच नहीं है, जिससे तेज कोयला निकासी राजनीतिक और आर्थिक रूप से असंभव है।' },
        ],
      },
    ],
    stats: [
      {
        label: 'Environmental Performance Index rank (EPI 2024)',
        value: '176th / 180 countries',
        note: '5th from the bottom — below Pakistan (147), Bangladesh (158), Nepal (162). India scores critically low on air quality and ecosystem vitality. Only Afghanistan, Myanmar, Vietnam, and Laos rank lower.',
        trend: 'down',
        source: 'EPI 2024, Yale Center for Environmental Law & Policy — released June 2024',
      },
      {
        label: 'Forest cover as % of land area (ISFR 2023)',
        value: '21.76%',
        note: 'Effectively unchanged from 21.71% in 2021. Open/scrub forest growing (3.03%), but dense and very dense forest barely increases. National Forest Policy 1988 target is 33% — India is likely a century away at current trend.',
        trend: 'neutral',
        source: 'India State of Forest Report (ISFR) 2023, Forest Survey of India, MoEFCC',
      },
      {
        label: 'Polluted river stretches identified (CPCB 2022)',
        value: '328 stretches',
        note: 'Up from 121 in 2011 — nearly tripled in a decade. India\'s sewage treatment plants treat only ~37% of urban sewage generated. The Ganga basin accounts for the largest share of critical pollution.',
        trend: 'down',
        source: 'CPCB Polluted River Stretches 2022, Ministry of Environment, Forest and Climate Change',
      },
    ],
  },
];

// ─── Ministry Ratings ─────────────────────────────────────────────────────────

// ─── CAG Highlights ───────────────────────────────────────────────────────────


// ─── Shared helpers ───────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return { ring: '#22c55e', text: 'text-green-500', bar: 'bg-green-500', bg: 'bg-green-500/10', label: 'Good',       labelHi: 'अच्छा' };
  if (score >= 55) return { ring: '#f59e0b', text: 'text-amber-500', bar: 'bg-amber-500', bg: 'bg-amber-500/10', label: 'Moderate',   labelHi: 'मध्यम' };
  if (score >= 35) return { ring: '#f97316', text: 'text-orange-500', bar: 'bg-orange-500', bg: 'bg-orange-500/10', label: 'Concerning', labelHi: 'चिंताजनक' };
  return { ring: '#ef4444', text: 'text-red-500', bar: 'bg-red-500', bg: 'bg-red-500/10', label: 'Critical',   labelHi: 'गंभीर' };
}

const ACCOUNTABILITY_LABEL_HI: Record<string, string> = {
  'Transparency': 'पारदर्शिता',
  "Officials' Legal Integrity": 'अधिकारियों की कानूनी ईमानदारी',
  'Governance': 'शासन',
  'Implementation': 'क्रियान्वयन',
  'Accountability': 'जवाबदेही',
  'Monetary Management': 'वित्तीय प्रबंधन',
};

const SEVERITY_META = {
  critical: { label: 'Critical', dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-950/40',       border: 'border-red-200 dark:border-red-800' },
  major:    { label: 'Major',    dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800' },
  minor:    { label: 'Minor',    dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200 dark:border-yellow-800' },
};

function useWikiPhoto(wikiTitle?: string) {
  return useQuery<string | null>({
    queryKey: ['wiki-photo', wikiTitle],
    enabled: !!wikiTitle,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=200&titles=${encodeURIComponent(wikiTitle!)}&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0] as any;
      return page?.thumbnail?.source ?? null;
    },
  });
}

function MemberAvatar({ name, wikiTitle, size = 'md' }: { name: string; wikiTitle?: string; size?: 'sm' | 'md' | 'lg' }) {
  const { data: photoUrl } = useWikiPhoto(wikiTitle);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const dim = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'md' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={80}
        height={80}
        loading="lazy"
        decoding="async"
        className={`${dim} rounded-full flex-shrink-0 object-cover object-top border-2 border-border bg-muted`}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full flex-shrink-0 bg-primary/10 text-primary font-bold flex items-center justify-center border-2 border-border`}>
      {initials}
    </div>
  );
}

function ScoreBar({ label, score, caption, colorClass }: { label: string; score: number; caption: string; colorClass: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{label}</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-[10px] font-mono font-semibold w-6 text-right flex-shrink-0">{score}</span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:inline">{caption}</span>
      </div>
      <span className="text-[10px] text-muted-foreground pl-16 sm:hidden leading-snug">{caption}</span>
    </div>
  );
}

// ─── Score Ring (matching state-facts exactly) ────────────────────────────────

function ScoreRing({ score, icon: Icon, label, selected, onClick }: {
  score: number; icon: React.ElementType; label: string; selected: boolean; onClick: () => void;
}) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const R = 28; const C = 2 * Math.PI * R; const filled = (score / 100) * C;
  const sc = scoreColor(score);
  const { ring, text, bg } = sc;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 focus:outline-none ${
        selected ? `${bg} ring-2 ring-offset-2 ring-offset-background` : 'hover:bg-muted'
      }`}
      style={selected ? { '--tw-ring-color': ring } as React.CSSProperties : undefined}
    >
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
          <circle cx="32" cy="32" r={R} fill="none" stroke={ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${filled} ${C - filled}`} />
        </svg>
        <Icon className={`w-5 h-5 ${text} relative z-10`} />
      </div>
      <span className={`text-xl font-bold leading-none ${text}`}>{score}</span>
      <span className="text-[11px] text-muted-foreground text-center leading-tight">
        {isHi ? (ACCOUNTABILITY_LABEL_HI[label] ?? label) : label}
      </span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
        {isHi ? sc.labelHi : sc.label}
      </span>
    </button>
  );
}

// ─── Section: Accountability ──────────────────────────────────────────────────

function AccountabilitySection() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = ACCOUNTABILITY.find(r => r.key === activeKey) ?? null;
  return (
    <div className="px-6 py-5 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {t('accountabilityRatings')}
      </p>
      <div className="grid grid-cols-3 gap-1 mb-1">
        {ACCOUNTABILITY.map(r => (
          <ScoreRing
            key={r.key}
            score={r.score}
            icon={r.icon}
            label={r.label}
            selected={activeKey === r.key}
            onClick={() => setActiveKey(prev => prev === r.key ? null : r.key)}
          />
        ))}
      </div>
      {active && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold text-foreground mb-1">{isHi ? (ACCOUNTABILITY_LABEL_HI[active.label] ?? active.label) : active.label} — {t('ratingMethodology')}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{active.methodology}</p>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/50 text-center mt-2 font-mono">{t('tapRingForMethodology')}</p>
    </div>
  );
}

// ─── Scoring Methodology Modal ────────────────────────────────────────────────

function ScoringMethodologyModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('scoreMethodology')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 text-xs text-muted-foreground">
          <p className="text-[11px] leading-relaxed">
            {isHi
              ? 'सभी स्कोर ECI के स्व-घोषित शपथ पत्रों से ADR / myneta.info के माध्यम से संकलित किए जाते हैं। ये वही दर्शाते हैं जो मंत्रियों ने शपथ के तहत घोषित किया है — स्वतंत्र सत्यापन नहीं।'
              : <>All scores are computed from <strong className="text-foreground">ECI self-declared affidavits</strong> as reported by ADR / myneta.info. They reflect what ministers have declared under oath — not independent verification.</>
            }
          </p>

          {/* Education */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              {t('educationScore')}
            </h3>
            <p className="text-[11px] mb-2 leading-relaxed">
              {isHi
                ? 'ECI शपथ पत्र में घोषित उच्चतम योग्यता के आधार पर निश्चित तालिका से निर्धारित।'
                : 'Fixed lookup based on the highest qualification declared in the ECI affidavit.'
              }
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="text-left px-3 py-1.5 font-medium text-foreground">{t('qualification')}</th>
                    <th className="text-right px-3 py-1.5 font-medium text-foreground w-14">{t('score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    [t('phdDoctoralEquivalent'), 95],
                    [t('mastersMphilMbaMd'), 85],
                    [t('professionalUg'), 75],
                    [t('bachelors'), 65],
                    [t('classXiiIntermediate'), 50],
                    [t('classXMatric'), 38],
                    [t('belowClassX'), 25],
                    [t('notDisclosed'), 0],
                  ].map(([label, score]) => (
                    <tr key={label as string} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-foreground">{score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Integrity */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {t('integrityScore')}
            </h3>
            <p className="text-[11px] mb-2 leading-relaxed">
              {isHi
                ? 'ECI शपथ पत्र में घोषित लंबित आपराधिक मामलों से निर्धारित। गंभीर IPC धाराएं (≥ 5 वर्ष के कारावास वाले अपराध, PC Act 13(2)) को सामान्य मामलों की लगभग दोगुनी दर पर दंडित किया जाता है।'
                : <>Derived from <strong className="text-foreground">pending criminal cases</strong> declared in the ECI affidavit. Serious IPC charges (offences carrying ≥ 5 years imprisonment, PC Act 13(2)) are penalised at nearly double the rate of minor ones.</>
              }
            </p>
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 font-mono text-[11px] leading-relaxed mb-2">
              <span className="text-foreground font-semibold">{t('score')}</span>
              {' = max(10, 100 − serious × 18 − minor × 10)'}
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="text-left px-3 py-1.5 font-medium text-foreground">{t('cases')}</th>
                    <th className="text-right px-3 py-1.5 font-medium text-foreground w-14">{t('score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    [t('zeroCases'), 100],
                    [t('oneMinorCase'), 90],
                    [t('oneSeriousCase'), 82],
                    [t('twoCases'), t('formula')],
                    [t('threeCases'), t('formula')],
                    [t('sixToNineCases'), t('approximatelyTwenty')],
                    [t('tenPlusCases'), t('tenFloor')],
                  ].map(([label, score]) => (
                    <tr key={label as string} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-foreground">
                        {typeof score === 'number' ? score : score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] mt-2 leading-relaxed">
              <strong className="text-foreground">{t('serious')}</strong> = IPC sections 302, 307, 354, 420, 467, 506, PC Act 13(2), and any offence with ≥ 5-year imprisonment.
              Per <a href="https://adrindia.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t('adrIndia')}</a> definition.
            </p>
          </section>

          {/* Asset Growth */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              {t('assetGrowthFactor')}
            </h3>
            <p className="text-[11px] mb-2 leading-relaxed">
              {isHi
                ? '2019 और 2024 के ECI शपथ पत्रों के बीच स्व-घोषित कुल संपत्ति में अनुपातहीन वृद्धि को एक चेतावनी संकेत माना जाता है और इससे ईमानदारी स्कोर कम होता है। यह ADR के अपने "करोड़पति सांसद" जांच ढांचे का अनुसरण करता है।'
                : <>Disproportionate growth in self-declared total assets between the <strong className="text-foreground">2019 and 2024 ECI affidavits</strong> is treated as a red flag and reduces the integrity score. This follows ADR's own "crorepati MP" scrutiny framework.</>
              }
            </p>
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 font-mono text-[11px] leading-relaxed mb-2">
              <span className="text-foreground font-semibold">{isHi ? 'ईमानदारी' : 'integrity'}</span>
              {' = max(10, criminal_score − asset_penalty)'}
            </div>
            <div className="rounded-lg border border-border overflow-hidden mb-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="text-left px-3 py-1.5 font-medium text-foreground">{t('assetGrowth')}</th>
                    <th className="text-right px-3 py-1.5 font-medium text-foreground w-20">{t('penalty')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    [t('underTwoHundredIncrease'), t('zeroPoints'), t('withinReasonableGrowth')],
                    [t('twoToFourNinetyNineIncrease'), t('minusFivePoints'), t('notableWarrantsAttention')],
                    [t('fiveToNineNinetyNineIncrease'), t('minusTenPoints'), t('significantAdrFlags')],
                    [t('thousandPlusIncrease'), t('minusFifteenPoints'), t('extremeRedFlag')],
                    [t('dataNotSourced'), t('noPenalty'), t('sourcingInProgress')],
                  ].map(([range, penalty, note]) => (
                    <tr key={range} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5">
                        <span className="text-muted-foreground">{range}</span>
                        <span className="block text-[10px] text-muted-foreground/60">{note}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-orange-500">{penalty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground/70">
              {t('assetGrowthFootnote')}{' '}
              <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary underline">myneta.info</a>.
              {isHi
                ? 'जिन मंत्रियों का 2019 लोकसभा शपथ पत्र रिकॉर्ड में नहीं है (पहली बार सांसद, राज्यसभा सदस्य) उन्हें कोई दंड नहीं मिलता।'
                : 'Ministers without a 2019 Lok Sabha affidavit on record (first-time MPs, Rajya Sabha members) receive no penalty.'
              }
            </p>
          </section>

          {/* Source */}
          <section className="border-t border-border pt-4">
            <p className="text-[10px] leading-relaxed">
              <strong className="text-foreground">{t('source')}:</strong> Association for Democratic Reforms (ADR) /&nbsp;
              <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary underline">myneta.info</a>
              {isHi ? '\u00a0— 2024 आम चुनाव (लोकसभा) के दौरान दाखिल ECI शपथ पत्रों का विश्लेषण।' : '\u00a0— analysis of ECI affidavits filed during the 2024 general elections (Lok Sabha).'}
              {t('individualAffidavitFootnote')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Section: PM + Cabinet ────────────────────────────────────────────────────

function PMCabinetSection() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const cabinetMinisters = CABINET.filter(m => m.title === 'Cabinet Minister');
  const mosIC = CABINET.filter(m => m.title === 'MoS (Independent Charge)');
  const mos = CABINET.filter(m => m.title === 'Minister of State');

  return (
    <div className="px-6 py-5 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {t('primeMinister')}
      </p>

      {/* PM row — identical to CM in state-facts */}
      <div className="flex items-start gap-4">
        <Link href={`/minister/${PM.slug}`} className="flex-shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
          <MemberAvatar name={PM.name} wikiTitle={PM.wikiTitle} size="lg" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/minister/${PM.slug}`} className="group">
            <p className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{i18n.language === 'hi' ? (namesHi[PM.name] ?? PM.name) : PM.name}</p>
          </Link>
          <p className="text-sm text-muted-foreground">{i18n.language === 'hi' ? (officialTitlesHi[PM.title] ?? PM.title) : PM.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{PM.party}</span>
            <span className="text-xs text-muted-foreground">{t('since')} {i18n.language === 'hi' ? hiDate(PM.since) : PM.since}</span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <ScoreBar label={t('education')} score={PM.educationScore} caption={(isHi ? (PM.educationHi ?? PM.education) : PM.education).split(',')[0]} colorClass="bg-blue-500" />
            <ScoreBar label={t('legalIntegrity')} score={computeIntegrityScore(PM.criminalCases, PM.seriousCriminalCases ?? 0, PM.assetGrowthPct)} caption={t('zeroCasesDeclared')} colorClass={computeIntegrityScore(PM.criminalCases, PM.seriousCriminalCases ?? 0, PM.assetGrowthPct) < 70 ? 'bg-amber-500' : 'bg-green-500'} />
            {PM.criminalCaseNote && <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">{i18n.language === 'hi' ? (PM.criminalCaseNoteHi ?? PM.criminalCaseNote) : PM.criminalCaseNote}</p>}
            {PM.assetGrowthPct != null && (
              <p className="text-[10px] text-orange-500/80 mt-0.5">↑ {t('assetGrowth')} {PM.assetGrowthPct}% (2019→2024) · −{assetGrowthPenalty(PM.assetGrowthPct)} {t('integrityPts')}</p>
            )}
            <p className="text-[10px] text-muted-foreground/50 font-mono">{t('eciAffidavitSource')} {PM.affidavitYear}</p>
            <button
              onClick={() => setMethodologyOpen(true)}
              className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary mt-0.5 transition-colors"
            >
              <Info className="w-3 h-3" />
              {t('howScoresCalculated')}
            </button>
          </div>
        </div>
      </div>

      {/* Cabinet toggle */}
      <div className="mt-4">
        <button
          onClick={() => setCabinetOpen(v => !v)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {cabinetOpen
            ? <><ChevronUp className="w-4 h-4" /> {t('hideCabinetMinisters')}</>
            : <><ChevronDown className="w-4 h-4" /> {t('viewCabinetMinisters')} ({CABINET_SUMMARY.total})</>
          }
        </button>

        {cabinetOpen && (
          <div className="mt-4">
            {/* ADR summary banner */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 mb-3">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                {t('fullCouncil')} ({CABINET_SUMMARY.total} ministers):&nbsp;
                <strong>{CABINET_SUMMARY.percentCriminal}%</strong> ({CABINET_SUMMARY.withCriminalCases}/{CABINET_SUMMARY.total}) {t('declaredCriminalCases')}&nbsp;
                <strong>{CABINET_SUMMARY.percentSerious}%</strong> ({CABINET_SUMMARY.withSeriousCases}/{CABINET_SUMMARY.total}) {t('seriousCriminalCases')}
              </p>
              <p className="text-[10px] text-amber-700/60 dark:text-amber-400/60 mt-0.5">{isHi ? 'ADR / नेशनल इलेक्शन वॉच — 11 जून 2024 को मंत्रिपरिषद के 72 में से 71 मंत्रियों का विश्लेषण।' : CABINET_SUMMARY.source}</p>
            </div>

            {[
              { label: `${t('cabinetMinisters')} (${cabinetMinisters.length})`, members: cabinetMinisters },
              { label: `${t('ministersOfStateIndependentCharge')} (${mosIC.length})`, members: mosIC },
              { label: `${t('ministersOfStateAttached')} (${mos.length})`, members: mos },
            ].map(group => (
              <div key={group.label} className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">{group.label}</p>
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {group.members.map(member => {
                    const hasCases = member.criminalCases > 0;
                    return (
                      <div key={member.name} className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <Link href={`/minister/${member.slug}`} className="flex-shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                            <MemberAvatar name={member.name} wikiTitle={member.wikiTitle} size="sm" />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link href={`/minister/${member.slug}`} className="group">
                                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{i18n.language === 'hi' ? (namesHi[member.name] ?? member.name) : member.name}</p>
                                </Link>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{i18n.language === 'hi' ? (ministerMinistriesHi[member.ministry] ?? member.ministry) : member.ministry}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">{member.party}</span>
                                <span className="text-xs text-muted-foreground">{t('since')} {i18n.language === 'hi' ? hiDate(member.since) : member.since}</span>
                              </div>
                            </div>
                            <div className="mt-2.5 flex flex-col gap-1.5">
                              <ScoreBar label={t('education')} score={member.educationScore} caption={(isHi ? (member.educationHi ?? member.education) : member.education).split(',')[0].trim()} colorClass="bg-blue-500" />
                              {(() => {
                                const displayed = computeIntegrityScore(member.criminalCases, member.seriousCriminalCases ?? 0, member.assetGrowthPct);
                                return (
                                  <ScoreBar
                                    label={t('legalIntegrity')}
                                    score={displayed}
                                    caption={hasCases ? `${member.criminalCases} ${member.criminalCases > 1 ? t('casePlural') : t('caseSingular')} ${t('casesDeclared')}` : t('zeroCasesDeclared')}
                                    colorClass={hasCases ? 'bg-red-500' : displayed < 70 ? 'bg-amber-500' : 'bg-green-500'}
                                  />
                                );
                              })()}
                              {member.criminalCaseNote && (
                                <p className={`text-[10px] mt-0.5 ${hasCases ? 'text-red-500/80' : 'text-amber-600/80 dark:text-amber-400/80'}`}>{i18n.language === 'hi' ? (member.criminalCaseNoteHi ?? member.criminalCaseNote) : member.criminalCaseNote}</p>
                              )}
                              {member.assetGrowthPct != null && (
                                <p className="text-[10px] text-orange-500/80 mt-0.5">↑ {t('assetGrowth')} {member.assetGrowthPct}% (2019→2024) · −{assetGrowthPenalty(member.assetGrowthPct)} {t('integrityPts')}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground/50 font-mono">{t('eciAffidavitSource')} {member.affidavitYear}</p>
                              <button
                                onClick={() => setMethodologyOpen(true)}
                                className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary mt-0.5 transition-colors"
                              >
                                <Info className="w-3 h-3" />
                                {t('howScoresCalculated')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {methodologyOpen && <ScoringMethodologyModal onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}

// ─── Historical Chart ─────────────────────────────────────────────────────────

const SERIES_LABEL_HI: Record<string, string> = {
  'Men': 'पुरुष', 'Women': 'महिलाएं', 'Delhi': 'दिल्ली', 'Mumbai': 'मुंबई',
  'Chennai': 'चेन्नई', 'Kolkata': 'कोलकाता', 'Solar': 'सौर', 'Wind': 'पवन',
  'Other RE': 'अन्य RE', 'Gross FDI': 'सकल FDI', 'Net FDI': 'शुद्ध FDI',
  'Allocated': 'आवंटित', 'Spent': 'व्यय', 'Enrolled (STT)': 'नामांकित (STT)',
  'Certified': 'प्रमाणित', 'Placed (verified)': 'नियुक्त (सत्यापित)',
  'Annual Extraction': 'वार्षिक निष्कर्षण', 'Exploitable Recharge': 'दोहन योग्य पुनर्भरण',
  'New schools opened': 'नए स्कूल खुले', 'Closed / merged': 'बंद / विलीन',
  'Reading (Std II text)': 'पठन (कक्षा II पाठ)', 'Arithmetic (division)': 'अंकगणित (भाग)',
  'Stunting (height-for-age)': 'बौनापन (ऊंचाई-उम्र)', 'Wasting (weight-for-height)': 'दुर्बलता (वजन-ऊंचाई)',
};

function HistoricalChart({ data, series, label, unit, source, remarks, yearLabel = 'FY', invertAxis = false, yDomain }: ChartConfig) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const isMulti = !!series && series.length > 1;

  // derive domain from all numeric keys in use
  const allVals = isMulti
    ? data.flatMap(d => series!.map(s => d[s.key] ?? 0))
    : data.map(d => d.value ?? 0);
  const hasNeg = allVals.some(v => v < 0);
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  // Use explicit yDomain when provided; otherwise auto-calculate.
  // Starting from 0 keeps proportions honest — avoid anchoring near the data
  // minimum, which inflates the visual size of small differences.
  const min = yDomain ? yDomain[0] : hasNeg ? Math.floor(rawMin) - 1 : 0;
  const max = yDomain ? yDomain[1] : Math.ceil(rawMax) + 2;
  const singleFill = (val: number) => (val < 0 ? '#ef4444' : '#f59e0b');

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/10 overflow-hidden">
      <div className="px-3 pt-3 pb-1 flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground">{label}</p>
        {isMulti ? (
          <div className="flex gap-3 shrink-0">
            {series!.map(s => (
              <span key={s.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{unit}</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap="20%" barGap={2}>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.06} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            interval={data.length <= 15 ? 0 : 4}
          />
          <YAxis
            domain={[min, max]}
            reversed={invertAxis}
            tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            width={32}
            tickFormatter={v => `${v}${isMulti ? '' : unit === '%' ? '%' : ''}`}
          />
          <Tooltip
            cursor={{ fill: 'currentColor', opacity: 0.04 }}
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
            }}
            formatter={(val: number, name: string) => {
              const seriesLabel = series?.find(s => s.key === name)?.label ?? name;
              return [`${val}${unit}`, seriesLabel];
            }}
            labelFormatter={(yr: number) => `${yearLabel}${yr}`}
          />
          {hasNeg && (
            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          )}
          {isMulti
            ? series!.map(s => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[2, 2, 0, 0]} />
              ))
            : (
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={singleFill(entry.value)} />
                ))}
              </Bar>
            )
          }
        </BarChart>
      </ResponsiveContainer>

      {remarks && remarks.length > 0 && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 mt-1">
          {remarks.map(r => (
            <div key={r.years} className="flex gap-2">
              <span className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 shrink-0 w-14">{r.years}</span>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{isHi && r.noteHi ? r.noteHi : r.note}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/40 font-mono px-3 pb-2">
        Source: {source}
      </p>
    </div>
  );
}

// ─── Section: National Indicators ────────────────────────────────────────────

function IndicatorsSection() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = NATIONAL_INDICATORS.find(i => i.key === activeKey) ?? null;

  return (
    <div className="px-6 py-5 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {t('nationalIndicators')}
      </p>

      {/* Rings row — same as state-facts */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mb-1">
        {NATIONAL_INDICATORS.map(ind => {
          const { ring, text, bg, label, labelHi } = scoreColor(ind.score);
          const Icon = ind.icon;
          const R = 28; const C = 2 * Math.PI * R; const filled = (ind.score / 100) * C;
          const sel = activeKey === ind.key;
          return (
            <button
              key={ind.key}
              onClick={() => setActiveKey(prev => prev === ind.key ? null : ind.key)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 focus:outline-none ${
                sel ? `${bg} ring-2 ring-offset-2 ring-offset-background` : 'hover:bg-muted'
              }`}
              style={sel ? { '--tw-ring-color': ring } as React.CSSProperties : undefined}
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                  <circle cx="32" cy="32" r={R} fill="none" stroke={ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${filled} ${C - filled}`} />
                </svg>
                <Icon className={`w-5 h-5 ${text} relative z-10`} />
              </div>
              <span className={`text-xl font-bold leading-none ${text}`}>{ind.score}</span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">{isHi ? (niHi.labels?.[ind.key] ?? ind.label) : ind.label}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>{isHi ? labelHi : label}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-sm font-semibold ${scoreColor(active.score).text}`}>{isHi ? (niHi.labels?.[active.key] ?? active.label) : active.label}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{isHi ? (niHi.summaries?.[active.key] ?? active.summary) : active.summary}</p>

          {active.charts?.map((chart, i) => (
            <HistoricalChart key={i} {...chart} />
          ))}

          <div className="flex flex-col gap-2 mt-3">
            {active.stats.map((stat, si) => {
              const hiStat = isHi ? (niHi.stats?.[active.key]?.[si] ?? {}) : {};
              return (
              <div key={stat.label} className="rounded-lg border border-border bg-muted/20 px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground">{isHi ? (hiStat.labelHi ?? stat.label) : stat.label}</p>
                    {stat.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{isHi ? (hiStat.noteHi ?? stat.note) : stat.note}</p>}
                  </div>
                  {stat.trend && (
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      stat.trend === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                      stat.trend === 'down' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {stat.trend === 'up' ? t('improving') : t('worsening')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/50 font-mono mt-1.5">{stat.source}</p>
              </div>
            ); })}
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/50 text-center mt-3 font-mono">{t('tapRingForData')}</p>
    </div>
  );
}

// ─── Section: Schemes ─────────────────────────────────────────────────────────

function SchemesSection() {
  const { t } = useTranslation();
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');

  const apiOff = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('govlens-api-down') === '1';
  const { data: schemesData, isLoading } = useListSchemes({}, { query: { enabled: !apiOff, retry: 0 } });
  const { data: categoriesData }         = useListCategories({ query: { enabled: !apiOff, retry: 0 } });
  // Without the API, Vite serves index.html for /api/* (HTTP 200 text).
  // Default `= []` only applies when data is undefined, not when it is a string.
  const schemes    = Array.isArray(schemesData)    ? schemesData    : [];
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  const filtered = useMemo(() => {
    return schemes.filter(s => {
      if (catFilter !== 'all' && String(s.categoryId) !== catFilter) return false;
      if (sevFilter !== 'all' && s.worstSeverity !== sevFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.ministry.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [schemes, search, catFilter, sevFilter]);

  const critCount = schemes.filter(s => s.worstSeverity === 'critical').length;
  const majCount  = schemes.filter(s => s.worstSeverity === 'major').length;
  const unaudited = schemes.filter(s => !s.worstSeverity).length;

  return (
    <div className="px-6 py-5 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {t('centralSchemes')}
      </p>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
          {schemes.length} {t('schemesTracked')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          <span className="w-2 h-2 rounded-full bg-red-500" />{critCount} {t('critical')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
          <span className="w-2 h-2 rounded-full bg-orange-500" />{majCount} {t('major')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
          {unaudited} {t('unaudited')}
        </span>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <ListFilter className="w-4 h-4" />
        {open
          ? <><ChevronUp className="w-4 h-4" /> {t('hideSchemes')}</>
          : <><ChevronDown className="w-4 h-4" /> {t('browseAllSchemes')} ({schemes.length})</>}
      </button>

      {open && (
        <div className="mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={t('searchSchemes')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-44">
                <SelectValue placeholder={t('allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sevFilter} onValueChange={setSevFilter}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-36">
                <SelectValue placeholder={t('allSeverities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allSeverities')}</SelectItem>
                <SelectItem value="critical">{t('critical')}</SelectItem>
                <SelectItem value="major">{t('major')}</SelectItem>
                <SelectItem value="minor">{t('minor')}</SelectItem>
                <SelectItem value="null">{t('unaudited')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          {(search || catFilter !== 'all' || sevFilter !== 'all') && (
            <p className="text-[11px] text-muted-foreground mb-3">
              {filtered.length} of {schemes.length} {t('schemesCount')}
            </p>
          )}

          {/* Grid */}
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('noSchemesMatch')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(s => <SchemeCard key={s.slug} scheme={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section: CAG Audit Highlights (2025-26, live from DB) ───────────────────

function CagSection() {
  const { t, i18n } = useTranslation();
  const [open, setOpen]                       = useState(false);
  const [severityFilter, setSeverityFilter]   = useState<string>('all');
  const [schemeFilter, setSchemeFilter]       = useState('');

  const { data: rawAudits = [], isLoading: loading } = useQuery<LiveCagAudit[]>({
    queryKey: ['cag-audits-recent'],
    queryFn: () => fetch('/api/cag-audits?yearFrom=2025').then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }),
    enabled: typeof sessionStorage === 'undefined' || sessionStorage.getItem('govlens-api-down') !== '1',
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  const audits = useMemo(() => {
    const sevOrder: Record<string, number> = { critical: 0, major: 1, minor: 2 };
    return [...rawAudits].sort((a, b) =>
      b.reportYear - a.reportYear ||
      (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3)
    );
  }, [rawAudits]);

  const filtered = useMemo(() => audits.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (schemeFilter.trim()) {
      const q = schemeFilter.toLowerCase();
      return a.schemeName.toLowerCase().includes(q) || a.ministry.toLowerCase().includes(q);
    }
    return true;
  }), [audits, severityFilter, schemeFilter]);

  const years   = [...new Set(audits.map(a => a.reportYear))].sort((a, b) => b - a);
  const critCount = audits.filter(a => a.severity === 'critical').length;
  const majCount  = audits.filter(a => a.severity === 'major').length;
  const minCount  = audits.filter(a => a.severity === 'minor').length;

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('cagAuditFindings')}
        </p>
        <Link
          href="/reports"
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex-shrink-0"
        >
          {t('viewAllReports')} <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {loading ? (
          <span className="text-xs text-muted-foreground">{t('loading')}</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
              {audits.length} {t('findings')} · {years.map(y => `'${String(y).slice(2)}`).join(' & ')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
              <span className="w-2 h-2 rounded-full bg-red-500" />{critCount} {t('critical')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
              <span className="w-2 h-2 rounded-full bg-orange-500" />{majCount} {t('major')}
            </span>
            {minCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />{minCount} {t('minor')}
              </span>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <FileSearch className="w-4 h-4" />
        {open
          ? <><ChevronUp className="w-4 h-4" /> {t('hideFindings')}</>
          : <><ChevronDown className="w-4 h-4" /> {t('browseFindings')} ({audits.length})</>
        }
      </button>

      {open && (
        <div className="mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={t('filterSchemeMinistry')}
                value={schemeFilter}
                onChange={e => setSchemeFilter(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-36">
                <SelectValue placeholder={t('allSeverities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allSeverities')}</SelectItem>
                <SelectItem value="critical">{t('critical')}</SelectItem>
                <SelectItem value="major">{t('major')}</SelectItem>
                <SelectItem value="minor">{t('minor')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(schemeFilter || severityFilter !== 'all') && (
            <p className="text-[11px] text-muted-foreground mb-3">
              {filtered.length} of {audits.length} {t('findings')}
            </p>
          )}

          {/* Grouped by year */}
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('loading')}</p>
          ) : (
            <div className="flex flex-col gap-6">
              {years.map(yr => {
                const group = filtered.filter(a => a.reportYear === yr);
                if (group.length === 0) return null;
                return (
                  <div key={yr}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      {yr}
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.map(a => {
                        const sev = SEVERITY_META[a.severity];
                        return (
                          <div key={a.id} className={`rounded-lg border px-4 py-3 flex flex-col gap-1.5 ${sev.bg} ${sev.border}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${sev.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sev.dot} flex-shrink-0`} />
                                  {sev.label}
                                </span>
                                {a.reportNumber && (
                                  <span className="text-[10px] text-muted-foreground font-mono">{t('reportNo')} {a.reportNumber}</span>
                                )}
                              </div>
                              {a.sourceUrl ? (
                                <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex-shrink-0 text-muted-foreground/50 hover:text-primary transition-colors">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <a href="https://cag.gov.in" target="_blank" rel="noopener noreferrer"
                                  className="flex-shrink-0 text-muted-foreground/50 hover:text-primary transition-colors">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {(() => {
                              const isHi = i18n.language === 'hi';
                              const ah = isHi ? (cagAuditHi[String(a.id)] ?? {}) : {};
                              return <>
                                <p className="text-xs font-semibold text-foreground">
                                  {isHi ? (schemeHi[a.schemeSlug]?.nameHi ?? a.schemeName) : a.schemeName}
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wide truncate">
                                  {isHi ? (ministriesHi[a.ministry] ?? a.ministry) : a.ministry}
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {isHi ? (ah.findingHi ?? a.finding) : a.finding}
                                </p>
                                {(a.claimed || a.actual) && (
                                  <div className="mt-0.5 grid grid-cols-2 gap-2">
                                    {a.claimed && (
                                      <div className="rounded bg-background/60 px-2 py-1">
                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{t('claimed')}</p>
                                        <p className="text-[11px] text-foreground">{isHi ? (ah.claimedHi ?? a.claimed) : a.claimed}</p>
                                      </div>
                                    )}
                                    {a.actual && (
                                      <div className="rounded bg-background/60 px-2 py-1">
                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{t('actual')}</p>
                                        <p className="text-[11px] text-foreground">{isHi ? (ah.actualHi ?? a.actual) : a.actual}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>;
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground/50 font-mono">
              {t('cagSource')} CAG of India official reports · cag.gov.in
            </p>
            <a
              href="/reports"
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t('viewOlderAuditReports')} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: BJP Manifesto Tracker (2014 · 2019 · 2024) ─────────────────────

type PromiseStatus = 'implemented' | 'partial' | 'in-progress' | 'not-fulfilled' | 'pending';

interface ManifestoPromise {
  promise: string;
  promiseHi: string;
  status: PromiseStatus;
  note: string;
  noteHi: string;
  cagVerdict?: string;
  cagVerdictHi?: string;
  cagSource?: string;
  cagAmountCrore?: number;
}
interface ManifestoCategory {
  name: string;
  nameHi: string;
  promises: ManifestoPromise[];
}
interface ManifestoYear {
  year: number;
  title: string;
  titleHi: string;
  tagline: string;
  taglineHi: string;
  sourceUrl: string;
  categories: ManifestoCategory[];
}

// ── 2014 Manifesto ────────────────────────────────────────────────────────────
const MANIFESTO_2014: ManifestoYear = {
  year: 2014,
  title: 'Ek Bharat Shreshtha Bharat',
  titleHi: 'एक भारत श्रेष्ठ भारत',
  tagline: 'Sabka Saath, Sabka Vikas',
  taglineHi: 'सबका साथ, सबका विकास',
  sourceUrl: 'https://www.bjp.org/bjp-manifesto-2014',
  categories: [
    {
      name: 'Governance & Anti-Corruption',
      nameHi: 'शासन और भ्रष्टाचार विरोध',
      promises: [
        {
          promise: 'Appoint Lokpal — set up the independent anti-corruption ombudsman',
          promiseHi: 'लोकपाल की नियुक्ति — स्वतंत्र भ्रष्टाचार निरोधक लोकपाल स्थापित करना',
          status: 'partial',
          note: 'Justice PC Ghose became India\'s first Lokpal in March 2019 — only after Supreme Court intervention, 5 years into the term. Body operates with a skeleton secretariat, declining budgets, and has concluded zero corruption cases. Lacks independent prosecution powers.',
          noteHi: 'जस्टिस PC घोष मार्च 2019 में भारत के पहले लोकपाल बने — SC के हस्तक्षेप के बाद, कार्यकाल के 5 साल बाद। निकाय कंकाल सचिवालय, घटते बजट के साथ काम करता है, और शून्य भ्रष्टाचार मामले निपटाए हैं।',
        },
        {
          promise: 'Black money — task force, global recovery and asset repatriation',
          promiseHi: 'काला धन — टास्क फोर्स, वैश्विक वसूली और संपत्ति वापसी',
          status: 'partial',
          note: 'SIT formed (2014). Demonetisation (Nov 2016) billed as the decisive strike — RBI confirmed 99.3% of cancelled ₹15.44 lakh crore returned legally, negating the undisclosed-cash thesis. Swiss bank holdings by Indians fell then rebounded. No major overseas asset repatriation achieved.',
          noteHi: 'SIT गठित (2014)। नोटबंदी (नवंबर 2016) निर्णायक प्रहार के रूप में — RBI ने पुष्टि की 99.3% रद्द ₹15.44 लाख करोड़ वापस आए। स्विस बैंक होल्डिंग्स घटीं फिर वापस बढ़ीं। कोई बड़ी विदेशी संपत्ति वापसी नहीं।',
        },
        {
          promise: 'e-Governance — paperless government, digital services for all citizens',
          promiseHi: 'ई-गवर्नेंस — पेपरलेस सरकार, सभी नागरिकों के लिए डिजिटल सेवाएं',
          status: 'implemented',
          note: 'Landmark success. UPI processes ₹200+ lakh crore/year across 14 billion+ monthly transactions. DigiLocker: 17 crore registered users. Aadhaar-DBT integration saved ₹2.73 lakh crore in welfare leakage. India now runs the world\'s largest digital public infrastructure stack.',
          noteHi: 'उल्लेखनीय सफलता। UPI प्रति माह 1,400 करोड़+ लेनदेन पर ₹200+ लाख करोड़ संसाधित। DigiLocker: 17 करोड़ उपयोगकर्ता। Aadhaar-DBT ने कल्याण रिसाव में ₹2.73 लाख करोड़ बचाए।',
        },
        {
          promise: 'GST — implement a unified Goods and Services Tax',
          promiseHi: 'जीएसटी — एकीकृत वस्तु एवं सेवा कर लागू करना',
          status: 'implemented',
          note: 'Launched July 1, 2017 after 17 years of political gridlock — replaced 17 central and state taxes. Monthly collections crossed ₹2 lakh crore in 2024. GST has added ₹18+ lakh crore to combined revenues since 2017. SME compliance burden and multiple rate slabs remain contentious.',
          noteHi: 'जुलाई 2017 में 17 साल की राजनीतिक गतिरोध के बाद लॉन्च — 17 केंद्रीय और राज्य करों की जगह। 2024 में मासिक संग्रह ₹2 लाख करोड़ पार। 2017 से संयुक्त राजस्व में ₹18+ लाख करोड़ जोड़े।',
        },
        {
          promise: 'Abrogation of Article 370 — remove special status of Jammu & Kashmir',
          promiseHi: 'अनुच्छेद 370 निरसन — जम्मू और कश्मीर की विशेष स्थिति हटाना',
          status: 'implemented',
          note: 'Delivered by Presidential Order on August 5, 2019. J&K split into J&K UT (with legislature) and Ladakh UT (without). Supreme Court upheld the move unanimously in December 2023. J&K statehood promised by PM in Parliament — not yet restored as of 2026.',
          noteHi: '5 अगस्त 2019 को राष्ट्रपति आदेश द्वारा लागू। J&K को J&K UT (विधायिका सहित) और लद्दाख UT (बिना विधायिका) में विभाजित। SC ने दिसंबर 2023 में सर्वसम्मति से बरकरार रखा। J&K राज्य का दर्जा PM ने संसद में वादा किया — 2026 तक बहाल नहीं।',
        },
        {
          promise: 'Ram Temple — facilitate construction of Ram Mandir in Ayodhya',
          promiseHi: 'राम मंदिर — अयोध्या में राम मंदिर निर्माण में सहायता',
          status: 'implemented',
          note: 'SC\'s 5:0 verdict (Nov 2019) settled a 70-year dispute. Ram Janmabhoomi Trust built the temple; PM Modi consecrated it January 22, 2024 before an estimated 70 crore TV viewers. ₹3,200 crore in donations received. Full temple complex construction continues.',
          noteHi: 'SC का 5:0 फैसला (नवंबर 2019) ने 70 साल का विवाद सुलझाया। राम जन्मभूमि ट्रस्ट ने मंदिर बनाया; PM मोदी ने 22 जनवरी 2024 को लगभग 70 करोड़ TV दर्शकों के सामने प्राण प्रतिष्ठा की।',
        },
        {
          promise: 'Transparent natural resource allocation — end discretionary coal/spectrum allocation; move to competitive auctions',
          promiseHi: 'पारदर्शी प्राकृतिक संसाधन आवंटन — विवेकाधीन कोयला/स्पेक्ट्रम आवंटन समाप्त; प्रतिस्पर्धी नीलामी',
          status: 'implemented',
          note: 'Supreme Court cancelled 214 coal block allocations (Sep 2014) in the coal scam judgment. Government immediately moved to e-auction regime: 79 coal blocks auctioned 2015–2024, generating ₹2.6 lakh crore in state revenues (royalties + levies). Coal production reached a record 997 MT in FY24 vs 565 MT in FY14. Spectrum auctions also strengthened post-2014. Concern: India remains the world\'s 2nd-largest coal importer (~260 MT/year); coal still supplies 74% of power generation, straining the clean-energy transition.',
          noteHi: 'SC ने 214 कोयला ब्लॉक रद्द किए (सितंबर 2014)। e-नीलामी: 79 ब्लॉक 2015-2024, राज्यों को ₹2.6 लाख करोड़ राजस्व। उत्पादन 565 MT (FY14) → 997 MT (FY24)। लेकिन भारत अभी भी ~260 MT/वर्ष कोयला आयात; ताप 74% बिजली उत्पादन।',
        },
      ],
    },
    {
      name: 'Economy & Employment',
      nameHi: 'अर्थव्यवस्था और रोजगार',
      promises: [
        {
          promise: '2 crore jobs per year — create employment for 20 crore youth over 10 years',
          promiseHi: '2 करोड़ नौकरियां प्रतिवर्ष — 10 वर्षों में 20 करोड़ युवाओं को रोजगार',
          status: 'not-fulfilled',
          note: 'Formal job creation averaged ~40 lakh/year (CMIE) vs 200 lakh promised — a 5× shortfall. Urban unemployment rose from 4.9% (2014) to 7.8% (2019). PLFS data put youth unemployment at 18%. PM later reframed it as "an aspiration, not a committed target".',
          noteHi: 'औपचारिक रोजगार सृजन ~40 लाख/वर्ष (CMIE) बनाम 200 लाख वादा — 5 गुना कम। शहरी बेरोजगारी 4.9% (2014) से 7.8% (2019) बढ़ी। PLFS: युवा बेरोजगारी 18%। PM ने बाद में इसे "संकल्प, प्रतिबद्ध लक्ष्य नहीं" कहा।',
        },
        {
          promise: 'Make in India — boost manufacturing to 25% of GDP, 100 mn jobs',
          promiseHi: 'मेक इन इंडिया — विनिर्माण को GDP का 25% तक बढ़ाना, 10 करोड़ नौकरियां',
          status: 'partial',
          note: 'PLI schemes across 14 sectors attracted ₹3.65 lakh crore in investment and created 7.5 lakh jobs. Manufacturing GDP share stuck at ~17% vs 25% target. Wins: India world\'s 2nd largest mobile phone maker; defence exports up 30× to ₹21,000 crore (FY24). The 100 mn jobs target remains distant.',
          noteHi: 'PLI योजनाएं: ₹3.65 लाख करोड़ निवेश, 7.5 लाख नौकरियां। विनिर्माण GDP ~17%, 25% से कम। सफलताएं: मोबाइल फोन में दुनिया का दूसरा सबसे बड़ा उत्पादक; रक्षा निर्यात 30 गुना बढ़कर ₹21,000 करोड़।',
        },
        {
          promise: 'Financial inclusion — Jan Dhan bank account for every household',
          promiseHi: 'वित्तीय समावेश — हर घर में जन धन बैंक खाता',
          status: 'implemented',
          note: '53 crore accounts opened; ₹2.31 lakh crore balance (2024). Zero-balance accounts fell from 77% (2015) to 8% (2024). Enabled ₹6.6 lakh crore in Direct Benefit Transfers — the world\'s largest financial inclusion programme.',
          noteHi: '53 करोड़ खाते; ₹2.31 लाख करोड़ बैलेंस (2024)। शून्य-बैलेंस खाते 77% (2015) से 8% (2024) हुए। ₹6.6 लाख करोड़ प्रत्यक्ष लाभ हस्तांतरण सक्षम — दुनिया का सबसे बड़ा वित्तीय समावेश कार्यक्रम।',
        },
        {
          promise: 'PM MUDRA Yojana — collateral-free micro-loans up to ₹10 lakh for small and micro enterprises',
          promiseHi: 'PM मुद्रा योजना — सूक्ष्म उद्यमियों को ₹10 लाख तक बिना गारंटी माइक्रो-लोन',
          status: 'implemented',
          note: 'Launched April 2015. ₹27.75 lakh crore disbursed across 47+ crore loan accounts (2015–2024). 68% of borrowers are women; 50%+ from SC/ST/OBC categories. Three tiers: Shishu (≤₹50k), Kishor (₹50k–₹5L), Tarun (₹5L–₹10L). Risks: NPA ratio rose to 6.7% (Shishu category, 2022) after COVID — smaller borrowers hit hardest. Concerns over zombie-loan practices raised by RBI inspections in 2022–23.',
          noteHi: 'अप्रैल 2015 में शुरू। 47+ करोड़ खातों में ₹27.75 लाख करोड़ वितरित। 68% महिला, 50%+ SC/ST/OBC। COVID के बाद शिशु NPA 6.7%। RBI जांच में zombie-loan की चिंताएं।',
        },
        {
          promise: 'Startup India — single-window registration, tax holiday and Fund of Funds for start-up ecosystem',
          promiseHi: 'स्टार्टअप इंडिया — सिंगल-विंडो पंजीकरण, टैक्स छूट और स्टार्टअप के लिए फंड ऑफ फंड्स',
          status: 'implemented',
          note: 'Launched January 2016. 1,17,254 DPIIT-recognised startups (2024) — India is the world\'s 3rd-largest startup ecosystem (Hurun 2024). 100+ unicorns valued at $330+ billion. ₹10,000 crore Fund of Funds (via SIDBI) has backed over 900 VC funds. 3-year income-tax exemption on profits. However, 2023–24 saw funding drop to $7 billion (from $24 billion peak in 2021), reflecting global funding winter and domestic valuation corrections.',
          noteHi: 'जनवरी 2016 में शुरू। 1,17,254 DPIIT-मान्यता प्राप्त स्टार्टअप — दुनिया का तीसरा सबसे बड़ा इकोसिस्टम। 100+ यूनिकॉर्न। ₹10,000 करोड़ फंड ऑफ फंड्स। 2023-24: फंडिंग $7 अरब (2021 के $24 अरब से गिरकर)।',
        },
        {
          promise: 'Skill India — equip millions of youth with job-ready skills through the National Skill Development Mission',
          promiseHi: 'स्किल इंडिया — राष्ट्रीय कौशल विकास मिशन से युवाओं को रोजगार-योग्य कौशल',
          status: 'not-fulfilled',
          note: 'National Skill Development Mission launched July 2015; government set a target of 400 million trained by 2022 across NSDC and sector skill councils. PMKVY 1.0+2.0+3.0 total: ~1.37 crore trained (2016–2023) — a fraction of the target. CAG audit (2023): 33% of "certified" candidates had not completed required training hours; 2.63 lakh certificates issued to candidates who failed assessments. Placement rate independently verified at below 15% in multiple state audits.',
          noteHi: 'राष्ट्रीय कौशल विकास मिशन जुलाई 2015; 2022 तक 40 करोड़ का लक्ष्य। PMKVY 1.0+2.0+3.0: ~1.37 करोड़ प्रशिक्षित। CAG ऑडिट (2023): 33% "प्रमाणित" उम्मीदवारों ने प्रशिक्षण पूरा नहीं किया; 2.63 लाख प्रमाण पत्र असफल उम्मीदवारों को; स्वतंत्र प्लेसमेंट दर 15% से कम।',
        },
      ],
    },
    {
      name: 'Agriculture',
      nameHi: 'कृषि',
      promises: [
        {
          promise: 'Crop insurance — protect farmers from losses due to natural disasters',
          promiseHi: 'फसल बीमा — प्राकृतिक आपदाओं से नुकसान पर किसानों की सुरक्षा',
          status: 'implemented',
          note: 'PMFBY launched 2016 with farmer premium capped at 2% (kharif) and 5% (rabi). ₹1.55 lakh crore in claims paid 2016–2024; ~5.5 crore farmers/season. Flaws: 4+ month claim delays; tenant farmers excluded. Several major states (Andhra Pradesh, Bihar, Gujarat) withdrew citing premium burden on state budgets.',
          noteHi: 'PMFBY 2016 में शुरू, किसान प्रीमियम 2% (खरीफ), 5% (रबी) तक सीमित। 2016-2024 में ₹1.55 लाख करोड़ दावे। कमियां: 4+ महीने देरी; काश्तकार किसान बाहर। आंध्र प्रदेश, बिहार, गुजरात जैसे बड़े राज्य वापस हटे।',
        },
        {
          promise: 'Doubling farmers\' income by 2022',
          promiseHi: '2022 तक किसानों की आय दोगुनी करना',
          status: 'not-fulfilled',
          note: 'Dalwai Committee (2016) required 10.4% annual income growth to hit 2022. NSSO/NITI Aayog data: real farm income grew ~35% over 7 years (~4–5%/year) — less than half the needed rate. Input cost inflation eroded nominal gains. Government acknowledged the target was missed without a formal successor plan.',
          noteHi: 'दलवई समिति (2016): 2022 तक 10.4% वार्षिक वृद्धि जरूरी। NSSO/NITI आयोग: 7 वर्षों में वास्तविक कृषि आय ~35% बढ़ी — आवश्यक दर की आधी से कम। इनपुट लागत ने नाममात्र लाभ खाए। सरकार ने लक्ष्य न पूरा होना स्वीकार किया।',
        },
        {
          promise: 'Irrigation — Pradhan Mantri Krishi Sinchai Yojana, water to every farm',
          promiseHi: 'सिंचाई — प्रधानमंत्री कृषि सिंचाई योजना, हर खेत को पानी',
          status: 'partial',
          note: '99 long-stalled irrigation projects fast-tracked; 45 completed, 54 still running (2024). Net irrigated area reached 49% of net sown area, below 55% target. Micro-irrigation covered 76 lakh hectares vs 100 lakh target. Per-drop yield gains documented in covered areas; overall coverage shortfall persists.',
          noteHi: '99 लंबित सिंचाई परियोजनाएं तेज कीं; 45 पूर्ण, 54 चल रही (2024)। शुद्ध सिंचित क्षेत्र 49%, लक्ष्य 55% से कम। सूक्ष्म सिंचाई 76 लाख हेक्टेयर बनाम 100 लाख लक्ष्य। उत्पादन लाभ दर्ज पर कवरेज कम।',
          cagVerdict: 'CAG Report No. 22 of 2018 (Accelerated Irrigation Benefits Programme / PMKSY): Of 99 priority projects, only 16 completed by the original deadline; cost overruns of 20–300% in completed projects; in 6 states, water distribution networks built but no water released to fields; beneficiary farmer awareness of scheme entitlements was below 30% in surveyed districts.',
          cagVerdictHi: 'CAG रिपोर्ट 22/2018 (त्वरित सिंचाई लाभ कार्यक्रम / PMKSY): 99 प्राथमिकता परियोजनाओं में से केवल 16 समय पर पूर्ण; पूर्ण परियोजनाओं में 20–300% लागत वृद्धि; 6 राज्यों में जल वितरण नेटवर्क बना लेकिन खेतों तक पानी नहीं; सर्वेक्षण जिलों में 30% से कम किसानों को योजना की जानकारी।',
          cagSource: 'https://cag.gov.in/webroot/uploads/download_audit_report/2018/Report_No_22_of_2018_Accelerated_Irrigation_Benefits_Programme_Ministry_of_Water_Resources_River_Development.pdf',
        },
        {
          promise: 'eNAM — electronic National Agriculture Market: pan-India trading platform to connect mandis and improve price discovery',
          promiseHi: 'eNAM — इलेक्ट्रॉनिक राष्ट्रीय कृषि बाजार: मंडियों को जोड़ने और मूल्य खोज सुधारने के लिए अखिल भारतीय ट्रेडिंग प्लेटफॉर्म',
          status: 'partial',
          note: 'Launched April 2016. 1,361 mandis across 23 states integrated; 1.80 crore farmers and 2.86 lakh traders registered; cumulative trade of ₹2.99 lakh crore (2016–2023). Genuine achievement in digital agri-infrastructure. But: eNAM covers less than 30% of marketed agricultural surplus; APMC regulations still prevent inter-state trade in most commodities; physical mandi presence still required in many states for actual settlement; the three farm laws meant to expand market access were repealed in Dec 2021 without a replacement framework.',
          noteHi: 'अप्रैल 2016 में शुरू। 23 राज्यों में 1,361 मंडियां; 1.80 करोड़ किसान; ₹2.99 लाख करोड़ व्यापार (2016-2023)। लेकिन: विपणन योग्य अधिशेष का 30% से कम eNAM पर। APMC कानून अभी भी अंतर-राज्य व्यापार रोकते हैं। 3 कृषि कानून दिसंबर 2021 में वापस।',
        },
        {
          promise: 'PMGSY — rural road connectivity: all-weather road to every village with 250+ population',
          promiseHi: 'PMGSY — ग्रामीण सड़क संपर्क: 250+ आबादी के हर गांव को हर-मौसम सड़क',
          status: 'partial',
          note: 'PMGSY Phase III (2019–2024): 1.25 lakh km of roads, upgradation focus. Cumulative (all phases): 7.50 lakh km constructed, 97% of targeted habitations connected by 2024. Rural road density improved significantly. But: 14,000+ habitations still without connectivity (mostly hilly/tribal terrain). Quality concerns: CAG (2023) found 15–35% of inspected roads had pavement defects within guarantee period; bridges missing at 18% of river crossings on "connected" routes.',
          noteHi: 'PMGSY Phase III (2019-2024): 1.25 लाख km। संचयी: 7.50 लाख km, 97% लक्षित बसाहट जुड़ीं (2024)। लेकिन 14,000+ बसाहट अभी भी बिना सड़क। CAG (2023): 15-35% सड़कों में गारंटी अवधि में दोष।',
        },
      ],
    },
    {
      name: 'Infrastructure & Housing',
      nameHi: 'बुनियादी ढांचा और आवास',
      promises: [
        {
          promise: 'Housing for all by 2022 — pucca house for every family',
          promiseHi: '2022 तक सबके लिए आवास — हर परिवार को पक्का मकान',
          status: 'partial',
          note: 'Target of 2.95 crore homes by 2022 — extended twice, then a fresh 3 crore homes added in Budget 2024. ~2.35 crore completed. CAG audits (2024) across multiple states found 35–38% incomplete, structural defects in 22–24% of "completed" homes, and ₹600+ crore paid without construction.',
          noteHi: '2.95 करोड़ मकान 2022 तक लक्ष्य — दो बार बढ़ाया, फिर बजट 2024 में नए 3 करोड़। ~2.35 करोड़ पूर्ण। CAG (2024): 35–38% अधूरे, 22–24% "पूर्ण" मकानों में संरचनात्मक दोष, ₹600+ करोड़ बिना निर्माण भुगतान।',
          cagVerdict: 'CAG Report No. 8 of 2025 (PMAY-G Performance Audit): 35–38% of sanctioned PMAY houses incomplete; 22–24% had severe structural deficiencies; ₹420–600 crore paid without construction in surveyed states.',
          cagVerdictHi: 'CAG रिपोर्ट 8/2025 (PMAY-G प्रदर्शन ऑडिट): 35–38% स्वीकृत PMAY मकान अधूरे; 22–24% में गंभीर संरचनात्मक दोष; सर्वेक्षण राज्यों में निर्माण बिना ₹420–600 करोड़ भुगतान।',
          cagAmountCrore: 600,
          cagSource: 'https://cag.gov.in/uploads/download_audit_report/2025/ES_PA_PMAY-ReportNo-8_English_05-15-2025-signed-copy-4-0694bb7331cf6a9.85852145.pdf',
        },
        {
          promise: 'Smart Cities Mission — develop 100 cities as smart cities',
          promiseHi: 'स्मार्ट सिटी मिशन — 100 शहरों को स्मार्ट सिटी के रूप में विकसित करना',
          status: 'partial',
          note: '₹1.8 lakh crore invested across 100 cities; mission closed 2024. ~80% of projects complete; ~20% cancelled or modified after cost overruns. No independent "smart outcomes" assessment published. CAG flagged ₹645 crore overruns in Karnataka alone, 30% project cancellations, and underfunded command-and-control centres.',
          noteHi: '100 शहरों में ₹1.8 लाख करोड़; मिशन 2024 में बंद। ~80% परियोजनाएं पूर्ण; ~20% रद्द। कोई स्वतंत्र "स्मार्ट परिणाम" मूल्यांकन नहीं। CAG: अकेले कर्नाटक में ₹645 करोड़ अधिक खर्च, 30% परियोजनाएं रद्द।',
          cagVerdict: 'CAG (Smart City Mission audit): Pan City spending exceeded allocations by ₹645 crore in Karnataka alone; 30% Area-Based projects cancelled; control centres underfunded.',
          cagVerdictHi: 'CAG (स्मार्ट सिटी मिशन ऑडिट): कर्नाटक में अकेले पैन सिटी खर्च आवंटन से ₹645 करोड़ अधिक; 30% एरिया-बेस्ड परियोजनाएं रद्द; कंट्रोल सेंटर कम वित्तपोषित।',
          cagAmountCrore: 645,
          cagSource: 'https://cag.gov.in/uploads/download_audit_report/2025/Chapter-3---Financial-Management-06981df9e1148a8.23881503.pdf',
        },
        {
          promise: 'Swachh Bharat Mission — end open defecation, build 10 crore toilets by 2019',
          promiseHi: 'स्वच्छ भारत मिशन — 2019 तक खुले में शौच मुक्त, 10 करोड़ शौचालय',
          status: 'partial',
          note: '10.28 crore toilets reportedly built; India self-declared ODF October 2019. But NFHS-5 (2019-21) found 19% of rural households still defecating openly. SQUAT survey (Rice Univ.) found 40–60% of toilets unused in sampled districts. CAG (Rajasthan): ODF-declared villages had no toilets in 50% of PMAY homes inspected.',
          noteHi: '10.28 करोड़ शौचालय; भारत ने अक्टूबर 2019 में ODF घोषित। लेकिन NFHS-5 (2019-21): 19% ग्रामीण खुले में। SQUAT सर्वे: 40-60% शौचालय अप्रयुक्त। CAG (राजस्थान): ODF घोषित गांवों में 50% PMAY घरों में शौचालय नहीं।',
          cagVerdict: 'CAG (Rajasthan State Audit, PMAY-G Performance Audit): In ODF-declared state, toilets missing in 50% of PMAY houses surveyed; usage not verified; ODF claims not backed by third-party validation in most states.',
          cagVerdictHi: 'CAG (राजस्थान राज्य ऑडिट, PMAY-G प्रदर्शन ऑडिट): ODF घोषित राज्य में, सर्वेक्षण किए PMAY मकानों के 50% में शौचालय नहीं; उपयोग सत्यापित नहीं; ODF दावों में अधिकांश राज्यों में तृतीय-पक्ष सत्यापन नहीं।',
          cagSource: 'https://cag.gov.in/ag1/rajasthan/en/audit-report',
        },
        {
          promise: 'Namami Gange — clean the Ganga river, sewage treatment, ghats',
          promiseHi: 'नमामि गंगे — गंगा नदी की सफाई, सीवेज उपचार, घाट',
          status: 'partial',
          note: '₹37,000 crore spent; 175 sewage treatment plants commissioned. Dissolved oxygen improved in upper Ganga (Haridwar–Rishikesh stretch). But CPCB 2023: biochemical oxygen demand still above safe limits in Kanpur, Prayagraj, Varanasi. CAG (2017): 39% of operational STPs found non-functional; tannery discharge largely uncontrolled.',
          noteHi: '₹37,000 करोड़ खर्च; 175 STP। ऊपरी गंगा में ऑक्सीजन सुधरी। लेकिन CPCB 2023: कानपुर, प्रयागराज, वाराणसी में BOD असुरक्षित। CAG (2017): 39% STP अकार्यशील; टेनरी प्रदूषण बेकाबू।',
          cagVerdict: 'CAG Report No. 39 of 2017 (Rejuvenation of River Ganga — Namami Gange): 39% of commissioned STPs non-functional at time of audit; 28 of 63 river-front development projects delayed by 2–5 years; effluent discharge standards not monitored in 80% of industrial clusters along the Ganga; ₹3,696 crore released to states without utilisation certificates.',
          cagVerdictHi: 'CAG रिपोर्ट 39/2017 (नमामि गंगे — राष्ट्रीय स्वच्छ गंगा मिशन): ऑडिट के समय 39% चालू STP अकार्यशील; 63 में से 28 रिवरफ्रंट परियोजनाएं 2–5 साल देरी; गंगा के 80% औद्योगिक क्लस्टर में प्रदूषण निगरानी नहीं; उपयोगिता प्रमाण पत्र बिना राज्यों को ₹3,696 करोड़ जारी।',
          cagAmountCrore: 3696,
          cagSource: 'https://cag.gov.in/en/audit-report/details/34506',
        },
        {
          promise: 'AMRUT — urban infrastructure renewal for 500 cities: water, sewerage, parks and public transport',
          promiseHi: 'AMRUT — 500 शहरों के लिए शहरी बुनियादी ढांचा नवीकरण: जल, सीवरेज, पार्क और सार्वजनिक परिवहन',
          status: 'partial',
          note: 'AMRUT (Atal Mission for Rejuvenation and Urban Transformation) launched June 2015 for 500 cities with ₹50,000 crore (Phase 1, 2015–2020). 75% of Phase 1 projects completed. Phase 2 (2021–2026): ₹2.99 lakh crore with a mandate for universal water and sewerage coverage in all statutory towns. Gains: water supply improved in 477 cities; 39 lakh new sewer connections. Shortfalls: sewage treatment capacity still handles only 28% of wastewater generated in AMRUT cities; storm-water drains incomplete in 60% of cities; CAG (2022): 22% of AMRUT Phase 1 projects delayed beyond 5 years.',
          noteHi: 'AMRUT जून 2015 में 500 शहरों के लिए ₹50,000 करोड़। Phase 1: 75% पूर्ण। Phase 2: ₹2.99 लाख करोड़। 477 शहरों में जल सुधार; 39 लाख सीवर कनेक्शन। लेकिन AMRUT शहरों का केवल 28% अपशिष्ट जल उपचार; CAG (2022): 22% परियोजनाएं 5 साल देरी।',
        },
      ],
    },
    {
      name: 'Health & Welfare',
      nameHi: 'स्वास्थ्य और कल्याण',
      promises: [
        {
          promise: 'PM Ujjwala Yojana — free LPG connections to BPL women (8 crore target)',
          promiseHi: 'PM उज्ज्वला योजना — BPL महिलाओं को मुफ्त LPG कनेक्शन (8 करोड़ लक्ष्य)',
          status: 'partial',
          note: '9.6 crore LPG connections given (exceeded 8 crore target). But refill reality: CAG found average 3.66 refills/year vs 6.3 national average — half of beneficiaries couldn\'t afford ₹900+ cylinder cost. NFHS-5: 35% of Ujjwala households still use biomass (wood/dung) as primary cooking fuel.',
          noteHi: '9.6 करोड़ LPG कनेक्शन (8 करोड़ लक्ष्य से अधिक)। लेकिन CAG: 3.66 रिफिल/वर्ष बनाम 6.3 राष्ट्रीय औसत — आधे लाभार्थी ₹900+ सिलेंडर नहीं खरीद पाए। NFHS-5: 35% उज्ज्वला परिवार अभी भी बायोमास इस्तेमाल करते हैं।',
          cagVerdict: 'CAG Report No. 14 of 2019 (PM Ujjwala Yojana Performance Audit): Average refills per beneficiary only 3.21/year against national avg 6.3; states did not verify actual usage; goal of replacing biomass fuel not achieved.',
          cagVerdictHi: 'CAG रिपोर्ट 14/2019 (PM उज्ज्वला योजना प्रदर्शन ऑडिट): प्रति लाभार्थी औसत रिफिल केवल 3.21/वर्ष बनाम राष्ट्रीय औसत 6.3; राज्यों ने वास्तविक उपयोग सत्यापित नहीं किया; बायोमास ईंधन प्रतिस्थापन लक्ष्य हासिल नहीं।',
          cagSource: 'https://cag.gov.in/en/audit-report/details/55961',
        },
        {
          promise: 'MGNREGS reform — ensure 100 days of work actually delivered to rural poor',
          promiseHi: 'MGNREGS सुधार — ग्रामीण गरीबों को वास्तव में 100 दिन का काम सुनिश्चित करना',
          status: 'not-fulfilled',
          note: 'Budget cut from ₹34,000 cr to ₹38,500 cr (2014–2019) as PM called MGNREGS "a living monument of Congress\'s failure". Average work days: 48/year vs 100 guaranteed. Only COVID-era reverse migration forced a budget tripling (₹1.11 lakh crore, FY21). Structural guarantee of 100 days never enforced.',
          noteHi: 'बजट ₹34,000 करोड़ से ₹38,500 करोड़ (2014-2019) — PM ने MGNREGS को "कांग्रेस की विफलता का जीवंत स्मारक" कहा। औसत काम 48 दिन/वर्ष बनाम 100 की गारंटी। COVID प्रवासी संकट ने बजट तिगुना कराया। 100 दिन की गारंटी कभी लागू नहीं।',
          cagVerdict: 'CAG (multiple state performance audits): Only 2–4% of enrolled households received 100 days; payment delays in 40–60% of cases; ghost job cards and fraudulent transactions widespread.',
          cagVerdictHi: 'CAG (कई राज्य प्रदर्शन ऑडिट): केवल 2-4% नामांकित परिवारों को 100 दिन मिले; 40-60% मामलों में भुगतान देरी; फर्जी जॉब कार्ड और धोखाधड़ी लेनदेन व्यापक।',
          cagSource: 'https://cag.gov.in/en/audit-report',
        },
      ],
    },
    {
      name: 'Energy',
      nameHi: 'ऊर्जा',
      promises: [
        {
          promise: '24×7 electricity to every household — end load-shedding, electrify all un-electrified villages',
          promiseHi: 'हर घर 24×7 बिजली — लोड शेडिंग खत्म, सभी गांवों का विद्युतीकरण',
          status: 'partial',
          note: 'DDUGJY electrified 18,374 un-electrified villages by April 2018 (ahead of 2019 deadline). Saubhagya scheme (2017): 99.97% household connections declared April 2019 — a genuine scale achievement, adding ~2.6 crore connections in 18 months. But NSSO 80th Round (2023): 23% of rural households still reported less than 12 hours of daily supply. Average urban supply hours: 22+ (2024); rural average: 14–16 hours. Universal reliable supply remains unmet.',
          noteHi: 'DDUGJY: अप्रैल 2018 तक 18,374 गांव (समय से पहले)। सौभाग्य: अप्रैल 2019 में 99.97% कनेक्शन घोषित। NSSO 80वां राउंड (2023): 23% ग्रामीण घर — 12 घंटे/दिन से कम। शहरी: 22+ घंटे; ग्रामीण: 14-16 घंटे औसत।',
        },
        {
          promise: 'Renewable and solar energy — ambitious expansion of clean energy capacity',
          promiseHi: 'नवीकरणीय और सौर ऊर्जा — स्वच्छ ऊर्जा क्षमता का महत्वाकांक्षी विस्तार',
          status: 'partial',
          note: 'Government set 175 GW renewable target by 2022 (announced at COP21, 2015), later revised to 500 GW by 2030. Actual: 127 GW renewables installed by FY24 (73 GW solar), vs 175 GW — 2022 target missed by ~26%. India is world\'s 4th-largest solar capacity. Solar power cost fell 80% (2014–2024). PM Surya Ghar (rooftop solar for 1 crore homes) launched 2024. India on track for 500 GW by 2030 if the current pace holds.',
          noteHi: '175 GW नवीकरणीय 2022 तक (COP21, 2015); बाद में 500 GW 2030 तक। वास्तविक: FY24 तक 127 GW (73 GW सौर) — 2022 लक्ष्य 26% कम। दुनिया का चौथा सबसे बड़ा सौर बाजार। सौर लागत 80% गिरी।',
        },
      ],
    },
    {
      name: 'Women & Children',
      nameHi: 'महिला और बाल',
      promises: [
        {
          promise: 'Beti Bachao Beti Padhao — improve declining child sex ratio and ensure girls complete schooling',
          promiseHi: 'बेटी बचाओ बेटी पढ़ाओ — घटते बाल लिंगानुपात को सुधारना और बालिकाओं की स्कूली शिक्षा सुनिश्चित करना',
          status: 'partial',
          note: 'Launched January 22, 2015 in 100 gender-critical districts. Sex ratio at birth improved: 918 → 934 per 1,000 males (SRS 2021). School enrolment gender parity reached GPI 1.04 at primary level (UDISE+ 2022). However, CAG (2022): up to 56% of BBBP district allocations spent on media campaigns and advertising rather than direct field interventions; sex ratio actually worsened in 43 of the original 100 target districts between 2014 and 2021.',
          noteHi: '22 जनवरी 2015 को 100 जिलों में शुरू। जन्म लिंगानुपात 918 → 934 (SRS 2021)। GPI 1.04 प्राथमिक स्तर। लेकिन CAG (2022): 56% तक आवंटन विज्ञापन पर; मूल 100 जिलों में से 43 में लिंगानुपात और गिरा (2014-2021)।',
        },
        {
          promise: 'Women\'s safety — fast-track courts for sexual violence, stronger law enforcement',
          promiseHi: 'महिला सुरक्षा — यौन हिंसा के लिए फास्ट-ट्रैक कोर्ट, सख्त कानून प्रवर्तन',
          status: 'partial',
          note: '1,023 Fast-Track Special Courts (FTSCs) established by 2024 — 2,43,000+ cases disposed since inception. POCSO courts established in every district. In-camera hearings mandated. But NCRB 2023: reported rape cases rose from 36,735 (2014) to 31,516 (2023) — a 16% decline in reported cases but conviction rate for rape stuck below 30% (28.1%, NCRB 2022). Average trial duration remains 3+ years in FTSCs despite the "fast-track" mandate.',
          noteHi: '1,023 FTSC 2024 तक; 2,43,000+ मामले निपटाए। हर जिले में POCSO कोर्ट। NCRB 2023: बलात्कार के दर्ज मामले 31,516 (2023) — दोष-सिद्धि दर 28.1%, FTSC में भी औसत 3+ साल।',
        },
      ],
    },
    {
      name: 'Social Security',
      nameHi: 'सामाजिक सुरक्षा',
      promises: [
        {
          promise: 'Universal social security — pension, life and accident insurance for unorganised-sector workers',
          promiseHi: 'सार्वभौमिक सामाजिक सुरक्षा — असंगठित क्षेत्र के लिए पेंशन, जीवन और दुर्घटना बीमा',
          status: 'implemented',
          note: 'Three Jan Suraksha schemes, all launched May 2015: (1) Atal Pension Yojana — 6.21 crore subscribers (March 2024), guaranteed pension ₹1,000–5,000/month at 60; (2) PMJJBY (life cover ₹2 lakh, premium ₹436/yr) — 19.38 crore enrolled, ₹19,540 crore claims paid; (3) PMSBY (accident cover ₹2 lakh, premium ₹20/yr) — 44.62 crore enrolled. Together extend basic financial safety net to 400 mn informal workers previously unprotected.',
          noteHi: 'तीन जन सुरक्षा योजनाएं मई 2015: (1) APY — 6.21 करोड़ (मार्च 2024), 60 साल पर ₹1,000-5,000/माह; (2) PMJJBY — 19.38 करोड़, ₹19,540 करोड़ दावे; (3) PMSBY — 44.62 करोड़ नामांकित। 40 करोड़ असंगठित कामगारों को सुरक्षा।',
        },
        {
          promise: 'Jan Aushadhi — generic medicines at 50–90% below branded price in every district',
          promiseHi: 'जन औषधि — हर जिले में ब्रांडेड कीमत से 50–90% कम पर जेनेरिक दवाएं',
          status: 'implemented',
          note: 'PM Jan Aushadhi Pariyojana: 10,000+ stores operating (2024) vs 100 at scheme launch. 2,047 drugs and 300 surgical items at MRP 50–90% below branded equivalents. Cumulative sales: ₹6,000+ crore; patient savings estimated at ₹28,000 crore since inception. Medicines cover oncology, cardiac and diabetic categories — historically very expensive. Constraint: rural store density remains low; awareness limited to urban informed consumers; quality-control inspection capacity stretched across 10,000 outlets.',
          noteHi: '10,000+ जन औषधि केंद्र (2024); 2,047 दवाएं 50-90% सस्ती। ₹6,000+ करोड़ बिक्री; ₹28,000 करोड़ रोगी बचत। ग्रामीण घनत्व कम; जागरूकता सीमित।',
        },
      ],
    },
    {
      name: 'Defence & Security',
      nameHi: 'रक्षा और सुरक्षा',
      promises: [
        {
          promise: 'OROP — One Rank One Pension for all defence veterans',
          promiseHi: 'OROP — सभी रक्षा दिग्गजों के लिए समान रैंक समान पेंशन',
          status: 'partial',
          note: 'Announced November 2015 after months of veteran protests at Jantar Mantar. Dispute: government used a "5-year rolling average" base table rather than year-on-year parity. SC (2022) upheld government\'s definition. Revised OROP 2022: ₹8,450 crore arrears paid to 25.13 lakh veterans. Service associations report 20–30% of veterans in certain ranks still receive pensions below contemporaries who retired later.',
          noteHi: 'नवंबर 2015 में जंतर मंतर विरोध के बाद। विवाद: "5-वर्षीय रोलिंग औसत" बनाम वार्षिक समता। SC 2022 में सरकार की परिभाषा बरकरार। संशोधित OROP 2022: 25.13 लाख दिग्गजों को ₹8,450 करोड़। कई रैंकों में 20-30% को अभी भी कम पेंशन।',
        },
        {
          promise: 'Defence self-reliance — Make in India in defence: cut imports, build indigenous capability',
          promiseHi: 'रक्षा स्वावलंबन — रक्षा में मेक इन इंडिया: आयात कटौती, स्वदेशी क्षमता',
          status: 'partial',
          note: 'Major achievements: defence exports rose from ₹686 crore (FY14) to ₹21,083 crore (FY24) — a 30× increase; LCA Tejas inducted (Feb 2021); INS Vikrant, India\'s first indigenous aircraft carrier, commissioned September 2022; 75% FDI in defence permitted. But India remained world\'s 2nd-largest arms importer (SIPRI 2023). Negative import lists cover 410+ items; full indigenisation expected to take 10–15 years. Private sector MSME participation in defence still under 10% of procurement value.',
          noteHi: 'रक्षा निर्यात ₹686 करोड़ (FY14) → ₹21,083 करोड़ (FY24) — 30 गुना। LCA तेजस शामिल (2021); INS विक्रांत (2022); 75% FDI। लेकिन भारत SIPRI 2023 में दूसरा सबसे बड़ा हथियार आयातक। 410+ वस्तुएं नकारात्मक आयात सूची में।',
        },
      ],
    },
    {
      name: 'Education',
      nameHi: 'शिक्षा',
      promises: [
        {
          promise: 'AIIMS in every state — expand premier medical institutions across India',
          promiseHi: 'हर राज्य में AIIMS — पूरे भारत में प्रमुख चिकित्सा संस्थान',
          status: 'partial',
          note: '22 new AIIMS sanctioned (in addition to original 6). 15 have commenced academic sessions by 2024. Eight states still lack a functioning AIIMS. Average construction cost overrun: 40%. Most new AIIMS face severe faculty shortages — NMC data shows 30–50% vacant faculty positions in newer institutions. Super-speciality and advanced equipment still lag behind AIIMS Delhi benchmark by 5–10 years.',
          noteHi: '22 नए AIIMS स्वीकृत; 15 में शैक्षणिक सत्र (2024)। 8 राज्यों में अभी AIIMS नहीं। निर्माण लागत 40% अधिक। NMC: नए AIIMS में 30–50% पद खाली।',
        },
        {
          promise: 'National Education Policy — overhaul the 34-year-old NPE 1986; modernise curriculum, mother-tongue medium',
          promiseHi: 'राष्ट्रीय शिक्षा नीति — 34 वर्ष पुरानी NPE 1986 में आमूल बदलाव; पाठ्यक्रम आधुनिकीकरण, मातृभाषा माध्यम',
          status: 'partial',
          note: 'NEP 2020 notified July 29, 2020 — first overhaul since NPE 1986. Introduces 5+3+3+4 curricular structure, mother-tongue medium through Grade 5, multiple entry-exit in higher education, and academic bank of credits. State adoption is voluntary and uneven: 12 states had not adopted the NEP framework by 2024. IIT-JEE and NEET continue largely unchanged, contradicting NEP\'s common entrance framework. Full implementation expected beyond 2030.',
          noteHi: 'NEP 2020: 29 जुलाई 2020 — 1986 के बाद पहला। 5+3+3+4 ढांचा; ग्रेड 5 तक मातृभाषा। 2024 तक 12 राज्यों ने NEP नहीं अपनाया। IIT-JEE और NEET बिना बदलाव जारी। पूर्ण कार्यान्वयन 2030 के बाद।',
        },
      ],
    },
    {
      name: 'Maritime & Connectivity',
      nameHi: 'समुद्री और संपर्क',
      promises: [
        {
          promise: 'Sagarmala — port modernisation, coastal shipping, fishing communities along India\'s 7,500 km coastline',
          promiseHi: 'सागरमाला — बंदरगाह आधुनिकीकरण, तटीय शिपिंग, 7,500 km तट पर मछुआरा समुदाय',
          status: 'partial',
          note: 'Programme launched March 2015; 839 projects across port modernisation, new port development, port-led industrialisation and coastal community development. 344 completed (41%); 282 under construction; 213 in development (2024). Major port cargo throughput grew from 581 MT (FY14) to 819 MT (FY24). Employment goal of 40 lakh by 2025 not independently verified. Coastal shipping modal share remains below 7% vs 15% target.',
          noteHi: 'मार्च 2015 में शुरू; 839 परियोजनाएं। 344 पूर्ण, 282 निर्माणाधीन (2024)। प्रमुख बंदरगाह: 581 MT → 819 MT (FY14-FY24)। 40 लाख रोजगार लक्ष्य स्वतंत्र रूप से सत्यापित नहीं। तटीय शिपिंग 7% से कम।',
        },
        {
          promise: 'High-speed rail — introduce bullet-train corridor(s) in India',
          promiseHi: 'हाई-स्पीड रेल — भारत में बुलेट ट्रेन कॉरिडोर शुरू करना',
          status: 'in-progress',
          note: 'Mumbai–Ahmedabad High Speed Rail (508 km): approx ₹1.08 lakh crore project, funded 81% by Japan\'s JICA at 0.1% interest over 50 years. Original completion: 2023. Revised target: December 2028 for the full corridor; the Surat–Bilimora viaduct section is under active construction. Land acquisition: 99% complete in Gujarat; Maharashtra section was delayed several years due to farmer opposition and legal disputes. No other HSR corridor has progressed beyond feasibility study as of 2024.',
          noteHi: 'मुंबई-अहमदाबाद HSR (508 km): ₹1.08 लाख करोड़, 81% JICA फंडिंग (0.1%, 50 वर्ष)। मूल: 2023; संशोधित: दिसंबर 2028। गुजरात में 99% भूमि अधिग्रहण; महाराष्ट्र में देरी। सूरत-बिलिमोरा निर्माण चल रहा। 2024 तक कोई अन्य HSR कॉरिडोर FS से आगे नहीं।',
        },
        {
          promise: 'Dedicated Freight Corridors — build Eastern and Western DFCs to decongest rail network and cut freight time',
          promiseHi: 'समर्पित माल ढुलाई गलियारे — रेल नेटवर्क की भीड़ कम करने और माल ढुलाई समय घटाने के लिए EDFC और WDFC',
          status: 'partial',
          note: 'Eastern DFC (Ludhiana–Sonnagar, 1,337 km) and Western DFC (Dadri–Mumbai JNPT, 1,506 km). Original target: 2019–20; missed by 4+ years. EDFC fully operational November 2022; WDFC (Rewari–Sanand–JNPT section) fully operational by 2024. Delhi-Mumbai freight time cut from ~4 days to ~27 hours. Cost: original ₹81,459 crore escalated to ~₹1.09 lakh crore. Rail freight modal share rose marginally from 30% to 32%. Feeder connectivity to industrial clusters remains limited.',
          noteHi: 'EDFC (1,337 km) और WDFC (1,506 km)। मूल लक्ष्य: 2019-20 — 4+ साल देरी। EDFC नवंबर 2022 में पूर्ण; WDFC 2024 में। दिल्ली-मुंबई माल: 4 दिन → 27 घंटे। लागत: ₹81,459 करोड़ → ~₹1.09 लाख करोड़। रेल माल हिस्सा 30% → 32%।',
        },
        {
          promise: 'BharatNet — broadband connectivity to all 2.5 lakh gram panchayats via optical fibre',
          promiseHi: 'भारतनेट — ऑप्टिकल फाइबर से सभी 2.5 लाख ग्राम पंचायतों में ब्रॉडबैंड',
          status: 'partial',
          note: 'Phase 1 (1 lakh GPs, ₹7,575 crore): completed 2018 (target was 2017). Phase 2: 2.46 lakh GPs connected; 4.83 lakh km optical fibre laid (2024). Phase 3 announced 2023: ₹1.39 lakh crore via satellite for all 6.4 lakh GPs. However, TRAI (2022): only ~22% of connected GPs actually had active broadband users — last-mile WiFi equipment often non-functional, power supply erratic, no local service provider. CAG (2022): 25% of Phase 1 equipment lying unused due to absence of Village Level Entrepreneurs and consumer demand.',
          noteHi: 'Phase 1: 2018 तक 1 लाख GP (लक्ष्य 2017)। 2.46 लाख GP जुड़े; 4.83 लाख km फाइबर। Phase 3: ₹1.39 लाख करोड़। TRAI (2022): केवल 22% जुड़े GP में सक्रिय उपयोगकर्ता। CAG (2022): 25% उपकरण अप्रयुक्त।',
        },
        {
          promise: 'UDAN — regional aviation: connect tier-2/3 cities with affordable flights',
          promiseHi: 'UDAN — क्षेत्रीय विमानन: किफायती उड़ानों से टियर-2/3 शहरों को जोड़ना',
          status: 'partial',
          note: 'Ude Desh ka Aam Nagrik launched October 2016. 425+ routes awarded; 74 airports/heliports connected including 48 previously non-operational. Air passengers: 61 mn (FY14) → 152 mn (FY23) — a 2.5× rise, though COVID wiped out FY21-22. But: 200+ UDAN routes became unviable and were surrendered; average load factor on UDAN routes below 50%; VGF subsidy cost to government rising; SpiceJet and other airlines returned routes. No route has become commercially self-sustaining without subsidy.',
          noteHi: 'अक्टूबर 2016 में शुरू। 425+ रूट; 74 हवाई अड्डे/हेलीपोर्ट जुड़े। यात्री: 61 mn (FY14) → 152 mn (FY23)। लेकिन: 200+ UDAN रूट वापस किए — घाटे में; औसत load factor 50% से कम; कोई रूट बिना सब्सिडी के व्यावसायिक नहीं।',
        },
      ],
    },
    {
      name: 'Foreign Policy & Neighbourhood',
      nameHi: 'विदेश नीति और पड़ोसी',
      promises: [
        {
          promise: 'Neighbourhood First — prioritise relations with all South Asian neighbours; early personal diplomacy',
          promiseHi: 'नेबरहुड फर्स्ट — सभी दक्षिण एशियाई पड़ोसियों के साथ संबंध प्राथमिकता; शुरुआती व्यक्तिगत कूटनीति',
          status: 'partial',
          note: 'PM Modi invited all SAARC leaders to inauguration (May 2014) — unprecedented gesture. First-year visits to Bhutan, Nepal, Japan, Sri Lanka, Myanmar, Fiji, Australia. But India-Pakistan: Pathankot (Jan 2016), Uri (Sep 2016), Pulwama (Feb 2019) and Pahalgam (Apr 2025) attacks froze bilateral ties; SAARC summits called off since 2016. Pivot to BIMSTEC and SCO instead of SAARC. India-China: Galwan clashes (June 2020), LAC standoff unresolved (4-year face-off, partial disengagement 2024). Neighbourly ambition partially overwhelmed by security realities.',
          noteHi: 'SAARC नेताओं को उद्घाटन में आमंत्रण। पहले वर्ष: भूटान, नेपाल, श्रीलंका दौरे। लेकिन पाकिस्तान: पठानकोट, उरी, पुलवामा, पहलगाम — द्विपक्षीय ठंडा। SAARC 2016 के बाद कोई शिखर नहीं। चीन: गलवान 2020, LAC गतिरोध 4 साल।',
        },
        {
          promise: 'Act East Policy — upgrade Look East to active economic and security engagement with ASEAN and Indo-Pacific',
          promiseHi: 'एक्ट ईस्ट नीति — लुक ईस्ट को ASEAN और हिंद-प्रशांत के साथ सक्रिय आर्थिक और सुरक्षा जुड़ाव में बदलना',
          status: 'partial',
          note: 'Look East renamed Act East at ASEAN-India Summit (November 2014). India joined East Asia Summit as full member; hosted ASEAN-India Commemorative Summit (2018). Quad formalised at leader level (March 2021): India-US-Japan-Australia security dialogue. IMEEC (India-Middle East-Europe Economic Corridor) announced G20 2023. NE connectivity for Act East: Kaladan Multimodal Transit; Sittwe Port operational (2023); India-Myanmar-Thailand Trilateral Highway 70% complete. India-ASEAN trade: $98 bn (FY23). Gap: FTA renegotiation stalled since 2023; Rohingya crisis strained Myanmar relations; infrastructure timelines slipping.',
          noteHi: 'ASEAN-India शिखर नवंबर 2014 में नामकरण। Quad 2021 में नेता स्तर पर। IMEEC G20 2023। Sittwe पोर्ट 2023। ASEAN व्यापार $98 bn। लेकिन FTA पुनर्वार्ता रुकी; म्यांमार संकट।',
        },
        {
          promise: 'Permanent UNSC seat — lead the reform of the United Nations; secure India a permanent seat on the Security Council',
          promiseHi: 'स्थायी UNSC सीट — संयुक्त राष्ट्र में सुधार का नेतृत्व; सुरक्षा परिषद में स्थायी सीट',
          status: 'in-progress',
          note: 'India has championed UNSC reform at every G20, UNGA and bilateral summit. PM Modi proposed International Yoga Day at UNGA (September 2014) — adopted unanimously. India elected non-permanent UNSC member (2021-22). G4 (India, Germany, Japan, Brazil) continues reform push. However: P5 veto power means structural UN reform requires China and Russia consent — neither willing. No expansion of permanent members achieved. African Union got G20 seat (India-chaired G20 2023 achievement). Permanent UNSC seat remains aspirational with no concrete timeline.',
          noteHi: 'PM ने योग दिवस UNGA में प्रस्तावित (2014)। भारत गैर-स्थायी UNSC (2021-22)। G4 सुधार प्रयास जारी। लेकिन: P5 वीटो — चीन, रूस अनिच्छुक। स्थायी सीट — ठोस प्रगति नहीं।',
        },
      ],
    },
    {
      name: 'Science, Technology & Space',
      nameHi: 'विज्ञान, प्रौद्योगिकी और अंतरिक्ष',
      promises: [
        {
          promise: 'ISRO expansion — planetary missions, satellite constellation, commercialise space; world-class space programme',
          promiseHi: 'ISRO विस्तार — ग्रहीय मिशन, उपग्रह समूह, अंतरिक्ष वाणिज्यिकीकरण; विश्वस्तरीय अंतरिक्ष कार्यक्रम',
          status: 'implemented',
          note: 'Mangalyaan (Sep 2014): ₹450 crore — first Mars orbit on first attempt, globally unique. Chandrayaan-3 (Aug 23, 2023): first south-pole lunar landing. Aditya-L1 (Jan 2024): solar observatory at L1. IN-SPACe established 2020: 180+ private space companies licensed. PSLV-C58 and SpaDeX docking (2025). ISRO budget: ₹6,455 crore (FY24) — real terms modest but missions punching above weight. LVM3 commercial launches. Gaganyaan crewed mission on track for 2026. Commercial space-sector privatisation underway.',
          noteHi: 'मंगलयान (₹450 करोड़, पहले प्रयास में सफल)। चंद्रयान-3 (23 अगस्त 2023): दक्षिणी ध्रुव पर पहली लैंडिंग। आदित्य-L1 (जनवरी 2024)। IN-SPACe: 180+ निजी कंपनियां। gganyaan 2026।',
        },
        {
          promise: 'R&D investment — raise India\'s gross domestic R&D spend; build National Research Foundation',
          promiseHi: 'R&D निवेश — भारत का घरेलू R&D खर्च बढ़ाना; राष्ट्रीय अनुसंधान फाउंडेशन बनाना',
          status: 'in-progress',
          note: 'India\'s GERD (Gross Expenditure on R&D): 0.65% of GDP (2014) — virtually unchanged at 0.65% (2023). NRF Act passed 2023: ₹50,000 crore over 5 years (2023–28); PM chairs governing board. NRF Secretariat established 2024; first project calls issued. But actual disbursements negligible so far; India lags China (2.5% GDP), US (3.5% GDP), South Korea (4.9% GDP) massively on R&D intensity. Patent filings from India grew 2× but commercialisation rate below 5%.',
          noteHi: 'GERD: 0.65% GDP (2014 = 2023 — अपरिवर्तित)। NRF Act 2023: ₹50,000 करोड़। NRF सचिवालय 2024। लेकिन: चीन 2.5%, अमेरिका 3.5% — भारत बहुत पीछे। पेटेंट बढ़े, व्यावसायिकीकरण 5% से कम।',
        },
        {
          promise: 'Nuclear energy — fast-track civilian nuclear programme; Prototype Fast Breeder Reactor and new nuclear parks',
          promiseHi: 'परमाणु ऊर्जा — नागरिक परमाणु कार्यक्रम तेज; प्रोटोटाइप फास्ट ब्रीडर रिएक्टर और नए परमाणु पार्क',
          status: 'partial',
          note: 'Nuclear power: 6,780 MW (2014) → 7,480 MW (2024) — modest increase. Kudankulam Units 1–4 operational; Units 5–6 under construction. Prototype Fast Breeder Reactor (PFBR) at Kalpakkam: originally due 2004, delayed 20+ years; now expected to achieve criticality 2025. 10 new reactors approved (PHWR fleet). Civil nuclear deals expanded (US, France, Canada, Japan). Nuclear power share: 3.4% of generation — far below the 25% long-term goal. High capital cost and land acquisition hinder expansion.',
          noteHi: 'परमाणु: 6,780 MW → 7,480 MW। कुडनकुलम 1-4 चालू। PFBR कल्पक्कम: 2004 से देरी, अब 2025 में criticality संभव। 10 नए रिएक्टर मंजूर। पर हिस्सा: 3.4% — 25% दीर्घकालिक लक्ष्य दूर।',
        },
      ],
    },
    {
      name: 'Labour & Consumer Protection',
      nameHi: 'श्रम और उपभोक्ता संरक्षण',
      promises: [
        {
          promise: 'Labour codes — consolidate 44 central labour laws into 4 codes; ease compliance, extend social security',
          promiseHi: 'श्रम संहिताएं — 44 केंद्रीय श्रम कानूनों को 4 संहिताओं में समेकित करना; अनुपालन आसान, सामाजिक सुरक्षा विस्तार',
          status: 'in-progress',
          note: '4 Labour Codes passed by Parliament (2019–2020): Code on Wages, Industrial Relations Code, Social Security Code, OSH Code — consolidating 44 central laws. Structurally sound reform removing overlapping and contradictory provisions. But: central Rules notified; state Rules notified by only 13 states. Codes legally require both central and state rules to come into force. Effective date delayed multiple times — Codes still not in force as of 2026. ILO notes India\'s informal employment rate unchanged at ~90%; gig workers\' social security (Sec 114) not yet implemented.',
          noteHi: '4 श्रम संहिताएं 2019-20 में पारित। केंद्रीय नियम: अधिसूचित। राज्य नियम: केवल 13 राज्य। 2026 तक लागू नहीं। अनौपचारिक रोजगार: 90% — अपरिवर्तित।',
        },
        {
          promise: 'RERA — regulate real estate developers; protect homebuyers from delays, fraud and mis-selling',
          promiseHi: 'RERA — रियल एस्टेट डेवलपर्स को विनियमित करना; देरी, धोखाधड़ी और गलत बिक्री से घर खरीदारों की रक्षा',
          status: 'partial',
          note: 'Real Estate (Regulation and Development) Act passed May 2016; most states operational by 2017. 37 states/UTs with Real Estate Regulatory Authorities. 1.28 lakh projects and 87,000+ agents registered. Homebuyer wins: forced disclosure of project details, 70% escrow rule, penalty for delay. But CAG (2022): 38% of RERA tribunal orders unexecuted; average resolution time 210 days (RERA target: 60); several major builders in insolvency, buyers uncompensated. DDA and some public sector projects still exempt in some states. UP RERA most active; multiple North-East states RERA nominal.',
          noteHi: 'RERA मई 2016; 37 राज्य/UT। 1.28 लाख परियोजनाएं। CAG (2022): 38% आदेश अनिष्पादित; 210 दिन औसत। DDA कुछ राज्यों में छूट। UP RERA सक्रिय।',
        },
      ],
    },
    {
      name: 'Environment & Wildlife',
      nameHi: 'पर्यावरण और वन्यजीव',
      promises: [
        {
          promise: 'Tiger conservation — double tiger population; protect big-cat corridors and wildlife sanctuaries',
          promiseHi: 'बाघ संरक्षण — बाघ आबादी दोगुनी; बड़े शिकारी के गलियारे और वन्यजीव अभयारण्यों की सुरक्षा',
          status: 'implemented',
          note: 'Project Tiger: 53 Tiger Reserves covering 75,000 sq km. Tiger population: 1,411 (2006 census) → 3,167 (2022-23 all-India tiger census) — more than doubled; India holds 75% of world\'s wild tigers. Record MP: 785 tigers. Government met its "double by 2022" pledge from the 2010 St. Petersburg Declaration. But: encroachment in Sariska, Bandhavgarh, Corbett accelerating (NGT orders flouted); Bandhavgarh illegal coal mining inside reserve boundary (2024); human-tiger conflict: 104 tiger attacks (2023), rising; mining exemptions near corridors in multiple states.',
          noteHi: 'बाघ: 1,411 (2006) → 3,167 (2022-23) — दोगुने से अधिक। दुनिया के 75% जंगली बाघ। MP: 785। लेकिन: बांधवगढ़ में कोयला खनन; मानव-बाघ संघर्ष 104 हमले (2023)।',
        },
        {
          promise: 'National Clean Air Programme — bring all 131 polluted cities to safe air quality levels by 2024',
          promiseHi: 'राष्ट्रीय स्वच्छ वायु कार्यक्रम — 2024 तक 131 प्रदूषित शहरों को सुरक्षित वायु गुणवत्ता स्तर पर लाना',
          status: 'partial',
          note: 'National Clean Air Programme (NCAP) launched January 2019: 131 non-attainment cities; target 40% reduction in PM10/PM2.5 by 2024 (revised from 2024 to 2026). Measured reduction by 2024: 11–27% in monitored cities — below target. ₹5,800 crore disbursed; 8,000 CPCB monitoring stations. Progress in some cities (Varanasi, Surat) — poor in others. Delhi AQI exceeds "severe" threshold (>450) for 50–70 days/year; Gurgaon, Noida, Lucknow, Kanpur among world\'s 20 most polluted cities annually (IQAir). Biomass burning (UP/Punjab) unchanged; industrial source control inadequate.',
          noteHi: 'NCAP जनवरी 2019: 131 शहर; 40% कमी लक्ष्य (2024/2026)। वास्तविक: 11-27%। दिल्ली: 50-70 दिन "गंभीर"। IQAir: दुनिया के 20 सबसे प्रदूषित में भारतीय शहर।',
        },
        {
          promise: 'Ken-Betwa river link — first inter-basin water transfer to address water scarcity in Bundelkhand',
          promiseHi: 'केन-बेतवा नदी लिंक — बुंदेलखंड में जल संकट के लिए पहला अंतर-बेसिन जल स्थानांतरण',
          status: 'in-progress',
          note: 'Ken-Betwa Link Project (KBLP): ₹44,605 crore; 77 TMC water transfer from water-surplus Ken (MP) to water-deficit Betwa (UP-MP). Estimated benefit: irrigation to 10.62 lakh ha; drinking water to 62 lakh people. Project cleared: Union Cabinet February 2021; MoU between MP and UP signed 2021. Daudhan Dam construction started (2024). Wildlife concern: 10% of Panna Tiger Reserve will be submerged — NGT and SC took cognisance. Expected completion: 2031. First inter-linking project to reach construction after 25 years of planning.',
          noteHi: '₹44,605 करोड़; 77 TMC जल स्थानांतरण। 10.62 लाख हेक्टेयर सिंचाई। दौधन बांध निर्माण शुरू (2024)। लेकिन: पन्ना टाइगर रिजर्व का 10% जलमग्न। 2031 तक।',
        },
      ],
    },
    {
      name: 'Agriculture (Additional 2)',
      nameHi: 'कृषि (अतिरिक्त 2)',
      promises: [
        {
          promise: 'Soil Health Cards — every farmer receives a soil health card every 2 years to optimise input use',
          promiseHi: 'मृदा स्वास्थ्य कार्ड — हर किसान को हर 2 साल में मृदा स्वास्थ्य कार्ड — इनपुट उपयोग अनुकूलन',
          status: 'implemented',
          note: 'Launched February 2015. Phase 1 (2015–17): 10.73 crore SHCs distributed; Phase 2 (2017–19): 11.74 crore; Phase 3 ongoing. 2 lakh soil testing labs and sample collection centres established. Fertiliser use rationalised in covered areas: urea consumption reduced 8–10% where SHC recommendations followed. Micronutrient deficiency mapped nationally. World Bank cited as global best practice. Limitation: Many farmers receive cards without extension-worker guidance on interpretation; recommendation adoption rate ~40%.',
          noteHi: 'Phase 1: 10.73 करोड़; Phase 2: 11.74 करोड़। 2 लाख मृदा परीक्षण केंद्र। यूरिया उपयोग 8-10% कम। विश्व बैंक ने वैश्विक सर्वोत्तम पद्धति बताया। अनुशंसा अपनाने की दर ~40%।',
        },
        {
          promise: 'Mission for Integrated Development of Horticulture (MIDH) — make India\'s fruits and vegetables globally competitive',
          promiseHi: 'बागवानी एकीकृत विकास मिशन (MIDH) — भारत के फल और सब्जियों को वैश्विक रूप से प्रतिस्पर्धी बनाना',
          status: 'partial',
          note: '₹4,000+ crore/year. Horticulture output: 277 MT (2014) → 355 MT (2022-23), surpassing total foodgrain production. India is 2nd-largest global producer of fruits and vegetables. Horticulture now contributes 33%+ of agricultural GDP. Cluster Development Programme; Agri-export zones; APEDA export promotion. But post-harvest losses: 15–30% by commodity (ICAR unchanged); cold-chain deficit costs ₹1 lakh crore/year in losses. Horticulture exports $5.8 bn (FY23) — growing but a fraction of potential. Onion/tomato price crises recur every 2 years — no buffer stock mechanism.',
          noteHi: '₹4,000+ करोड़/वर्ष। उत्पादन 277 MT → 355 MT (2022-23)। GDP का 33%+। लेकिन: पोस्ट-हार्वेस्ट नुकसान 15-30%; हर 2 साल में प्याज/टमाटर संकट। निर्यात $5.8 bn।',
        },
      ],
    },
    {
      name: 'North-East Development',
      nameHi: 'पूर्वोत्तर विकास',
      promises: [
        {
          promise: 'Northeast connectivity — rail-road-air links to all 8 state capitals; make NE India\'s growth frontier',
          promiseHi: 'पूर्वोत्तर संपर्क — सभी 8 राज्य राजधानियों को रेल-सड़क-हवाई लिंक; पूर्वोत्तर को विकास अग्रभाग बनाना',
          status: 'partial',
          note: '94% of NE state capitals rail-connected by 2024 (from 70% in 2014). Historic: Imphal (Manipur) connected by rail — February 2024 (after ₹13,987 crore Jiribam-Imphal project, India\'s costliest-per-km rail line). Trans-Arunachal Highway: 2,000 km of 4-lane roads; 55% complete. Brahmaputra bridge at Bogibeel operational (2018). ₹2.25 lakh crore central investment in NE (2014–2024). Sittwe Port (Myanmar) operational 2023 — first connectivity link to SE Asia. Remaining gap: Arunachal Pradesh, Meghalaya, Mizoram connectivity still incomplete.',
          noteHi: '94% NE राज्य राजधानियां रेल से जुड़ीं। इंफाल (मणिपुर) रेल: फरवरी 2024 (₹13,987 करोड़)। ₹2.25 लाख करोड़ निवेश। Sittwe पोर्ट 2023। कुछ राज्य अभी अधूरे।',
        },
        {
          promise: 'PM DevINE and special focus on North-East — 100% central funding; dedicated development initiatives for all 8 states',
          promiseHi: 'PM DevINE और पूर्वोत्तर पर विशेष ध्यान — 100% केंद्रीय फंडिंग; सभी 8 राज्यों के लिए समर्पित विकास',
          status: 'partial',
          note: 'All Centrally Sponsored Schemes in NE: 90:10 Centre-State funding (vs 60:40 elsewhere). PM DevINE (Development Initiative for NE): ₹6,600 crore (2022–26), 100% central funding. DONER ministry budget: ₹3,219 crore (FY24). NE Special Infrastructure Development Scheme (NESIDS): roads, bridges. But NE per capita income still 75% of national average; youth unemployment highest nationally; Manipur ethnic violence (2023) set back development by estimated 2–3 years; security situation in Nagaland, Assam (AFSPA states) still constrains private investment.',
          noteHi: '90:10 फंडिंग। PM DevINE: ₹6,600 करोड़। DONER: ₹3,219 करोड़। लेकिन: प्रति व्यक्ति आय राष्ट्रीय का 75%; युवा बेरोजगारी सर्वाधिक; मणिपुर जातीय हिंसा (2023)।',
        },
      ],
    },
    {
      name: 'Financial Sector & Digital Economy',
      nameHi: 'वित्तीय क्षेत्र और डिजिटल अर्थव्यवस्था',
      promises: [
        {
          promise: 'Banking sector clean-up — resolve NPAs; recapitalise public-sector banks; merge to create stronger institutions',
          promiseHi: 'बैंकिंग क्षेत्र सुधार — NPA समाधान; सार्वजनिक क्षेत्र के बैंकों का पुनर्पूंजीकरण; मजबूत संस्थाएं बनाने के लिए विलय',
          status: 'partial',
          note: '4R strategy: Recognize, Resolve, Recapitalize, Reform. Gross NPA: 3.8% (2013) → 11.5% peak (2018) → 3.9% (2024). Bank recapitalization: ₹3.10 lakh crore (2017–21). PSB mergers: 27 PSBs → 12 (SBI + 5 associates 2017; 10 PSBs → 4 in 2020). Banks now profitable — SBI record profit (₹61,077 crore FY24). But ₹10 lakh crore NPAs written off (2014–2023) — most uncovered. Defaulters like Vijay Mallya, Nirav Modi, Mehul Choksi fled abroad; extradition incomplete. Wilful defaulter list: 2,600+ with ₹3.4 lakh crore outstanding.',
          noteHi: 'सकल NPA: 3.8% → 11.5% (2018) → 3.9% (2024)। पुनर्पूंजीकरण ₹3.10 लाख करोड़। 27 PSB → 12। SBI FY24 में ₹61,077 करोड़ लाभ। लेकिन: ₹10 लाख करोड़ NPA राइट-ऑफ; मल्या, नीरव मोदी विदेश में।',
        },
        {
          promise: 'UPI and digital payments — create world-class real-time payment infrastructure accessible to every Indian',
          promiseHi: 'UPI और डिजिटल भुगतान — हर भारतीय के लिए सुलभ विश्वस्तरीय रीयल-टाइम भुगतान बुनियादी ढांचा',
          status: 'implemented',
          note: 'Unified Payments Interface (UPI) launched April 2016 by NPCI. 117 bn transactions (FY24); ₹163 lakh crore transacted — 46% of the world\'s real-time payment volume. Jan Dhan-Aadhaar-Mobile (JAM) trinity underpins financial inclusion. RuPay card: 750 mn cards; accepted in UAE, Singapore, France, UK. UPI international: live in Singapore, UAE, Malaysia, Bahrain, Nepal, Bhutan, France, Mauritius, Sri Lanka. ONDC (Open Network for Digital Commerce) launched 2022. This is among the most successful digital public infrastructure achievements globally — widely cited by World Bank and IMF.',
          noteHi: 'UPI अप्रैल 2016। FY24: 117 अरब लेनदेन; ₹163 लाख करोड़। दुनिया का 46% रीयल-टाइम भुगतान। 10 देशों में UPI। ONDC 2022। विश्व बैंक/IMF द्वारा सर्वश्रेष्ठ DPI उदाहरण।',
        },
      ],
    },
    {
      name: 'SC / ST Welfare (2014)',
      nameHi: 'SC / ST कल्याण (2014)',
      promises: [
        {
          promise: 'Scheduled Castes Sub-Plan — dedicated ring-fenced budget allocation for SC welfare in proportion to SC population',
          promiseHi: 'अनुसूचित जाति उप-योजना — SC जनसंख्या के अनुपात में SC कल्याण के लिए समर्पित बजट',
          status: 'partial',
          note: 'SCSP allocation: ₹29,000 crore (FY14) → ₹83,000 crore (FY25) — near tripled in nominal terms. 5 earlier SC-specific schemes merged into PM-AJAY (Pradhan Mantri Anusuchit Jaati Abhyuday Yojana, 2021). Over 121 central schemes carry SCSP component. But NITI Aayog audit (2022): 22% of SCSP funds diverted or reverted to general pool; SC literacy rate improved but SC-general gap unchanged at 15 percentage points; SC poverty rate fell from 21% to 11% (2014–2022) but remains 2× general poverty rate. PM-AJAY implementation started slowly — only ₹900 crore released in first year.',
          noteHi: 'SCSP: ₹29,000 करोड़ → ₹83,000 करोड़। PM-AJAY में 5 योजनाएं। NITI: 22% धन दुरुपयोग। SC गरीबी: 21% → 11% (2022); अभी भी सामान्य का 2 गुना।',
        },
        {
          promise: 'Eklavya Model Residential Schools — quality school in every tribal sub-district with 50%+ ST population',
          promiseHi: 'एकलव्य आदर्श आवासीय विद्यालय — 50%+ ST जनसंख्या वाले हर आदिवासी उप-जिले में गुणवत्ता विद्यालय',
          status: 'partial',
          note: '690 EMRS sanctioned (updated target: all 740 sub-districts with 50%+ ST population). 400+ functional (2024); 1.8 lakh students enrolled. Standard: CBSE-affiliated, residential, free for ST children. Budget per school: ₹38 crore (revised up from ₹12 crore). Gap: 290 sanctioned schools still under construction or land-pending; teacher vacancy rate 35% in operational EMRS; quality varies widely — EMRS in Jharkhand, Odisha strong; Northeast and Rajasthan lagging. No independent learning-outcomes survey published.',
          noteHi: '690 EMRS स्वीकृत; 400+ चालू; 1.8 लाख छात्र। ₹38 करोड़/विद्यालय। अंतराल: 290 निर्माणाधीन; 35% शिक्षक रिक्तियां।',
        },
        {
          promise: 'PM Janman / PVTG welfare — protect India\'s most vulnerable 75 tribal groups; housing, health, roads in unreached villages',
          promiseHi: 'PVTG कल्याण — भारत के सबसे कमजोर 75 जनजातीय समूहों की रक्षा; अनछुए गांवों में आवास, स्वास्थ्य, सड़क',
          status: 'in-progress',
          note: 'Specifically re-launched as PM JANMAN (₹24,104 crore, Nov 2023) — covered in 2024 section. 2014 manifesto origin: dedicated PVTG protection and dignity-based development. Pre-JANMAN (2014-23): Van Dhan Kendras, tribal health and EMRS helped some PVTGs. But all India PVTG mapping only completed in 2021; 2.8 lakh PVTG households still lacked road access in 2023; isolation maintained for Particularly Vulnerable groups in Andaman (Sentinelese, etc.) — protected against contact. PM JANMAN is the delivery vehicle for this 2014-era promise.',
          noteHi: '2014 संकल्प पत्र में PVTG संरक्षण। 2023 में PM JANMAN (₹24,104 करोड़) रूप में पुनः शुरू। 2.8 लाख PVTG परिवारों को 2023 तक सड़क नहीं। PM JANMAN वितरण वाहन।',
        },
      ],
    },
  ],
};

// ── 2019 Manifesto ────────────────────────────────────────────────────────────
const MANIFESTO_2019: ManifestoYear = {
  year: 2019,
  title: 'Sankalp Patra 2019',
  titleHi: 'संकल्प पत्र 2019',
  tagline: 'Phir Ek Bar, Modi Sarkar — 75 promises for India@75',
  taglineHi: 'फिर एक बार, मोदी सरकार — India@75 के लिए 75 वादे',
  sourceUrl: 'https://www.bjp.org/manifesto',
  categories: [
    {
      name: 'Constitutional & Ideological',
      nameHi: 'संवैधानिक और वैचारिक',
      promises: [
        {
          promise: 'Abrogate Article 370 and annul Article 35A in J&K',
          promiseHi: 'J&K में अनुच्छेद 370 निरसन और अनुच्छेद 35A रद्द करना',
          status: 'implemented',
          note: 'Delivered within 3 months of election victory. SC upheld it unanimously (Dec 2023). J&K statehood promised by PM in Parliament — not yet restored as of 2026. Ladakh remains without a legislature, contrary to PM\'s assurance to Leh leaders.',
          noteHi: 'चुनाव जीत के 3 महीने में पूरा। SC ने दिसंबर 2023 में सर्वसम्मति से बरकरार रखा। J&K राज्य का दर्जा PM ने संसद में वादा किया — 2026 तक बहाल नहीं। लद्दाख बिना विधायिका।',
        },
        {
          promise: 'Citizenship Amendment Act — fast-track citizenship for persecuted minorities from 3 neighbours',
          promiseHi: 'नागरिकता संशोधन अधिनियम — 3 पड़ोसी देशों के उत्पीड़ित अल्पसंख्यकों को नागरिकता',
          status: 'implemented',
          note: 'CAA passed December 2019; rules took 4.5 years to notify (March 2024) amid nationwide Shaheen Bagh protests. SC challenge still pending. Fewer than 300 citizenship certificates issued under CAA as of 2025. Critics argue the religion-based criteria violates Article 14.',
          noteHi: 'CAA दिसंबर 2019; नियम 4.5 साल बाद मार्च 2024 में — शाहीन बाग जैसे देशव्यापी विरोध के बीच। SC चुनौती लंबित। 2025 तक 300 से कम नागरिकता प्रमाण पत्र जारी।',
        },
        {
          promise: 'Uniform Civil Code — implement UCC across India',
          promiseHi: 'समान नागरिक संहिता — पूरे भारत में UCC लागू करना',
          status: 'pending',
          note: 'Law Commission published a report (Aug 2023) recommending against a uniform national code. Uttarakhand enacted India\'s first state-level UCC (March 2024). No bill tabled in Parliament as of 2026. NDA allies JD(U) and TDP have reservations — the absence of a bill signals political caution over constitutional will.',
          noteHi: 'विधि आयोग ने एकसमान राष्ट्रीय संहिता के विरुद्ध सिफारिश की (अगस्त 2023)। उत्तराखंड: भारत का पहला राज्य-स्तरीय UCC (मार्च 2024)। 2026 तक संसद में कोई विधेयक नहीं। NDA सहयोगी JD(U) और TDP को आपत्ति।',
        },
        {
          promise: 'Ram Temple — facilitate expeditious construction in Ayodhya',
          promiseHi: 'राम मंदिर — अयोध्या में शीघ्र निर्माण में सहायता',
          status: 'implemented',
          note: 'SC 5:0 verdict (Nov 2019) settled a 70-year dispute. PM Modi consecrated the completed temple January 22, 2024 — watched by ~70 crore TV viewers. ₹3,200 crore in donations received. Full temple complex construction continues.',
          noteHi: 'SC 5:0 फैसला (नवंबर 2019) ने 70 साल विवाद सुलझाया। PM ने 22 जनवरी 2024 को प्राण प्रतिष्ठा — ~70 करोड़ TV दर्शक। ₹3,200 करोड़ दान। पूर्ण मंदिर परिसर निर्माण जारी।',
        },
        {
          promise: 'National Register of Citizens (NRC) — nationwide exercise after Assam',
          promiseHi: 'राष्ट्रीय नागरिक रजिस्टर (NRC) — असम के बाद देशव्यापी अभ्यास',
          status: 'not-fulfilled',
          note: 'Assam NRC (Aug 2019) excluded 19 lakh people — including many verified Hindus — embarrassing BJP. Home Minister\'s promise of a nationwide NRC quietly shelved. CAA-NRC linkage raised fears of statelessness; both exercises frozen since 2020. No fresh timeline stated.',
          noteHi: 'असम NRC (2019) ने 19 लाख को बाहर किया — कई सत्यापित हिंदुओं सहित — BJP के लिए शर्मनाक। गृह मंत्री का राष्ट्रव्यापी NRC वादा चुपचाप टाला। 2020 से दोनों अभ्यास रोके हुए।',
        },
      ],
    },
    {
      name: 'Economy & Development',
      nameHi: 'अर्थव्यवस्था और विकास',
      promises: [
        {
          promise: '$5 trillion economy by 2024-25',
          promiseHi: '2024-25 तक $5 ट्रिलियन अर्थव्यवस्था',
          status: 'not-fulfilled',
          note: 'GDP reached ~$3.9 trillion (FY25) — $1.1T short. COVID\'s 6.6% contraction (FY21) wiped ~$400B from the trajectory. India is now the world\'s 5th largest economy and fastest-growing major economy, but the $5T milestone is now expected around FY28.',
          noteHi: 'GDP ~$3.9 ट्रिलियन (FY25) — लक्ष्य से $1.1T कम। COVID की 6.6% गिरावट (FY21) ने ~$400B खोए। भारत दुनिया की 5वीं सबसे बड़ी अर्थव्यवस्था, $5T FY28 तक संभव।',
        },
        {
          promise: 'Double the length of National Highways by 2022',
          promiseHi: '2022 तक राष्ट्रीय राजमार्गों की लंबाई दोगुनी करना',
          status: 'partial',
          note: 'Network grew 96,000 → 1,45,155 km (51% increase vs 100% promised). Construction pace tripled: 37 km/day (FY24) vs 12 km/day (2014). Bharatmala Phase 1: 60% complete. Doubling required 192,000 km by 2022 — missed by 47,000 km.',
          noteHi: 'नेटवर्क 96,000 → 1,45,155 km (100% वादे के मुकाबले 51% वृद्धि)। निर्माण गति तिगुनी: 37 km/दिन (FY24)। भारतमाला Phase 1: 60% पूर्ण। 2022 तक 1,92,000 km चाहिए था — 47,000 km कम।',
          cagVerdict: 'CAG Report No. 19 of 2023 (Bharatmala Pariyojana Phase I): Project cost nearly doubled from ₹5.35 lakh crore to ₹10.64 lakh crore (99% escalation) with no revised Parliamentary approval; only 27% of Phase 1 work completed by the original 2022 deadline; land acquisition delays affected 60% of projects; DPRs approved without completing mandatory environmental and traffic studies.',
          cagVerdictHi: 'CAG रिपोर्ट 19/2023 (भारतमाला परियोजना चरण I): लागत ₹5.35 लाख करोड़ से ₹10.64 लाख करोड़ (99% वृद्धि) — संसदीय अनुमोदन नहीं; 2022 की मूल समयसीमा तक Phase 1 का केवल 27% पूर्ण; 60% परियोजनाओं में भूमि अधिग्रहण देरी; पर्यावरण और यातायात अध्ययन किए बिना DPR मंजूर।',
          cagAmountCrore: 529000,
          cagSource: 'https://cag.gov.in/en/audit-report/details/119177',
        },
        {
          promise: 'Double farmers\' income by 2022',
          promiseHi: '2022 तक किसानों की आय दोगुनी करना',
          status: 'not-fulfilled',
          note: 'Same goal as 2014, same outcome. Real income grew ~35% over 7 years vs 100% target. The 3 contentious farm laws meant to improve market access were repealed under protest (Dec 2021). No replacement policy or fresh income-doubling roadmap announced.',
          noteHi: 'वही लक्ष्य, वही परिणाम। वास्तविक आय 7 वर्षों में ~35% बनाम 100% लक्ष्य। 3 कृषि कानून किसान आंदोलन के बाद वापस (दिसंबर 2021)। कोई नई आय दोगुनी नीति नहीं।',
        },
        {
          promise: 'PM-KISAN — ₹6,000/year direct income support to all small and marginal farmers',
          promiseHi: 'PM-किसान — सभी छोटे और सीमांत किसानों को ₹6,000/वर्ष प्रत्यक्ष आय सहायता',
          status: 'implemented',
          note: 'Announced in interim Budget February 2019 and re-promised in the 2019 manifesto. 19 instalments released through 2024; ₹3.24 lakh crore transferred to 11.4 crore farmer accounts. Direct benefit to small landholders previously excluded from agricultural subsidies. Key gap: scheme excludes tenant farmers and agricultural labourers — estimated 14 crore+ of the most economically precarious farm workers. World Bank notes affluent landowners are also enrolled. PM-KISAN has not been inflation-indexed since 2019.',
          noteHi: 'फरवरी 2019 अंतरिम बजट में घोषित। 19 किस्तें; 11.4 करोड़ किसानों को ₹3.24 लाख करोड़। कमी: 14 करोड़+ काश्तकार और कृषि मजदूर बाहर — सबसे कमजोर वर्ग। 2019 से मुद्रास्फीति-अनुक्रमित नहीं।',
        },
        {
          promise: 'Ease of Doing Business — improve regulatory environment to attract investment and formal employment',
          promiseHi: 'व्यापार सुगमता — निवेश और औपचारिक रोजगार के लिए नियामक वातावरण सुधारना',
          status: 'implemented',
          note: 'India\'s World Bank EODB ranking improved from 142 (2014) to 63 (2019) — a 79-place jump, the largest by any major economy in 5 years. Key reforms: GST, IBC (Insolvency & Bankruptcy Code 2016), RERA 2016, single-window industrial clearance. World Bank discontinued the EODB index in 2021 due to data integrity concerns. Post-EODB independent assessments (e.g. WEF, WJP) show mixed progress: logistics and contract enforcement remain weak; labour law reforms passed but yet to take effect uniformly.',
          noteHi: 'EODB रैंक 142 (2014) → 63 (2019) — 5 वर्षों में 79 स्थान का सबसे बड़ी छलांग। सुधार: GST, IBC 2016, RERA 2016। विश्व बैंक ने 2021 में EODB बंद किया। WEF और WJP: लॉजिस्टिक्स और अनुबंध प्रवर्तन अभी कमजोर।',
        },
        {
          promise: 'Insolvency and Bankruptcy Code — time-bound resolution of corporate distress; recover bank NPA',
          promiseHi: 'दिवालिया और दिवालियापन संहिता — कॉर्पोरेट संकट का समयबद्ध समाधान; बैंक NPA वसूली',
          status: 'partial',
          note: 'IBC enacted May 2016. ₹3.16 lakh crore recovered by banks by FY24 through IBC proceedings (IBBI data). Gross NPA of scheduled commercial banks fell from 11.5% (2018 peak) to 3.9% (2024). But average resolution timeline is 653 days vs 330-day statutory limit — 2× overrun. Tribunals (NCLT) severely understaffed: only 63 benches vs 202 sanctioned. Real-estate cases dominate and face the longest delays.',
          noteHi: 'IBC मई 2016। FY24 तक ₹3.16 लाख करोड़ वसूली। सकल NPA 11.5% (2018) → 3.9% (2024)। लेकिन औसत समाधान 653 दिन बनाम 330 दिन की सीमा। NCLT: 63 बेंच बनाम 202 स्वीकृत — गंभीर कमी।',
        },
        {
          promise: 'PM Gati Shakti — national infrastructure pipeline (₹102 lakh crore) with GIS-integrated multi-ministry planning',
          promiseHi: 'PM गति शक्ति — राष्ट्रीय अवसंरचना पाइपलाइन (₹102 लाख करोड़), GIS-एकीकृत बहु-मंत्रालय योजना',
          status: 'partial',
          note: 'National Infrastructure Pipeline (NIP) announced December 2019: ₹102 lakh crore across 7,400+ projects (2020–2025) in roads, railways, power, urban, water and digital. PM Gati Shakti master-plan portal launched October 2021: integrates 16 ministries on a GIS platform for coordinated project planning. By FY24: ₹43+ lakh crore invested against the ₹102 lakh crore target — 42% of 5-year plan in 4 years; infrastructure spend as % of GDP reached 5.9% (FY24) vs 4.5% (2014). Original ₹102 lakh crore target for FY26 will likely not be met in full.',
          noteHi: 'NIP दिसंबर 2019: ₹102 लाख करोड़, 7,400+ परियोजनाएं। PM गति शक्ति अक्टूबर 2021: 16 मंत्रालय GIS पर। FY24 तक ₹43+ लाख करोड़ निवेश। बुनियादी ढांचा खर्च GDP का 5.9% (2014 में 4.5%)। FY26 का ₹102 लाख करोड़ लक्ष्य पूरी तरह पूरा होना मुश्किल।',
        },
        {
          promise: '100% rail electrification — electrify entire broad-gauge rail network to eliminate diesel traction and cut costs',
          promiseHi: '100% रेल विद्युतीकरण — डीजल ट्रैक्शन खत्म करने और लागत घटाने के लिए सम्पूर्ण ब्रॉड-गेज रेल नेटवर्क का विद्युतीकरण',
          status: 'implemented',
          note: 'BG electrification: 22% (2014) → 97% route-km (March 2024); Indian Railways announced 100% electrification of commercial BG network achieved in FY24. India is now the world\'s largest electrified railway by operational route km. Energy savings: ₹15,000+ crore/year compared to equivalent diesel traction. Caveat: a small number of mountain railway sections (Darjeeling, Nilgiri, Kalka–Shimla) and isolated branch lines retain steam/diesel for technical or heritage reasons.',
          noteHi: 'BG विद्युतीकरण: 22% (2014) → 97% (मार्च 2024); FY24 में 100% घोषित। दुनिया का सबसे बड़ा विद्युतीकृत रेलवे। ₹15,000+ करोड़/वर्ष ऊर्जा बचत। कुछ पहाड़ी/धरोहर सेक्शन अभी भी डीजल/भाप।',
        },
      ],
    },
    {
      name: 'Health & Welfare',
      nameHi: 'स्वास्थ्य और कल्याण',
      promises: [
        {
          promise: 'Ayushman Bharat PMJAY — ₹5 lakh health cover for 10.74 crore families',
          promiseHi: 'आयुष्मान भारत PMJAY — 10.74 करोड़ परिवारों को ₹5 लाख स्वास्थ्य बीमा',
          status: 'partial',
          note: '7.4 crore cards issued; 6.7 crore claims settled at 29,000+ empanelled hospitals — genuine cashless care for poor families. But CAG (2023): 88,000 claims for deceased patients; patients "admitted" to multiple hospitals simultaneously; ₹14,000 crore in claims vs ₹9,300 crore premium collected.',
          noteHi: '7.4 करोड़ कार्ड; 29,000+ अस्पतालों में 6.7 करोड़ दावे — गरीबों के लिए वास्तविक कैशलेस देखभाल। लेकिन CAG (2023): 88,000 मृत मरीजों के दावे; एक साथ कई अस्पतालों में भर्ती; ₹14,000 करोड़ दावे बनाम ₹9,300 करोड़ प्रीमियम।',
          cagVerdict: 'CAG Report No. 11 of 2023 (AB-PMJAY Performance Audit): Claims filed for 88,000+ dead patients; patients shown admitted in multiple hospitals simultaneously; admissions exceeding declared bed strength; ₹1.2 crore paid to ineligible hospitals.',
          cagVerdictHi: 'CAG रिपोर्ट 11/2023 (AB-PMJAY प्रदर्शन ऑडिट): 88,000+ मृत मरीजों के दावे; मरीज एक साथ कई अस्पतालों में भर्ती दिखाए; घोषित बेड क्षमता से अधिक भर्ती; अयोग्य अस्पतालों को ₹1.2 करोड़ भुगतान।',
          cagSource: 'https://cag.gov.in/en/audit-report/details/119060',
        },
        {
          promise: 'Housing for all by 2022 — complete the PMAY mission',
          promiseHi: '2022 तक सबके लिए आवास — PMAY मिशन पूरा करना',
          status: 'partial',
          note: '2022 deadline missed; extended to 2024, then further. ~2.35 crore completed. Budget 2024 added 3 crore new homes. CAG (2024): 35–38% incomplete, ₹600 crore paid without construction, structural defects in 22–24% of "completed" houses — systemic accountability gaps unresolved.',
          noteHi: '2022 समयसीमा चूकी; 2024 तक बढ़ाई। ~2.35 करोड़ पूर्ण। बजट 2024 में 3 करोड़ नए। CAG (2024): 35–38% अधूरे, ₹600 करोड़ बिना निर्माण, 22–24% में संरचनात्मक दोष — जवाबदेही खाई अभी भी है।',
          cagVerdict: 'CAG Report No. 8 of 2025 (PMAY-G Performance Audit): 35–38% of PMAY-G houses incomplete; payment fraud ₹420–600 crore; structural deficiencies in 22–24% of completed houses.',
          cagVerdictHi: 'CAG रिपोर्ट 8/2025 (PMAY-G प्रदर्शन ऑडिट): 35-38% PMAY-G मकान अधूरे; भुगतान धोखाधड़ी ₹420-600 करोड़; 22-24% पूर्ण मकानों में संरचनात्मक दोष।',
          cagAmountCrore: 600,
          cagSource: 'https://cag.gov.in/uploads/download_audit_report/2025/ES_PA_PMAY-ReportNo-8_English_05-15-2025-signed-copy-4-0694bb7331cf6a9.85852145.pdf',
        },
        {
          promise: 'Jal Jeevan Mission — piped water to every rural household by 2024',
          promiseHi: 'जल जीवन मिशन — 2024 तक हर ग्रामीण घर में नल से जल',
          status: 'partial',
          note: 'Genuine scale: 17% → 78% coverage in 5 years — 14 crore connections added. But 2024 deadline missed (22% still unconnected). CAG (Gujarat, 2024): 68% of "functional" connections failed the 55 LPCD/8-hour standard. Water quality untested in thousands of villages; deadline extended to 2026.',
          noteHi: 'वास्तविक पैमाना: 17% → 78% कवरेज 5 वर्षों में — 14 करोड़ कनेक्शन। लेकिन 2024 समयसीमा चूकी (22% अभी भी बिना)। CAG (गुजरात 2024): 68% "कार्यात्मक" कनेक्शन 55 LPCD मानक में विफल। हजारों गांवों में जल गुणवत्ता परीक्षण नहीं।',
          cagVerdict: 'CAG / JJM Functionality Assessment (Gujarat, 2024): 68% of claimed connections failed the functional standard (quantity/duration test); ₹2,820 crore infrastructure found inadequate; water quality not tested in many villages.',
          cagVerdictHi: 'CAG / JJM कार्यात्मकता आकलन (गुजरात, 2024): 68% दावा किए गए कनेक्शन कार्यात्मक मानक में विफल; ₹2,820 करोड़ का बुनियादी ढांचा अपर्याप्त पाया; कई गांवों में जल गुणवत्ता परीक्षण नहीं।',
          cagAmountCrore: 2820,
          cagSource: 'https://jaljeevanmission.gov.in/functionality-report-2024',
        },
        {
          promise: 'Ayushman Bharat Digital Mission (ABDM) — unique health ID for every citizen, linked digital health records',
          promiseHi: 'आयुष्मान भारत डिजिटल मिशन (ABDM) — हर नागरिक के लिए स्वास्थ्य ID, डिजिटल स्वास्थ्य रिकॉर्ड',
          status: 'in-progress',
          note: 'National Digital Health Mission launched August 2020 (PM\'s Independence Day address), rebranded ABDM 2021. 67 crore Ayushman Bharat Health Accounts (ABHA IDs) created (2024); 9.4 lakh health facilities and 4.5 lakh+ doctors registered. But active usage is low: linked health records (PHR) used in fewer than 5% of patient encounters; hospital IT integration sporadic; data privacy framework under DPDP Act 2023 not yet fully operationalised for health data; no independent assessment of actual continuity-of-care benefit.',
          noteHi: 'राष्ट्रीय डिजिटल स्वास्थ्य मिशन अगस्त 2020 में। 67 करोड़ ABHA ID; 9.4 लाख स्वास्थ्य सुविधाएं पंजीकृत। लेकिन सक्रिय उपयोग: 5% से कम रोगी मुठभेड़ों में। DPDP Act 2023 के तहत स्वास्थ्य डेटा गोपनीयता ढांचा अभी पूर्ण नहीं।',
        },
      ],
    },
    {
      name: 'Security & Social',
      nameHi: 'सुरक्षा और सामाजिक',
      promises: [
        {
          promise: 'Triple Talaq law — criminalise instant triple talaq',
          promiseHi: 'तीन तलाक कानून — तत्काल तीन तलाक को अपराध घोषित करना',
          status: 'implemented',
          note: 'Muslim Women (Protection of Rights on Marriage) Act passed July 2019 — made instant talaq a cognisable, non-bailable offence with up to 3-year imprisonment. SC had already struck the practice down in 2017 (Shayara Bano). 574 arrests made 2019–2023; women\'s groups report mixed impact.',
          noteHi: 'मुस्लिम महिला (विवाह अधिकार संरक्षण) अधिनियम जुलाई 2019 — तत्काल तलाक संज्ञेय अपराध, 3 साल जेल। SC ने 2017 में पहले ही अमान्य किया था (शायरा बानो)। 2019–2023 में 574 गिरफ्तारियां।',
        },
        {
          promise: 'OROP — One Rank One Pension for defence veterans',
          promiseHi: 'OROP — रक्षा दिग्गजों के लिए समान रैंक समान पेंशन',
          status: 'partial',
          note: 'OROP implemented Nov 2015 after prolonged ex-servicemen protests at Jantar Mantar. Dispute: government used a "5-year average" definition instead of genuine year-on-year parity. SC intervened (2022); ₹8,450 crore arrears paid. Ex-servicemen associations still report residual gaps in several ranks.',
          noteHi: 'OROP नवंबर 2015 में जंतर मंतर विरोध के बाद लागू। विवाद: सरकार ने "5 वर्षीय औसत" परिभाषा इस्तेमाल की। SC हस्तक्षेप (2022); ₹8,450 करोड़ बकाया भुगतान। कई रैंकों में कमियां अभी भी।',
        },
      ],
    },
    {
      name: 'Science & Space',
      nameHi: 'विज्ञान और अंतरिक्ष',
      promises: [
        {
          promise: 'Gaganyaan — India\'s first crewed spaceflight: send Indian astronauts to space by 2022',
          promiseHi: 'गगनयान — भारत की पहली मानव अंतरिक्ष उड़ान: 2022 तक भारतीय अंतरिक्ष यात्री',
          status: 'in-progress',
          note: '₹9,023 crore mission. Original target: August 2022 (75th Independence Day); delayed repeatedly. TV-D1 abort-system test: success October 2023. Unmanned Gaganyaan G1 mission: now expected 2025; crewed mission: 2026. Four Gaganauts (Gp. Capt. Shukla, et al.) trained in Russia. Alongside, ISRO achieved landmark milestones: Chandrayaan-3 became world\'s first mission to land near Moon\'s south pole (Aug 23, 2023); Aditya-L1 solar observatory entered halo orbit (Jan 2024); SpaDeX docking demonstration (2025). Space sector privatised: IN-SPACe established 2020; 180+ private space startups.',
          noteHi: '₹9,023 करोड़। मूल: अगस्त 2022 → अब 2026। TV-D1 परीक्षण: सफल अक्टूबर 2023। 4 गगनयात्री रूस में प्रशिक्षित। साथ में: चंद्रयान-3 — दक्षिणी ध्रुव पर पहली लैंडिंग (23 अगस्त 2023); आदित्य-L1 (जनवरी 2024); SpaDeX डॉकिंग (2025)।',
        },
      ],
    },
    {
      name: 'Manufacturing & Defence',
      nameHi: 'विनिर्माण और रक्षा',
      promises: [
        {
          promise: 'Defence manufacturing corridors — UP and Tamil Nadu corridors to anchor indigenisation and exports',
          promiseHi: 'रक्षा विनिर्माण गलियारे — स्वदेशीकरण और निर्यात के लिए UP और तमिलनाडु गलियारे',
          status: 'in-progress',
          note: 'Two corridors notified 2018: Uttar Pradesh (Lucknow–Agra–Aligarh–Jhansi–Kanpur–Chitrakoot) and Tamil Nadu (Chennai–Coimbatore–Tiruchirappalli–Dindigul–Salem–Hosur). UP corridor: ₹50,000 crore investment target; ₹26,000+ crore committed (2024); 100+ defence units operational. TN corridor: ₹20,000 crore target; ₹8,000+ crore committed; 60+ units. Key anchors: DRDO, BEL, Bharat Forge, BrahMos, Mahindra, Tata. No defence exports have been specifically attributed to corridor production yet; corridor contribution to overall ₹21,000 crore export figure not separately tracked.',
          noteHi: 'UP और TN में दो गलियारे 2018 में। UP: ₹26,000+ करोड़ प्रतिबद्ध, 100+ इकाइयां। TN: ₹8,000+ करोड़, 60+ इकाइयां। प्रमुख: DRDO, BEL, BrahMos। गलियारे से रक्षा निर्यात अभी तक अलग से नहीं गिना।',
        },
      ],
    },
    {
      name: 'Agriculture (Additional)',
      nameHi: 'कृषि (अतिरिक्त)',
      promises: [
        {
          promise: '10,000 Farmer Producer Organisations (FPOs) by 2024 — give small farmers collective market power',
          promiseHi: '2024 तक 10,000 किसान उत्पादक संगठन (FPOs) — छोटे किसानों को सामूहिक बाजार शक्ति',
          status: 'partial',
          note: '₹6,865 crore equity-grant scheme via SFAC and NABARD; 7,000+ FPOs registered by 2024. But CAG (2022): only 40% of registered FPOs actively trading; majority lack cold storage, processing or credit linkage. Target of 10,000 by March 2024 not met. Most FPOs handle <10% of their members\' produce. Quality far below quantity achieved.',
          noteHi: '₹6,865 करोड़ योजना; 7,000+ FPO पंजीकृत। CAG (2022): केवल 40% सक्रिय रूप से व्यापार कर रहे; बहुमत में शीत भंडारण, प्रसंस्करण या ऋण संपर्क नहीं। 10,000 का लक्ष्य मार्च 2024 तक नहीं पूरा।',
        },
        {
          promise: 'PM Matsya Sampada Yojana — Blue Revolution: double fish production, modernise fisheries',
          promiseHi: 'PM मत्स्य संपदा योजना — नीली क्रांति: मछली उत्पादन दोगुना, मत्स्य पालन का आधुनिकीकरण',
          status: 'partial',
          note: 'Launched 2020: ₹20,050 crore over 5 years — largest-ever fisheries investment. Fish production: 9.5 MT (FY14) → 17.5 MT (FY24), making India the world\'s 3rd-largest producer. Aquaculture infrastructure, cold chain, seaweed, ornamental fish developed. Exports: ₹60,524 crore (FY23). But: 90%+ of fishers still operate informally; small-scale marine fishers largely excluded from scheme benefits; cold chain coverage below 40% of coastal landing centres.',
          noteHi: '₹20,050 करोड़; मछली उत्पादन 9.5 MT → 17.5 MT (FY24), दुनिया का तीसरा सबसे बड़ा। निर्यात ₹60,524 करोड़। लेकिन: 90%+ मछुआरे अनौपचारिक; छोटे समुद्री मछुआरे बाहर; 40% से कम लैंडिंग केंद्रों पर कोल्ड चेन।',
        },
        {
          promise: 'Zero Budget Natural Farming — transition farmers to chemical-free, low-cost farming methods',
          promiseHi: 'शून्य बजट प्राकृतिक खेती — किसानों को रासायनिक मुक्त, कम लागत खेती में लाना',
          status: 'in-progress',
          note: 'PM announced ZBNF in Budget 2019. Renamed Bharatiya Prakritik Krishi Paddhati (BPKP) under Paramparagat Krishi Vikas Yojana. 25 lakh farmers trained (2024); ~7.5 lakh actively practising it. Andhra Pradesh state programme (APCNF) — independent of Centre — reached 7 lakh farmers and showed genuine yield-cost benefits. Central scheme coverage is thin: 7.5 lakh vs ~12 crore cultivator households. Scientific evidence on productivity outcomes mixed.',
          noteHi: 'बजट 2019 में घोषणा। BPKP के रूप में नामांकित। 25 लाख प्रशिक्षित; ~7.5 लाख अभ्यास कर रहे। AP राज्य कार्यक्रम ने 7 लाख किसानों तक पहुंच और वास्तविक लाभ दिखाया। केंद्रीय योजना कमजोर: 12 करोड़ काश्तकारों में से 7.5 लाख।',
        },
        {
          promise: 'PM Kisan Sampada Yojana — mega food parks and cold chain to cut post-harvest losses',
          promiseHi: 'PM किसान संपदा योजना — पोस्ट-हार्वेस्ट नुकसान घटाने के लिए मेगा फूड पार्क और कोल्ड चेन',
          status: 'partial',
          note: '₹8,100 crore scheme: 42 Mega Food Parks approved (34 operational); 353 cold-chain projects; 61 Agro-Processing Clusters. Annual food processing sector growth: 11% CAGR (2015–2023); value addition to agri output improved. But post-harvest losses persist at 4–16% by commodity (ICAR estimate unchanged since 2015). Cold-chain capacity covers ~25% of India\'s perishable produce. Small farmers\' linkage to parks minimal.',
          noteHi: '₹8,100 करोड़: 42 मेगा फूड पार्क (34 चालू); 353 कोल्ड चेन। खाद्य प्रसंस्करण 11% CAGR। लेकिन पोस्ट-हार्वेस्ट नुकसान 4-16% — 2015 से अपरिवर्तित। कोल्ड चेन: 25% उत्पाद। छोटे किसानों की भागीदारी न्यूनतम।',
        },
      ],
    },
    {
      name: 'Education, Youth & Sports',
      nameHi: 'शिक्षा, युवा और खेल',
      promises: [
        {
          promise: 'New Education Policy — overhaul India\'s 34-year-old education framework; mother-tongue learning, vocational integration',
          promiseHi: 'नई शिक्षा नीति — भारत की 34 साल पुरानी शिक्षा व्यवस्था में बदलाव; मातृभाषा शिक्षा, व्यावसायिक एकीकरण',
          status: 'partial',
          note: 'NEP 2020 approved July 2020 — most comprehensive education overhaul since 1986. Key changes: 5+3+3+4 structure, mother-tongue medium to Grade 5, 10+2 board structure replaced, vocational from Grade 6, academic bank of credits, multidisciplinary HEIs. Implementation: uneven and slow. As of 2024: only 18 states partially adopted NEP in school stage; National Curriculum Framework released (2023) but state adoptions lag; teacher training (5 crore teachers to be retrained) barely started; budget allocation for NEP implementation below expert recommendations.',
          noteHi: 'NEP 2020: 1986 के बाद सबसे बड़ा सुधार। 5+3+3+4, मातृभाषा, व्यावसायिक शिक्षा। 2024 तक: केवल 18 राज्यों ने आंशिक रूप से अपनाया; शिक्षक प्रशिक्षण (5 करोड़) मुश्किल से शुरू।',
        },
        {
          promise: 'Khelo India — build grassroots sports ecosystem; produce Olympic champions',
          promiseHi: 'खेलो इंडिया — जमीनी स्तर पर खेल पारिस्थितिकी तंत्र; ओलंपिक चैंपियन तैयार करना',
          status: 'partial',
          note: '₹8,750 crore scheme; annual Khelo India Youth Games and University Games since 2018/2020. 2,580 Khelo India athletes identified and receiving ₹6.5 lakh/year stipend (2024). National Sports Universities established (Manipur, 2018). India sent 117 athletes to Paris 2024 — largest ever — won 6 medals (0 gold; ranked 71st). Target: Top 10 at 2028 Olympics remains extremely ambitious. Sports infrastructure built: 1,000+ Khelo India centres. Long talent pipeline; medal payoff still years away.',
          noteHi: '₹8,750 करोड़; 2,580 KI एथलीट, ₹6.5 लाख/वर्ष। पेरिस 2024: 117 एथलीट — सबसे बड़ा दल — 6 पदक, 0 स्वर्ण (71वें)। 2028 टॉप-10 लक्ष्य बहुत महत्वाकांक्षी।',
        },
        {
          promise: 'Pradhan Mantri Kaushal Vikas Yojana 3.0/4.0 — skill 1 crore youth per year for 21st-century jobs',
          promiseHi: 'PM कौशल विकास योजना 3.0/4.0 — 21वीं सदी की नौकरियों के लिए 1 करोड़ युवाओं को प्रतिवर्ष कुशल बनाना',
          status: 'partial',
          note: 'PMKVY 3.0 (2020–21): disrupted by COVID; only 5.49 lakh trained. PMKVY 4.0 (2022–26): ₹8,800 crore; added Industry 4.0 trades (AI, IoT, robotics). Cumulative all phases (2015–2024): 1.4 crore certified — roughly 1.4 lakh/year vs 1 crore/year promised. Placement rate for certified trainees: ~50% in relevant jobs. CAG (2023): 36% of training centres inspected showed ghost enrolments or sub-standard facilities; 25% of certificates issued without adequate assessment.',
          noteHi: 'PMKVY 3.0: COVID से बाधित, 5.49 लाख प्रशिक्षित। PMKVY 4.0: ₹8,800 करोड़। संचयी 1.4 करोड़ प्रमाणित — 1 करोड़/वर्ष का एक अंश। नियोजन दर ~50%। CAG (2023): 36% केंद्रों में घोस्ट नामांकन।',
        },
      ],
    },
    {
      name: 'Digital India',
      nameHi: 'डिजिटल इंडिया',
      promises: [
        {
          promise: '5G by 2022 — roll out 5G telecom network; make India a global digital leader',
          promiseHi: '2022 तक 5G — 5G दूरसंचार नेटवर्क; भारत को वैश्विक डिजिटल नेता बनाना',
          status: 'partial',
          note: 'Commercial 5G launched October 1, 2022 (PM Modi at India Mobile Congress in Delhi) — on deadline in cities, but the "by 2022 everywhere" spirit was not met. By mid-2024: 7 lakh+ 5G towers; 90%+ of urban India covered by Reliance Jio and Airtel. Rural India: <15% penetration. India is 2nd-largest 5G subscriber market globally. BSNL\'s indigenous 4G (pre-requisite for its 5G): delayed; commercial launch late 2024. Spectrum for mmWave (high-speed urban 5G) barely deployed.',
          noteHi: '1 अक्टूबर 2022 को वाणिज्यिक 5G। 2024 तक: 7 लाख+ टावर; शहरी भारत 90%+। ग्रामीण: <15%। दुनिया का दूसरा सबसे बड़ा 5G बाजार। BSNL का स्वदेशी 4G देरी से।',
        },
        {
          promise: 'Vande Bharat Express — introduce world-class semi-high-speed trains; 75 trains by India@75',
          promiseHi: 'वंदे भारत एक्सप्रेस — विश्वस्तरीय अर्ध-उच्च गति ट्रेन; India@75 तक 75 ट्रेनें',
          status: 'implemented',
          note: 'First Vande Bharat Express launched February 15, 2019 (New Delhi–Varanasi). 75-train target met by October 2023; 102 trainsets on 54 routes by mid-2024. Made-in-India (ICF Chennai); maximum speed 160 km/h; commercial average 90–95 km/h. Strong passenger reception — tickets sold out on most routes. Feedback: no pantry cars on some routes; unreliable AC on older rakes; replacement of all older express stock still decades away.',
          noteHi: 'पहली वंदे भारत 15 फरवरी 2019। 75 का लक्ष्य अक्टूबर 2023 तक पूरा; 2024 तक 102। Made in India (ICF चेन्नई); 160 km/h। यात्री स्वागत अच्छा। पुराने रेक पर AC समस्याएं।',
        },
        {
          promise: 'PM-WANI — public WiFi access points in every village and locality',
          promiseHi: 'PM-WANI — हर गांव और क्षेत्र में सार्वजनिक WiFi एक्सेस प्वाइंट',
          status: 'in-progress',
          note: 'PM-WANI (Wi-Fi Access Network Interface) framework approved December 2020. 4.46 lakh hotspots registered (2024) — mostly in urban/peri-urban. Village-level adoption very low: last-mile infrastructure gaps, electricity unreliability, and lack of local entrepreneurs limit rural uptake. DoT reported 85% of hotspots in top-100 cities. Original target: 1 crore hotspots — current figure is 4% of that.',
          noteHi: 'दिसंबर 2020 को मंजूर। 4.46 लाख हॉटस्पॉट — अधिकांश शहरी। ग्रामीण: बिजली और बुनियादी ढांचे की कमी। 1 करोड़ लक्ष्य का केवल 4%।',
        },
        {
          promise: 'National Logistics Policy — cut India\'s logistics cost from 14% of GDP to 8%; integrate rail, road, ports',
          promiseHi: 'राष्ट्रीय लॉजिस्टिक्स नीति — logistics लागत GDP के 14% से 8% तक; रेल, सड़क, बंदरगाह एकीकरण',
          status: 'in-progress',
          note: 'National Logistics Policy released September 17, 2022. Goals: 8% logistics cost by 2030; India Logistics Performance Index improvement; ULIP (Unified Logistics Interface Platform) for real-time freight tracking. PM Gati Shakti portal integrates 16 ministries. Progress: 40+ ministries onboarded on ULIP; DFC operational sections reducing transit time. But: logistics cost estimated at 8-9% (World Bank) — baseline estimate itself disputed; target dates unclear; state-level logistics policies aligned in only 14 states.',
          noteHi: 'NLP सितंबर 2022। ULIP पर 40+ मंत्रालय। DFC ने समय घटाया। लेकिन: मूल logistics लागत विश्व बैंक अनुमान 8-9% — बेसलाइन ही विवादित; केवल 14 राज्यों में राज्य नीतियां।',
        },
      ],
    },
    {
      name: 'Social Justice & Empowerment',
      nameHi: 'सामाजिक न्याय और सशक्तिकरण',
      promises: [
        {
          promise: 'EWS 10% reservation — economic weaker section quota in higher education and government jobs',
          promiseHi: 'EWS 10% आरक्षण — उच्च शिक्षा और सरकारी नौकरियों में आर्थिक रूप से कमजोर वर्ग का कोटा',
          status: 'implemented',
          note: '103rd Constitutional Amendment passed January 2019 (days before election schedule). 10% EWS reservation in education and central government employment for those earning <₹8 lakh/year and not covered by existing reservations. SC upheld it 3:2 (November 2022 — Janhit Abhiyan case). ~5.5 lakh EWS students in higher education annually (2023). Concerns: income threshold (₹8 lakh) same as creamy layer for OBCs — critics argue it benefits middle class more than truly vulnerable.',
          noteHi: '103वां संशोधन जनवरी 2019। 10% EWS आरक्षण। SC ने 3:2 से बरकरार रखा (नवंबर 2022)। ~5.5 लाख EWS छात्र/वर्ष। आलोचना: ₹8 लाख सीमा — मध्यम वर्ग को अधिक लाभ।',
        },
        {
          promise: 'PM SVANidhi — micro-credit and formalisation for 50 lakh urban street vendors',
          promiseHi: 'PM SVANidhi — 50 लाख शहरी रेहड़ी-पटरी विक्रेताओं के लिए माइक्रो-क्रेडिट और औपचारिकीकरण',
          status: 'partial',
          note: 'Launched June 2020 (COVID recovery + 2019 manifesto promise). Three-tier credit: ₹10,000 → ₹20,000 → ₹50,000. 67 lakh loans disbursed (2024); ₹11,500 crore total credit. Digital transaction incentive: ₹100/month cashback to active users. But: only ~3% of vendors reached the ₹50,000 tier; 30% of first-tranche borrowers could not repay; credit bureau integration incomplete; ~45 lakh street vendors still completely outside formal system; scheme excludes rural periurban vendors.',
          noteHi: 'जून 2020 में शुरू। 67 लाख ऋण; ₹11,500 करोड़। लेकिन: केवल 3% ₹50,000 स्तर पर; 30% पहले ऋण चुका नहीं पाए; 45 लाख अभी भी औपचारिक प्रणाली से बाहर।',
        },
        {
          promise: 'PM Vishwakarma — skill, credit and market access for 18 traditional artisan communities',
          promiseHi: 'PM विश्वकर्मा — 18 पारंपरिक कारीगर समुदायों के लिए कौशल, ऋण और बाजार पहुंच',
          status: 'in-progress',
          note: 'Launched August 2023: ₹13,000 crore. 18 trades: blacksmiths, carpenters, potters, cobblers, goldsmiths, weavers, sculptors, boat-makers, etc. Benefits: ₹1 lakh (collateral-free) → ₹2 lakh credit; skill training + ₹500/day stipend; PM Vishwakarma certificate and toolkit voucher; digital transactions onboarding. 23 lakh registrations (2024); 7.5 lakh approved and receiving benefits. Early stage — market linkage and sustained income gains not yet measured.',
          noteHi: 'अगस्त 2023, ₹13,000 करोड़। 18 व्यापार: लोहार, बढ़ई, कुम्हार, मोची, आदि। 23 लाख पंजीकृत; 7.5 लाख लाभार्थी। बाजार संपर्क और आय लाभ अभी मापे नहीं।',
        },
      ],
    },
    {
      name: 'Women\'s Empowerment',
      nameHi: 'महिला सशक्तिकरण',
      promises: [
        {
          promise: 'Fast-track courts for crimes against women — 1,000+ dedicated special courts to deliver speedy justice',
          promiseHi: 'महिलाओं के खिलाफ अपराधों के लिए फास्ट-ट्रैक न्यायालय — त्वरित न्याय के लिए 1,000+ विशेष अदालतें',
          status: 'partial',
          note: '1,023 Fast-Track Special Courts (FTSCs) notified; 863 operational in 30 states and UTs (2024). 2.46 lakh cases disposed since 2019; 1.56 lakh cases still pending (backlog growing). Genuine reduction in POCSO trial time in operational districts. Gaps: 20% of sanctioned courts still not functional; national rape conviction rate ~27% (NCRB 2022); FIR registration still low — NFHS-5 found only 14% of women who reported spousal violence sought help from authorities.',
          noteHi: '1,023 FTSC अधिसूचित; 863 चालू (2024)। 2.46 लाख मामले निपटाए; 1.56 लाख लंबित। POCSO परीक्षण समय में कमी। लेकिन: बलात्कार दोषसिद्धि दर ~27%; केवल 14% महिलाएं शिकायत करती हैं।',
        },
        {
          promise: 'Mahila Shakti Kendras — community service and empowerment centres for women in rural blocks',
          promiseHi: 'महिला शक्ति केंद्र — ग्रामीण ब्लॉकों में महिलाओं के लिए सामुदायिक सेवा और सशक्तिकरण केंद्र',
          status: 'partial',
          note: '14,014 Mahila Shakti Kendras (MSKs) sanctioned at block level under Mission Shakti; ~9,000+ operational (2024). Services: legal aid, health information, self-defence training, digital literacy, anganwadi linkage. 3.7 lakh student volunteers engaged. Coverage thin in tribal/remote blocks; staff vacancies ~30% in operational MSKs; no independent evaluation of impact on women\'s empowerment outcomes published.',
          noteHi: '14,014 MSK स्वीकृत; ~9,000+ चालू। सेवाएं: कानूनी सहायता, स्वास्थ्य, डिजिटल साक्षरता। 3.7 लाख छात्र स्वयंसेवक। आदिवासी/दूरस्थ क्षेत्रों में कवरेज कम; 30% रिक्तियां।',
        },
      ],
    },
    {
      name: 'National Security & Border',
      nameHi: 'राष्ट्रीय सुरक्षा और सीमा',
      promises: [
        {
          promise: 'NIA strengthening & UAPA expansion — designate individual terrorists; NIA to investigate overseas offences',
          promiseHi: 'NIA सुदृढ़ीकरण और UAPA विस्तार — व्यक्तियों को आतंकवादी घोषित करना; NIA को विदेशी अपराध जांच',
          status: 'implemented',
          note: 'NIA Amendment Act 2019: NIA jurisdiction extended to overseas terror acts against Indians. UAPA Amendment 2019: MHA can designate individuals (not just organisations) as terrorists — 26 individuals listed by 2024. 95%+ NIA conviction rate in 400+ completed cases. Civil liberties concern: UAPA used against journalists, activists and academics (Bhima Koregaon case); SC flagged bail denial norms; Amnesty India closed India operations citing UAPA risk.',
          noteHi: 'NIA संशोधन 2019: विदेशी आतंकी कृत्यों में NIA अधिकार। UAPA 2019: व्यक्तियों को आतंकवादी घोषित — 26 व्यक्ति सूचीबद्ध। 95%+ NIA दोषसिद्धि दर। चिंता: पत्रकारों, कार्यकर्ताओं पर UAPA का इस्तेमाल।',
        },
        {
          promise: 'CIBMS — smart technology fence on Pakistan and Bangladesh borders to prevent infiltration',
          promiseHi: 'CIBMS — पाकिस्तान और बांग्लादेश सीमाओं पर स्मार्ट तकनीक बाड़ — घुसपैठ रोकने के लिए',
          status: 'in-progress',
          note: 'Comprehensive Integrated Border Management System: sensors, CCTV, radars, night-vision cameras, flood-lit fencing along India-Pakistan (Punjab, Gujarat: 670 km Phase 1) and India-Bangladesh borders. ₹14,000+ crore outlay. ~60% of planned coverage complete (2024). Full Pak border coverage expected FY26; Bangladesh border facing terrain and river-island challenges. Infiltration on J&K LoC has not reduced significantly; 97 infiltration attempts foiled in 2023 (MHA).',
          noteHi: 'सेंसर, CCTV, रडार; ₹14,000+ करोड़। ~60% नियोजित कवरेज पूर्ण (2024)। J&K LoC पर घुसपैठ में उल्लेखनीय कमी नहीं; 2023 में 97 प्रयास विफल।',
        },
        {
          promise: 'Defence modernisation — transform armed forces into net-security provider; ₹1 lakh crore capital acquisitions',
          promiseHi: 'रक्षा आधुनिकीकरण — सशस्त्र बलों को क्षेत्र का शुद्ध सुरक्षा प्रदाता बनाना',
          status: 'partial',
          note: 'Defence budget grew from ₹2.46 lakh crore (FY15) to ₹6.21 lakh crore (FY25). Aatmanirbhar Bharat: 2 Positive Indigenisation Lists — 411 items reserved for domestic procurement. Defence FDI: 74% → 100% automatic route. Exports: ₹21,083 crore (FY24) vs ₹686 crore (FY14) — 30× rise. But: India remains world\'s largest arms importer ($4.7 bn/year, SIPRI 2023); Russian equipment dependency; IAF below 30-squadron strength (was 42 in 1990s); China PLA modernisation outpacing India\'s.',
          noteHi: 'रक्षा बजट ₹2.46 → ₹6.21 लाख करोड़। 411 वस्तुएं स्वदेशी। निर्यात 30 गुना। लेकिन: भारत अभी भी दुनिया का सबसे बड़ा हथियार आयातक; IAF 30 स्क्वाड्रन से कम; चीन से तेज आधुनिकीकरण।',
        },
        {
          promise: 'Coastal security — 61 radar stations, national maritime domain awareness, National Maritime Security Coordinator',
          promiseHi: 'तटीय सुरक्षा — 61 रडार स्टेशन, राष्ट्रीय समुद्री क्षेत्र जागरूकता, राष्ट्रीय समुद्री सुरक्षा समन्वयक',
          status: 'partial',
          note: '61 Coastal Surveillance Radar System (CSRS) stations operational; National Automatic Identification System (NAIS) tracking 80,000+ vessels. National Maritime Security Coordinator (NMSC) post created 2022 — first appointee: Adm. (Retd.) G. Ashok Kumar. Coastal Security Scheme Phase 3 operational in 6 coastal states and 4 UTs. Gap: only 10% of small fishing boats (<15 m) carry AIS transponders; coordination between Navy, Coast Guard and state police still fragmented post-26/11.',
          noteHi: '61 रडार; NMSC पद 2022। तटीय सुरक्षा योजना Phase 3। अंतराल: 10% छोटी नावें AIS; नौसेना-तटरक्षक-पुलिस समन्वय कमजोर।',
        },
        {
          promise: 'National Cyber Security Policy — protect critical infrastructure from cyber threats; cyber-crime coordination',
          promiseHi: 'राष्ट्रीय साइबर सुरक्षा नीति — साइबर खतरों से महत्वपूर्ण बुनियादी ढांचे की सुरक्षा',
          status: 'in-progress',
          note: 'Indian Cyber Crime Coordination Centre (I4C) established under MHA; National Cybercrime Reporting Portal received 2.4 mn complaints (2023). CERT-In handled 1.6 mn cyber incidents (2023) up from 0.3 mn (2017). National Cyber Security Strategy 2020 (draft) — still not formally notified. India ranked 10th in ITU Global Cybersecurity Index 2024. Financial cyber fraud rose to ₹1,750 crore in reported losses (H1 2024). Critical gaps: no data protection authority operational until 2024; DPDP Act 2023 rules pending.',
          noteHi: 'I4C: 24 लाख शिकायतें (2023)। CERT-In: 16 लाख घटनाएं। लेकिन: राष्ट्रीय साइबर रणनीति अधिसूचित नहीं। वित्तीय साइबर धोखाधड़ी ₹1,750 करोड़ (H1 2024)।',
        },
      ],
    },
    {
      name: 'Energy & Environment',
      nameHi: 'ऊर्जा और पर्यावरण',
      promises: [
        {
          promise: 'Renewable energy: 450 GW clean power by 2030, with India becoming a global solar leader',
          promiseHi: 'नवीकरणीय ऊर्जा: 2030 तक 450 GW स्वच्छ ऊर्जा; भारत वैश्विक सौर नेता बनेगा',
          status: 'in-progress',
          note: 'Target revised to 500 GW by 2030 (COP26 announcement). Installed solar: 82 GW (March 2024); total renewable: 198 GW — India 4th globally in solar capacity. Pace required: +50 GW/year; actual pace in FY24: +24 GW. Solar module manufacturing: India added 15 GW/year domestic capacity but still imports Chinese cells. At current pace, India reaches ~300 GW renewable by 2030 — well short of 500 GW target.',
          noteHi: 'स्थापित सौर: 82 GW; कुल नवीकरणीय: 198 GW। 500 GW के लिए जरूरी गति: 50 GW/वर्ष; FY24 में 24 GW। 2030 तक ~300 GW संभव — 500 GW से कम।',
        },
        {
          promise: 'Plastic-free India — ban single-use plastics; eliminate plastic waste from rivers, coasts and landfills',
          promiseHi: 'प्लास्टिक मुक्त भारत — एकल उपयोग प्लास्टिक पर प्रतिबंध; नदियों, तटों और लैंडफिल से प्लास्टिक कचरा खत्म',
          status: 'partial',
          note: 'Single-use plastic ban notified July 1, 2022: 19 categories (earbuds, plates, cups, straws, sachets, etc.) banned. Extended Producer Responsibility (EPR) rules 2022: 10,000+ certificates issued to producers. Urban compliance: ~60%; rural enforcement minimal; small manufacturers relocated or substituted with marginally different products. India remains one of the world\'s largest plastic waste generators (3.5 MT/year). River plastic — Ganga plastic pollution unchanged in most stretches per CPCB.',
          noteHi: '1 जुलाई 2022: 19 SUP श्रेणियां प्रतिबंधित। EPR: 10,000+ प्रमाणपत्र। शहरी अनुपालन ~60%; ग्रामीण न्यूनतम। भारत 3.5 MT/वर्ष प्लास्टिक कचरा — शीर्ष देशों में।',
        },
        {
          promise: 'Swachh Bharat Phase 2 / ODF+ — sustain open-defecation-free status; achieve solid and liquid waste management',
          promiseHi: 'स्वच्छ भारत Phase 2 / ODF+ — ODF स्थिति बनाए रखना; ठोस और तरल कचरा प्रबंधन',
          status: 'partial',
          note: 'Phase 2 (2021–2026): ₹1.41 lakh crore. Rural: 1.18 lakh villages ODF+ certified (2024). Urban: 5,000+ cities ODF; scientific waste processing: 75% (up from 18% in 2014). However, NFHS-5: 19% of rural households still practising open defecation despite ODF certification — infrastructure built without sustained behaviour change. Leaching from landfills contaminating groundwater in 40+ cities (CPCB). Progress is real but self-reported ODF figures are overstated.',
          noteHi: '₹1.41 लाख करोड़। 1.18 लाख ODF+ गांव। 75% वैज्ञानिक कचरा प्रसंस्करण। लेकिन: NFHS-5 — 19% ग्रामीण अभी भी खुले में शौच; ODF दावे अतिरंजित।',
        },
        {
          promise: 'UJALA LED programme — replace inefficient bulbs with LEDs; make energy affordable for every household',
          promiseHi: 'UJALA LED कार्यक्रम — अकुशल बल्ब को LED से बदलना; हर घर के लिए ऊर्जा किफायती बनाना',
          status: 'implemented',
          note: 'Unnat Jyoti by Affordable LEDs for All (UJALA) launched 2015. 36.84 crore LED bulbs distributed at ₹70/bulb (vs ₹350 market). 82 lakh LED streetlights replaced under SLNP. Annual energy saving: 47.65 bn kWh (equivalent to 12 coal power plants). Consumer savings: ₹19,241 crore/year. CO₂ avoided: 3.8 crore tonnes/year. India\'s LED market grew from 5% to 60%+ of lighting by 2024. One of the programme\'s most straightforward successes — genuine scale and impact.',
          noteHi: '36.84 करोड़ LED बल्ब; ₹19,241 करोड़/वर्ष बचत; 47.65 अरब kWh ऊर्जा बचत; 3.8 करोड़ टन CO₂ बचत। भारत LED बाजार 5% → 60%+। एक स्पष्ट सफलता।',
        },
      ],
    },
    {
      name: 'Health (Additional)',
      nameHi: 'स्वास्थ्य (अतिरिक्त)',
      promises: [
        {
          promise: 'Jan Aushadhi — 10,000 generic medicine stores in every district; medicines at 50–90% below branded price',
          promiseHi: 'जन औषधि — हर जिले में 10,000 जेनेरिक दवा दुकानें; ब्रांडेड से 50-90% सस्ती दवाएं',
          status: 'implemented',
          note: 'Target of 10,000 stores by March 2024: achieved (10,500+ operational). 2,000 medicines and 293 surgical items listed. Cumulative savings to patients: ₹4,800 crore (2016–2024) — independently verifiable through PM-BJP data and IQVIA. All districts covered; 60% of stores in rural/semi-urban areas. Franchisee model viable. Gap: quality control concerns — CAG (2019) found expired drugs at 13% of inspected stores; the number has since improved with better monitoring.',
          noteHi: '10,500+ स्टोर (मार्च 2024) — लक्ष्य पूरा। ₹4,800 करोड़ मरीजों की बचत। सभी जिले कवर। CAG (2019): 13% निरीक्षित में एक्सपायर्ड दवाएं — सुधार हुआ।',
        },
        {
          promise: 'Mission Indradhanush — achieve 90% full immunisation coverage for children and pregnant women',
          promiseHi: 'मिशन इंद्रधनुष — बच्चों और गर्भवती महिलाओं के लिए 90% पूर्ण टीकाकरण कवरेज',
          status: 'partial',
          note: 'Full immunisation coverage improved from 62% (NFHS-4, 2015–16) to 76.4% (NFHS-5, 2019–21) — a genuine 14-percentage-point gain. 90% target not met. Intensified Mission Indradhanush 4.0 and 5.0 launched (COVID makeup vaccination). Five new vaccines added to UIP (Rota, PCV, Varicella, adult JE, HPV). HPV vaccine for adolescent girls launched 2023. India still has 3.4 mn un-immunised children (WHO 2023) — concentrated in UP, Bihar, MP, Rajasthan, and urban slums.',
          noteHi: 'टीकाकरण: 62% → 76.4% — 14 अंक सुधार। लेकिन: 90% लक्ष्य नहीं मिला। IMI 4.0 और 5.0। HPV वैक्सीन 2023। 3.4 mn बच्चे अभी भी बिना टीके।',
        },
        {
          promise: 'Poshan Abhiyan — eliminate malnutrition; reduce stunting, wasting and underweight among children under 5',
          promiseHi: 'पोषण अभियान — कुपोषण समाप्त करना; 5 वर्ष से कम बच्चों में ठिगनापन, वजन कम करना',
          status: 'partial',
          note: 'Mission POSHAN 2.0 (2021): convergence of ICDS, PMMVY and Poshan. NFHS data: stunting 38.4% (NFHS-4) → 35.5% (NFHS-5); wasting 21% → 19.3%; underweight 35.8% → 32.1%. Progress is real but too slow — India is still home to 40% of the world\'s stunted children (UNICEF). Global Hunger Index 2023: India ranked 111th of 125 countries. POSHAN tracker data quality challenged by field-level data entry irregularities (CAG 2023). At current trajectory, India will not meet 2030 SDG nutrition goals.',
          noteHi: 'ठिगनापन 38.4% → 35.5%; अल्पवजन 35.8% → 32.1%। लेकिन: 40% दुनिया के ठिगने बच्चे भारत में। GHI 2023: 125 में 111वां। SDG 2030 लक्ष्य मुश्किल।',
        },
        {
          promise: 'AYUSH mainstreaming — WHO Global Centre for Traditional Medicine; integrate Ayurveda, Yoga and Naturopathy into healthcare',
          promiseHi: 'AYUSH को मुख्यधारा में लाना — WHO पारंपरिक चिकित्सा वैश्विक केंद्र; आयुर्वेद, योग को स्वास्थ्य सेवा में एकीकृत',
          status: 'partial',
          note: 'Ministry of AYUSH budget: ₹500 crore (FY15) → ₹3,647 crore (FY25). WHO Global Centre for Traditional Medicine (GCTM) inaugurated at Jamnagar, April 2022 — ₹1,600 crore WHO investment over 10 years. AYUSH sector market size: ₹1.5 lakh crore (2024). 3,800+ AYUSH hospitals; 28,000+ dispensaries. Gaps: integration with allopathy largely administrative; COVID-era Coronil/Ashwagandha promotion without RCT evidence drew WHO criticism; quality control of herbal products still weak; no national registry of AYUSH clinical outcomes.',
          noteHi: 'बजट ₹500 करोड़ → ₹3,647 करोड़। GCTM जामनगर अप्रैल 2022। बाजार ₹1.5 लाख करोड़। अंतराल: कोविड में RCT बिना Coronil प्रचार; गुणवत्ता नियंत्रण कमजोर।',
        },
      ],
    },
    {
      name: 'Good Governance',
      nameHi: 'सुशासन',
      promises: [
        {
          promise: 'One Nation One Election — synchronise Lok Sabha and all state assembly elections to reduce disruption',
          promiseHi: 'एक राष्ट्र एक चुनाव — लोकसभा और सभी राज्य विधानसभा चुनाव एक साथ करना',
          status: 'in-progress',
          note: 'Explicitly promised in 2019 manifesto. High-Level Committee under former Pres. Ram Nath Kovind submitted report March 2024: recommended simultaneous elections in two phases. Constitution (129th Amendment) Bill introduced in Parliament December 2024; referred to Joint Parliamentary Committee. JPC report expected 2025. Key obstacles: requires ratification by 50%+ state assemblies; fixed 5-year terms for state assemblies need constitutional amendment; opposition parties and federalism experts oppose.',
          noteHi: '2019 संकल्प पत्र में स्पष्ट वादा। कोविंद समिति रिपोर्ट मार्च 2024। संविधान संशोधन बिल दिसंबर 2024 — JPC को भेजा। 2025 तक रिपोर्ट। 50%+ राज्य विधानसभाओं की मंजूरी जरूरी।',
        },
        {
          promise: 'Direct Benefit Transfer — eliminate middlemen in subsidies; every rupee to reach the beneficiary directly',
          promiseHi: 'प्रत्यक्ष लाभ हस्तांतरण — सब्सिडी में बिचौलियों को खत्म करना; हर रुपया सीधे लाभार्थी तक',
          status: 'implemented',
          note: 'DBT Mission: ₹34.78 lakh crore transferred to 53+ crore beneficiaries in 317 schemes (2015–2024). Government estimate: ₹2.73 lakh crore saved by eliminating ghost beneficiaries and duplicates — independently corroborated by IMF and NITI Aayog studies (methodology contested but direction validated). JAM (Jan Dhan-Aadhaar-Mobile) trinity underpins delivery. Aadhaar: 1.35 bn enrolled. Gaps: exclusion errors — those without Aadhaar or biometric failure excluded; NREGA workers and pension recipients report payment delays.',
          noteHi: '₹34.78 लाख करोड़; 53+ करोड़ लाभार्थी; 317 योजनाएं। ₹2.73 लाख करोड़ भूत लाभार्थियों से बचत। JAM त्रयी। अंतराल: बायोमेट्रिक विफलता से बहिष्कार।',
        },
        {
          promise: 'Ease of compliance — decriminalise business law offences; reduce regulatory burden on citizens and companies',
          promiseHi: 'अनुपालन में आसानी — व्यावसायिक कानूनी अपराधों को अपराधमुक्त करना; नागरिकों और कंपनियों पर नियामक बोझ कम',
          status: 'partial',
          note: 'Jan Vishwas (Amendment of Provisions) Act 2023 decriminalised 183 offences across 42 central laws — converting imprisonment to penalty. 1,486 obsolete laws repealed by Parliament (2014–2024). 42,000 compliance requirements reduced under DPIIT\'s National Action Plan for Simplifying Regulatory Compliances. India\'s World Bank Ease of Doing Business rank: 142 (2014) → 63 (2020) — before WB discontinued the index. Criticism: state-level compliances barely touched; labour law codes (4 codes, 44 laws) notified but not enforced.',
          noteHi: 'Jan Vishwas 2023: 183 अपराधमुक्त। 1,486 पुराने कानून रद्द। EODB रैंक: 142 → 63। लेकिन: राज्य अनुपालन अछूते; 4 श्रम संहिताएं लागू नहीं।',
        },
        {
          promise: 'Benami property action — seize assets held in false names to attack black money at its source',
          promiseHi: 'बेनामी संपत्ति पर कार्रवाई — काले धन को स्रोत पर रोकने के लिए झूठे नामों में रखी संपत्ति जब्त',
          status: 'partial',
          note: 'Benami Transactions (Prohibition) Amendment Act 2016. 9,000+ provisional attachment notices issued; ₹19,000 crore+ properties attached. But: prosecution rate low — ~800 cases filed in criminal courts by 2024. SC (2022, Ganpati Dealcom case) struck down retrospective provisions of the Benami Act; ordered hundreds of notices quashed. Government amended the Act in response. Effective action concentrated in 2016–18; pace slowed significantly post-SC ruling.',
          noteHi: '9,000+ नोटिस; ₹19,000 करोड़ संलग्न। ~800 आपराधिक मामले। SC (2022): पूर्वव्यापी प्रावधान रद्द। 2018 के बाद गति धीमी।',
        },
      ],
    },
    {
      name: 'Culture & Heritage',
      nameHi: 'संस्कृति और विरासत',
      promises: [
        {
          promise: 'International Yoga Day — establish India as the global home of yoga; promote traditional wellness systems',
          promiseHi: 'अंतर्राष्ट्रीय योग दिवस — भारत को योग का वैश्विक केंद्र बनाना; पारंपरिक स्वास्थ्य प्रणालियों को बढ़ावा',
          status: 'implemented',
          note: 'India proposed International Yoga Day at UNGA in September 2014; adopted unanimously June 21 as the date. 190+ countries celebrate; ~300 mn participants annually. India promotes yoga through 191 embassies, cultural centres, and ICC. Common Yoga Protocol standardised for practitioners worldwide. AYUSH Ministry certifies yoga instructors (40,000+ certified). WHO included yoga in integrated healthcare guidelines (2019). Soft-power dividend real — yoga ambassadors internationally.',
          noteHi: 'UNGA में प्रस्तावित सितंबर 2014; 190+ देश; ~30 करोड़ प्रतिभागी। 191 दूतावासों में। 40,000+ प्रमाणित प्रशिक्षक। WHO ने स्वास्थ्य दिशानिर्देश में शामिल किया।',
        },
        {
          promise: 'Heritage protection — conserve 3,700 monuments, add UNESCO inscriptions; build world-class museums',
          promiseHi: 'विरासत संरक्षण — 3,700 स्मारक, UNESCO अंकन; विश्वस्तरीय संग्रहालय',
          status: 'partial',
          note: '3,693 Centrally Protected Monuments under ASI; ₹4,000+ crore conservation spending. New UNESCO inscriptions 2014–2024: Dholavira, Hoysala temples, Santiniketan, Gangaikonda Cholapuram, Modhera Sun Temple — 6 new World Heritage Sites. Pradhanmantri Sangrahalaya opened (April 2022). National Mission for Manuscripts: 5.2 mn manuscripts digitised. Gaps: 18% of CPMs have active encroachments (ASI 2023); 50+ monuments "missing" from ASI inventory; Hampi and Mandu in poor condition.',
          noteHi: '3,693 स्मारक; ₹4,000+ करोड़। 6 नए UNESCO स्थल (धोलावीरा, होयसला, शांतिनिकेतन...)। PM संग्रहालय खुला। अंतराल: 18% CPM पर अतिक्रमण; 50+ स्मारक ASI सूची से गायब।',
        },
        {
          promise: 'Pilgrimage rejuvenation — transform spiritual sites: Kashi, Kedarnath, Somnath, Char Dham corridor',
          promiseHi: 'तीर्थस्थल पुनरुद्धार — काशी, केदारनाथ, सोमनाथ, चार धाम कॉरिडोर का कायाकल्प',
          status: 'partial',
          note: 'Kashi Vishwanath Corridor (₹900 crore): inaugurated December 2021; daily footfall 4 lakh (vs 3,000 earlier). Kedarnath redevelopment (₹400 crore): infrastructure rebuilt after 2013 flood damage. Char Dham Highway (₹12,000 crore, 889 km): 85% complete (2024). Somnath Temple corridor completed. PRASHAD scheme: 41 pilgrimage sites developed under Centre. But: Char Dham road project drew SC scrutiny for environmental damage; Kedarnath capacity exceeding ecological limits (15 lakh pilgrims in 2023 — 3× pre-2019).',
          noteHi: 'काशी कॉरिडोर ₹900 करोड़; 4 लाख/दिन आगंतुक। केदारनाथ ₹400 करोड़। चार धाम राजमार्ग 85%। PRASHAD: 41 तीर्थ। अंतराल: पर्यावरण क्षति; केदारनाथ पर पर्यटन दबाव।',
        },
        {
          promise: 'Classical language and linguistic heritage — protect India\'s linguistic diversity; promote Sanskrit and regional classical languages',
          promiseHi: 'शास्त्रीय भाषा और भाषाई विरासत — भाषाई विविधता रक्षा; संस्कृत और क्षेत्रीय भाषाओं को बढ़ावा',
          status: 'partial',
          note: 'Classical language status: 6 languages (Tamil, Sanskrit, Telugu, Kannada, Malayalam, Odia) → expanded; Marathi, Pali, Prakrit, Bengali, Assamese added by UPA/NDA (4 new under Modi govt). Central Sanskrit Universities Act 2020: merged 3 deemed universities into 3 Central Sanskrit Universities. NEP 2020 mandates mother-tongue medium to Grade 5 in regional languages. Tribal languages: 22 new languages added to school textbooks (NCERT). But: Linguistic Atlas of India project still pending; 650+ tribal languages at risk (UNESCO).',
          noteHi: '4 नई शास्त्रीय भाषाएं। 3 केंद्रीय संस्कृत विश्वविद्यालय। NEP: कक्षा 5 तक मातृभाषा। 22 आदिवासी भाषाएं पाठ्यक्रम में। लेकिन: 650+ आदिवासी भाषाएं संकट में।',
        },
      ],
    },
    {
      name: 'Tribal & SC/ST Welfare',
      nameHi: 'जनजातीय और SC/ST कल्याण',
      promises: [
        {
          promise: 'Van Dhan Vikas Kendras — convert tribal forest produce into enterprise; 3,000+ centres for 10 lakh beneficiaries',
          promiseHi: 'वन धन विकास केंद्र — जनजातीय वन उत्पाद को उद्यम में बदलना; 10 लाख लाभार्थियों के लिए 3,000+ केंद्र',
          status: 'partial',
          note: 'TRIFED launched Van Dhan Vikas Kendras (VDVKs) 2019. 3,073 VDVKs operational; 8.9 lakh SHG members; ₹1,500+ crore NTFP (non-timber forest produce) trade. Tribes India brand: tribal products marketed online and at Tribes India outlets (110+ centres). Tribals receiving 40-60% higher price for NTFP vs open market. Weakness: VDVKs in only 2,343 blocks vs 5,000+ tribal blocks; cold storage and processing machinery absent in 60%; cluster-to-market linkage breaks down for perishables.',
          noteHi: '3,073 VDVK; 8.9 लाख SHG; ₹1,500+ करोड़ NTFP। Tribes India: 110+ आउटलेट। कमी: केवल 2,343 ब्लॉक कवर; 60% में कोल्ड स्टोरेज/प्रसंस्करण नहीं।',
        },
        {
          promise: 'Forest Rights Act implementation — distribute individual and community forest rights to adivasi families',
          promiseHi: 'वन अधिकार अधिनियम कार्यान्वयन — आदिवासी परिवारों को व्यक्तिगत और सामुदायिक वन अधिकार वितरण',
          status: 'partial',
          note: 'As of 2024: 23.1 lakh individual title deeds and 69,555 community rights titles distributed. But of 44.6 lakh total claims filed, 20.3 lakh rejected (45% rejection rate); millions dispute rejections. 15 million acres of titles yet to be issued. SC (Feb 2019) ordered eviction of claimants with rejected FRA titles — causing national alarm; order stayed. ST ministry directs states to review rejections; progress slow. Key gap: Gram Sabhas empowered on paper but state forest departments retain functional control in most states.',
          noteHi: '23.1 लाख व्यक्तिगत और 69,555 सामुदायिक अधिकार। 44.6 लाख में 20.3 लाख अस्वीकृत (45%)। SC: अस्वीकृत दावेदारों को बेदखल करने का आदेश — बाद में स्थगित। ग्राम सभा का अधिकार कागज पर।',
        },
        {
          promise: 'Post-matric scholarships for SC/ST students — ₹59,000 crore scheme to retain students through higher education',
          promiseHi: 'SC/ST छात्रों के लिए पोस्ट-मैट्रिक छात्रवृत्ति — उच्च शिक्षा में छात्रों को बनाए रखने के लिए ₹59,000 करोड़ योजना',
          status: 'partial',
          note: 'Revamped Post-Matric Scholarship (PMS) for SC students: ₹59,048 crore approved for 2021–22 to 2025–26; 4.85 crore SC beneficiaries targeted. Centre shifted to 60:40 cost-sharing with states (was state-funded before). Disbursed: ~₹11,000 crore (2024 — less than 20% of 5-year commitment). Persistent problem: state governments delay releases — SC students dropout before scholarship arrives (CAG 2023). OBC and Minority scholarship schemes similarly stalled. Gross Enrolment Ratio for SC students: 23% vs 28% national average.',
          noteHi: '₹59,048 करोड़ (2021-26); 4.85 करोड़ लाभार्थी। 2024 तक ~₹11,000 करोड़ (20% से कम)। राज्य देरी से जारी करते हैं; SC छात्र बीच में छोड़ देते हैं। SC छात्रों का GER: 23% बनाम राष्ट्रीय 28%।',
        },
        {
          promise: 'SC/ST (Prevention of Atrocities) Amendment — restore SC/ST Act provisions struck down by SC; strengthen prosecution',
          promiseHi: 'SC/ST (अत्याचार रोकथाम) संशोधन — SC द्वारा खंडित SC/ST अधिनियम प्रावधान बहाल करना',
          status: 'implemented',
          note: 'SC\'s March 2018 ruling in Subhash Kashinath Mahajan v. Maharashtra watered down arrest/FIR provisions of the SC/ST PoA Act. Nationwide protests followed. Parliament passed SC/ST (PoA) Amendment Act 2018 in August — restored original provisions and added new protections, including "collective social and economic boycott" as an offence. SC upheld the amendment (2019). Conviction rate in SC/ST atrocity cases: 32% (NCRB 2022) — marginal improvement from 28% (2014). Pending trials: 1.48 lakh cases.',
          noteHi: 'मार्च 2018 SC फैसले के बाद राष्ट्रव्यापी विरोध। संशोधन अधिनियम अगस्त 2018 — मूल प्रावधान बहाल। SC ने 2019 में बरकरार रखा। दोषसिद्धि: 32% (2022)। 1.48 लाख लंबित मामले।',
        },
      ],
    },
    {
      name: 'MSME, Exports & Tourism',
      nameHi: 'MSME, निर्यात और पर्यटन',
      promises: [
        {
          promise: 'MSME formalisation — register and provide credit to 6 crore micro, small and medium enterprises',
          promiseHi: 'MSME औपचारिकीकरण — 6 करोड़ सूक्ष्म, लघु और मध्यम उद्यमों को पंजीकृत और ऋण प्रदान करना',
          status: 'partial',
          note: '6.3 crore MSMEs registered on Udyam portal (2024); credit outstanding: ₹27 lakh crore (FY24). Emergency Credit Line Guarantee Scheme (ECLGS — COVID): ₹3.68 lakh crore to 1.35 crore MSMEs; saved an estimated 1.5 crore jobs (RBI). CGTMSE guarantee volume: ₹1.4 lakh crore (2024). But: MSME NPA rate 7–14% (RBI); 30%+ registered MSMEs still cannot access formal credit despite registration; micro units (<₹25 lakh turnover) remain largely bank-credit-excluded; value-added services for MSMEs thin.',
          noteHi: '6.3 करोड़ Udyam पंजीकृत; ₹27 लाख करोड़ ऋण। ECLGS: ₹3.68 लाख करोड़। लेकिन: NPA 7-14%; 30%+ पंजीकृत भी औपचारिक ऋण नहीं पा सके।',
        },
        {
          promise: 'Export doubling — take India\'s merchandise exports from $330 billion to $1 trillion by 2025',
          promiseHi: 'निर्यात दोगुना — भारत का माल निर्यात $330 bn से $1 ट्रिलियन तक 2025 तक',
          status: 'partial',
          note: 'Merchandise exports: $310 bn (FY14) → $437 bn (FY24) — 41% increase vs 2× target. Services exports: $150 bn → $340 bn (FY24) — more than doubled. Combined goods+services: $460 bn → $777 bn. Foreign Trade Policy 2023: $1 trillion goods + $1 trillion services by 2030 (target extended). India\'s world export share: 1.8% (2014) → 2.1% (2023) — marginal. PLI schemes: $6.5 bn incremental exports. Gap: manufactured goods export basket remains shallow; electronic exports rising but not yet sufficient.',
          noteHi: 'माल निर्यात: $310 bn → $437 bn (41%, लक्ष्य 2× था)। सेवाएं: $150 bn → $340 bn (2 गुना से अधिक)। $1 ट्रिलियन लक्ष्य 2030 तक बढ़ाया। विश्व निर्यात हिस्सा: 1.8% → 2.1%।',
        },
        {
          promise: 'Tourism — attract 5 crore international visitors; make tourism India\'s largest employment creator',
          promiseHi: 'पर्यटन — 5 करोड़ विदेशी पर्यटक; पर्यटन को भारत का सबसे बड़ा रोजगार सृजनकर्ता बनाना',
          status: 'not-fulfilled',
          note: 'Foreign tourist arrivals: 10.9 mn (2014) → 17.9 mn (2019, pre-COVID peak) → 9.2 mn (2023) — still below 2014 in absolute terms. Target of 50 mn (5 crore) far out of reach. Domestic tourism recovered strongly: 1.7 bn visits (2022). E-visa expanded to 170+ countries. Tourism\'s GDP share: 7.8% (FY23). PRASHAD and Incredible India 2.0 campaigns launched. But: infrastructure at most tourist sites remains poor; police-tourism interaction ratings low; Indian tourism brand below its potential for global arrivals.',
          noteHi: 'विदेशी पर्यटक: 10.9 mn (2014) → 9.2 mn (2023) — 2014 से भी कम। 5 करोड़ लक्ष्य: अप्राप्य। घरेलू पर्यटन: 1.7 bn (2022)। e-वीजा 170+ देश। बुनियादी ढांचा और अनुभव अभी भी कमजोर।',
        },
        {
          promise: 'PM MITRA — 7 Mega Integrated Textile Region and Apparel parks; make India a textile export powerhouse',
          promiseHi: 'PM MITRA — 7 मेगा एकीकृत कपड़ा क्षेत्र और परिधान पार्क; भारत को कपड़ा निर्यात महाशक्ति बनाना',
          status: 'in-progress',
          note: 'PM Mega Integrated Textile Regions and Apparel (MITRA) parks announced 2022: 7 parks in Tamil Nadu, Telangana, Gujarat, Karnataka, MP, UP and Rajasthan; ₹4,445 crore Central grant. Sites selected (2023); land allocated in 5 states. PLI for Textiles: ₹10,683 crore for man-made fibre and technical textiles — 64 applications approved. Textile exports: $44.4 bn (FY23). Target: $100 bn by 2030. Construction and operations just beginning — too early to evaluate. India faces stiff competition from Bangladesh (garments) and China (fabric).',
          noteHi: '7 MITRA पार्क; ₹4,445 करोड़ केंद्रीय अनुदान। 5 राज्यों में भूमि। PLI: ₹10,683 करोड़। निर्यात $44 bn; लक्ष्य $100 bn (2030)। निर्माण शुरुआती — मूल्यांकन जल्दी।',
        },
      ],
    },
    {
      name: 'Infrastructure (Additional)',
      nameHi: 'बुनियादी ढांचा (अतिरिक्त)',
      promises: [
        {
          promise: 'Inland waterways — develop 111 national waterways for cargo and passenger movement',
          promiseHi: 'अंतर्देशीय जलमार्ग — माल और यात्री आवागमन के लिए 111 राष्ट्रीय जलमार्गों का विकास',
          status: 'in-progress',
          note: '111 National Waterways declared under the National Waterways Act 2016. NW-1 (Varanasi–Haldia, 1,620 km): operational; Jal Marg Vikas Project (World Bank funded ₹5,369 crore) enhanced capacity. Cargo carried: 118+ MT on all waterways (FY23) — growth from near zero. RO-RO (roll-on roll-off) vehicle ferry services on NW-1 and Kerala backwaters. But: only 5 of 111 NWs have commercial operations; inland container services uncompetitive vs road; low draught in dry season interrupts 4-month operations; NW-2 (Brahmaputra) development slow.',
          noteHi: '111 NW घोषित। NW-1: 118+ MT माल (FY23); JMVP ₹5,369 करोड़। RO-RO सेवाएं। लेकिन: 111 में से केवल 5 पर वाणिज्यिक परिचालन; सूखे मौसम में 4 माह बाधा।',
        },
        {
          promise: 'Urban metro expansion — 1,000 km metro rail in 25 cities; boost public transport in urban India',
          promiseHi: 'शहरी मेट्रो विस्तार — 25 शहरों में 1,000 km मेट्रो रेल; शहरी भारत में सार्वजनिक परिवहन बढ़ाना',
          status: 'partial',
          note: 'Metro network: 340 km (2014) → 945 km operational in 21 cities (2024) — 2.8× growth. Cities added: Ahmedabad, Nagpur, Pune, Lucknow, Bhopal, Agra, Kanpur, Varanasi. 88 cities have metro proposals at some stage. ~1,000 km target close but not fully met; some cities face low ridership after COVID. Daily ridership: 65 lakh (pre-COVID peak) → 56 lakh (2024). Metro cities cover 37% of India\'s urban population. Land acquisition and local body coordination remain bottlenecks.',
          noteHi: 'मेट्रो: 340 km → 945 km, 21 शहर। 88 शहरों में प्रस्ताव। ~1,000 km लगभग पूरा। दैनिक सवारी: 56 लाख। COVID के बाद कुछ शहरों में कम।',
        },
        {
          promise: '100 new airports — double India\'s airport infrastructure; connect every state capital by air',
          promiseHi: '100 नए हवाई अड्डे — भारत का हवाई अड्डा बुनियादी ढांचा दोगुना; हर राज्य राजधानी को हवाई मार्ग से जोड़ना',
          status: 'partial',
          note: 'Operational airports: 74 (2014) → 157 (2024) — over doubled. 83 new airports, heliports and water aerodromes developed under UDAN. India is now the world\'s 3rd largest civil aviation market (ICAO). Air passengers: 61 mn (FY14) → 152 mn (FY23). Greenfield airports under construction: Navi Mumbai, Jewar (Delhi-NCR), Bhogapuram (AP), Mopa (Goa), Dholera. But: 157 airports vs 5,000+ cities needing air access; UDAN routes economically fragile (200+ returned); Tier-3 city connectivity still poor.',
          noteHi: 'हवाई अड्डे: 74 → 157 (2024); दोगुने से अधिक। यात्री: 61 mn → 152 mn। दुनिया का 3रा बड़ा बाजार। 5 ग्रीनफील्ड निर्माणाधीन। UDAN: 200+ रूट वापस किए।',
        },
        {
          promise: 'Kisan Rail — refrigerated freight trains to reduce post-harvest losses for farmers',
          promiseHi: 'किसान रेल — किसानों की पोस्ट-हार्वेस्ट हानि घटाने के लिए रेफ्रिजरेटेड माल ट्रेनें',
          status: 'partial',
          note: 'First Kisan Rail launched August 7, 2020 (Devlali–Danapur). 1,900+ trips operated by 2024; 8 lakh MT of fruits and vegetables transported. 50% freight subsidy for perishables notified. But: services concentrated on a handful of routes (Nashik, Sangli, Solapur → Delhi/Patna); most non-viable routes discontinued post-2022; total freight carried is a fraction of India\'s 300+ MT/year perishable post-harvest losses. Cold chain linkage at farm-end absent in most states — farmers cannot pre-cool produce before loading.',
          noteHi: '7 अगस्त 2020 पहली किसान रेल। 1,900+ यात्राएं; 8 लाख MT। 50% सब्सिडी। लेकिन: कुछ रूट पर सीमित; 2022 के बाद अधिकांश बंद; फार्म-एंड कोल्ड चेन अनुपस्थित।',
        },
      ],
    },
    {
      name: 'Antyodaya & Divyangjan',
      nameHi: 'अंत्योदय और दिव्यांगजन',
      promises: [
        {
          promise: 'Pradhan Mantri Fasal Bima Yojana — restructure crop insurance for genuine coverage at affordable premium',
          promiseHi: 'प्रधानमंत्री फसल बीमा योजना — किफायती प्रीमियम पर वास्तविक कवरेज के लिए फसल बीमा पुनर्गठन',
          status: 'partial',
          note: 'PMFBY launched 2016; restructured 2020 (states given option to join/exit; premium capped). Coverage: 5.5 crore farmers enrolled (FY24). Claims paid: ₹1.5 lakh crore (2016–2024) — real financial relief for calamity-hit farmers. But CAG (2022): ₹5,440 crore excess premium collected by insurance companies; yield estimation inaccurate in 12 states; average claim settlement: 120 days vs 45-day mandate. 7 states withdrew (2020) due to high premium burden. Voluntary enrolment rate below 25% outside loanee farmers.',
          noteHi: '5.5 करोड़ किसान; ₹1.5 लाख करोड़ दावे। CAG (2022): ₹5,440 करोड़ अधिक प्रीमियम; 12 राज्यों में उपज अनुमान गलत; 120 दिन औसत निपटान। 7 राज्य योजना से बाहर।',
        },
        {
          promise: 'PM Ujjwala Phase 2 — extend LPG to migrant workers and homeless; take total to 10 crore connections',
          promiseHi: 'PM उज्ज्वला Phase 2 — प्रवासी मजदूरों और बेघरों तक LPG पहुंचाना; कुल 10 करोड़ कनेक्शन',
          status: 'partial',
          note: 'Ujjwala Phase 2 launched August 10, 2021. 1.6 crore additional connections over Phase 1\'s 8 crore; total 9.6 crore. Phase 2 relaxed eligibility: migrant workers can get connection at current address; no address proof needed. But the core refill affordability problem persists: average refills 3-4/year vs 7-8 needed for full cooking fuel switch. LPG price rose to ₹900+ (2023) from ₹400 (2014) — erasing subsidy benefit for poor. Government restored ₹200 DBT subsidy on refills (August 2023) partially addressing this.',
          noteHi: 'Phase 2: 1.6 करोड़ अतिरिक्त; कुल 9.6 करोड़। प्रवासी पात्र। लेकिन: रिफिल 3-4/वर्ष बनाम 7-8 जरूरी; LPG ₹400 → ₹900+। ₹200 DBT सब्सिडी अगस्त 2023 में बहाल।',
        },
        {
          promise: 'Saubhagya — 100% household electrification: electricity to every rural and urban home',
          promiseHi: 'सौभाग्य — 100% घरेलू विद्युतीकरण: हर ग्रामीण और शहरी घर में बिजली',
          status: 'partial',
          note: 'PM Sahaj Bijli Har Ghar Yojana (Saubhagya) launched September 2017: target 100% by March 2019. Government claimed 100% electrification achieved on April 28, 2018 (villages) and March 31, 2019 (households). 2.82 crore households connected. But CAG (2022): 15% of "electrified" households had no functional meter or supply <4 hours/day; 5% lacked actual connection despite records. NFHS-5: 96% household electricity access (2021) but quality uneven — many rural households get 4–8 hours/day vs 24h urban.',
          noteHi: '2.82 करोड़ घर जोड़े; मार्च 2019 में 100% घोषित। CAG (2022): 15% "विद्युतीकृत" घरों में 4 घंटे से कम; 5% में कनेक्शन नहीं। NFHS-5: 96% पहुंच — लेकिन 4-8 घंटे/दिन।',
        },
        {
          promise: 'Accessible India (Sugamya Bharat) — make public spaces, transport and digital platforms accessible to Divyangjan',
          promiseHi: 'सुगम्य भारत (दिव्यांगजन) — सार्वजनिक स्थान, परिवहन और डिजिटल प्लेटफॉर्म दिव्यांगजन के लिए सुलभ',
          status: 'partial',
          note: 'Rights of Persons with Disabilities (RPwD) Act 2016: 21 disabilities recognised (up from 7). 1.15 crore Unique Disability IDs (UDID) issued (2024). 1,282 govt buildings, 700 railway stations, 100+ airports made accessible. ADIP scheme: 37 lakh assistive devices distributed. Scholarship: 2.4 lakh Divyangjan students. Gaps: only 10% of buildings tested for full compliance; Sign Language (ISL) not recognised as an official language; disability jobs reservation (4%) not met in most central departments; assistive technology access weak in rural areas.',
          noteHi: 'RPwD Act: 21 दिव्यांगताएं। 1.15 करोड़ UDID। 1,282 भवन, 700 रेलवे स्टेशन सुलभ। 37 लाख उपकरण। अंतराल: 10% भवन परीक्षित; ISL आधिकारिक भाषा नहीं; 4% आरक्षण अपूर्ण।',
        },
        {
          promise: 'PM Mudra Yojana expansion — extend micro-credit to 10 crore entrepreneurs; prioritise women and first-time borrowers',
          promiseHi: 'PM मुद्रा योजना विस्तार — 10 करोड़ उद्यमियों को माइक्रो-क्रेडिट; महिलाओं और पहली बार उधारकर्ताओं को प्राथमिकता',
          status: 'partial',
          note: 'Cumulative (2015–2024): 47 crore loans; ₹27.75 lakh crore disbursed. Women borrowers: 68% of accounts. NPA rate: 4.8% (lower than feared). But: 73% of loans are Shishu category (under ₹50,000) — insufficient for viable business creation. Kishore (₹50k–5 lakh) and Tarun (₹5–10 lakh) categories underutilised. 40% are repeat borrowers with no graduation to next tier — debt-cycling risk noted by RBI. Credit quality weaker among first-time borrowers without business plan evaluation.',
          noteHi: '47 करोड़ ऋण; ₹27.75 लाख करोड़। 68% महिलाएं। NPA 4.8%। लेकिन: 73% शिशु श्रेणी (₹50,000 से कम) — व्यवसाय के लिए अपर्याप्त। 40% दोहराने वाले उधारकर्ता — ऋण चक्र।',
        },
      ],
    },
  ],
};

// ── 2024 Manifesto ────────────────────────────────────────────────────────────
const MANIFESTO_2024: ManifestoYear = {
  year: 2024,
  title: 'Sankalp Patra 2024',
  titleHi: 'संकल्प पत्र 2024',
  tagline: 'Modi Ki Guarantee',
  taglineHi: 'मोदी की गारंटी',
  sourceUrl: 'https://www.bjp.org/manifesto',
  categories: [
    {
      name: 'Good Governance',
      nameHi: 'सुशासन',
      promises: [
        {
          promise: 'One Nation, One Election — simultaneous elections for Lok Sabha and state assemblies',
          promiseHi: 'एक राष्ट्र, एक चुनाव — लोकसभा और राज्य विधानसभाओं के एक साथ चुनाव',
          status: 'in-progress',
          note: 'Kovind Committee (2023) recommended phased rollout. Constitution Amendment Bill introduced Dec 2024, immediately referred to JPC — no floor vote taken. Needs ⅔ Parliament majority + 50%+ state ratification. Opposition parties opposed. Earliest feasible date: 2029 elections.',
          noteHi: 'कोविंद समिति (2023) ने चरणबद्ध लागू करने की सिफारिश की। संविधान संशोधन विधेयक दिसंबर 2024 में पेश, तुरंत JPC को — कोई वोट नहीं। ⅔ संसदीय बहुमत + 50%+ राज्यों की जरूरत। विपक्ष विरोध में। संभावित तारीख: 2029।',
        },
        {
          promise: 'Uniform Civil Code — implement UCC across the country',
          promiseHi: 'समान नागरिक संहिता — देशभर में UCC लागू करना',
          status: 'pending',
          note: 'Third consecutive manifesto to promise UCC. Law Commission recommended against a uniform national code (2023). Uttarakhand is the sole state with UCC in force. NDA allies JD(U) and TDP have reservations. No bill tabled in Parliament as of 2026 — BJP has the majority to pass it.',
          noteHi: 'लगातार तीसरे घोषणापत्र में UCC का वादा। विधि आयोग ने राष्ट्रीय UCC के विरुद्ध सिफारिश की (2023)। उत्तराखंड एकमात्र राज्य। NDA सहयोगी JD(U) व TDP को आपत्ति। 2026 तक संसद में कोई विधेयक नहीं।',
        },
      ],
    },
    {
      name: 'Women Empowerment',
      nameHi: 'नारी शक्ति',
      promises: [
        {
          promise: '3 crore Lakhpati Didis — enable women to earn ≥₹1 lakh/year through self-help groups',
          promiseHi: '3 करोड़ लखपति दीदी — SHG के माध्यम से महिलाओं को ₹1 लाख+/वर्ष कमाने में सक्षम बनाना',
          status: 'in-progress',
          note: '1.15 crore women achieved Lakhpati Didi status at election time (Feb 2024); target raised from 2 crore to 3 crore in Budget 2024. Works through 10 crore-member SHG network. Gap: income is self-reported by SHGs — no independent third-party verification of the ₹1 lakh+ threshold.',
          noteHi: '1.15 करोड़ चुनाव समय (फरवरी 2024) तक; लक्ष्य बजट 2024 में 3 करोड़। 10 करोड़ SHG सदस्य नेटवर्क के जरिए। कमी: आय SHG द्वारा स्व-घोषित — ₹1 लाख+ सीमा का कोई स्वतंत्र सत्यापन नहीं।',
        },
        {
          promise: 'PM Awas Yojana — 2 crore rural pucca houses, women prioritised as legal owners',
          promiseHi: 'पीएम आवास योजना — 2 करोड़ ग्रामीण पक्के मकान, महिलाएं कानूनी मालिक के रूप में प्राथमिकता',
          status: 'in-progress',
          note: 'Budget 2024 sanctioned fresh 3 crore homes (2 cr rural, 1 cr urban); ₹54,500 crore earmarked; women prioritised as legal owners. However, CAG audits of earlier PMAY batches found 35–38% incomplete and ₹600 crore paid without construction — systemic gaps not yet fixed.',
          noteHi: 'बजट 2024: नए 3 करोड़ मकान (2 करोड़ ग्रामीण, 1 करोड़ शहरी); ₹54,500 करोड़; महिलाएं कानूनी मालिक। लेकिन पूर्व CAG ऑडिट: 35–38% अधूरे, ₹600 करोड़ बिना निर्माण — जवाबदेही खाई अभी नहीं भरी।',
          cagVerdict: 'CAG Report No. 8 of 2025 (PMAY-G Performance Audit): Prior PMAY batches show 35–38% incomplete; ₹600 crore paid without construction; structural defects in completed houses.',
          cagVerdictHi: 'CAG रिपोर्ट 8/2025 (PMAY-G प्रदर्शन ऑडिट): पूर्व PMAY बैच में 35-38% अधूरे; निर्माण बिना ₹600 करोड़ भुगतान; पूर्ण मकानों में संरचनात्मक दोष।',
          cagAmountCrore: 600,
          cagSource: 'https://cag.gov.in/uploads/download_audit_report/2025/ES_PA_PMAY-ReportNo-8_English_05-15-2025-signed-copy-4-0694bb7331cf6a9.85852145.pdf',
        },
      ],
    },
    {
      name: 'Youth & Education',
      nameHi: 'युवा और शिक्षा',
      promises: [
        {
          promise: 'PM Internship Scheme — 1 crore internships in top 500 companies over 5 years',
          promiseHi: 'पीएम इंटर्नशिप योजना — 5 वर्षों में शीर्ष 500 कंपनियों में 1 करोड़ इंटर्नशिप',
          status: 'in-progress',
          note: 'Launched Oct 2024; 1.27 lakh applicants in first round. Monthly stipend: ₹5,000 (₹4,500 CSR + ₹500 govt). Target: 1 crore placements over 5 years in top 500 companies. Challenge: meeting the full crore requires 200,000 placements/year from companies whose combined net profit is ₹10+ lakh crore.',
          noteHi: 'अक्टूबर 2024 में शुरू; पहले राउंड में 1.27 लाख आवेदक। वजीफा: ₹5,000/माह (₹4,500 CSR + ₹500 सरकार)। लक्ष्य: 5 वर्षों में 1 करोड़। चुनौती: 2,00,000 प्लेसमेंट/वर्ष की जरूरत।',
        },
        {
          promise: "Facilitate India's bid to host the 2036 Olympic Games",
          promiseHi: '2036 ओलंपिक की मेजबानी के लिए भारत की बोली में सहायता',
          status: 'in-progress',
          note: 'India submitted formal IOC candidature (March 2024). Shortlisted alongside 7 nations for 2036; Ahmedabad proposed as host city. IOC decision expected 2025. Estimated cost: ₹80,000–1 lakh crore. No Parliament approval for hosting commitments or Olympic authority reform done yet.',
          noteHi: 'भारत ने IOC को औपचारिक उम्मीदवारी सौंपी (मार्च 2024)। 7 देशों के साथ शॉर्टलिस्ट; अहमदाबाद प्रस्तावित। IOC निर्णय 2025। अनुमानित लागत ₹80,000–1 लाख करोड़। संसद की मंजूरी या ओलंपिक सुधार अभी नहीं।',
        },
      ],
    },
    {
      name: 'Poor & Welfare',
      nameHi: 'गरीब कल्याण',
      promises: [
        {
          promise: 'PM Garib Kalyan Anna Yojana — extend free ration for 5 years to 80 crore beneficiaries',
          promiseHi: 'पीएम गरीब कल्याण अन्न योजना — 80 करोड़ लाभार्थियों को 5 वर्षों के लिए मुफ्त राशन बढ़ाना',
          status: 'implemented',
          note: 'Extended to Dec 2028; annual cost ₹1.97 lakh crore; 81 crore beneficiaries receive 5 kg grain/month free. Started as a COVID emergency (April 2020) and is now de facto permanent — the world\'s largest food security programme. NFHS-5 found 15–28% distribution leakage in several states.',
          noteHi: 'दिसंबर 2028 तक; वार्षिक लागत ₹1.97 लाख करोड़; 81 करोड़ लाभार्थी। COVID आपातकाल (अप्रैल 2020) से शुरू — अब व्यावहारिक रूप से स्थायी। NFHS-5: कई राज्यों में 15–28% वितरण रिसाव।',
        },
        {
          promise: 'Ayushman Bharat — extend free ₹5 lakh health cover to all citizens above 70 years',
          promiseHi: 'आयुष्मान भारत — 70 वर्ष से अधिक सभी नागरिकों को ₹5 लाख मुफ्त स्वास्थ्य कवर',
          status: 'implemented',
          note: 'Cabinet approved Sep 2024; covers all 6 crore citizens aged 70+ regardless of income (including affluent). Additional cost: ~₹3,437 crore/year. Cards being issued. Genuine benefit for elderly poor — but CAG found systemic fraud in existing PMJAY (dead-patient claims, ghost hospitals) needing stronger controls.',
          noteHi: 'सितंबर 2024 को कैबिनेट मंजूरी; 6 करोड़ 70+ नागरिक, आय की परवाह किए बिना। अतिरिक्त लागत ~₹3,437 करोड़/वर्ष। वास्तविक लाभ है — लेकिन मौजूदा PMJAY में CAG को भारी धोखाधड़ी मिली, नए विस्तार में मजबूत नियंत्रण जरूरी।',
        },
        {
          promise: 'PM JANMAN — comprehensive welfare for 75 Particularly Vulnerable Tribal Groups (PVTGs)',
          promiseHi: 'PM JANMAN — 75 विशेष रूप से कमजोर जनजातीय समूहों (PVTGs) के लिए व्यापक कल्याण',
          status: 'in-progress',
          note: 'PM Janjati Adivasi Nyaya Maha Abhiyan launched November 15, 2023 (Janjatiya Gaurav Divas). ₹24,104 crore for India\'s most marginalised tribal communities across 18 states and 22,544 PVTG habitations. 11 interventions: housing (PM Awas), drinking water, health sub-centres, anganwadis, schools, hostels, all-weather roads, mobile health vans, mobile towers and electricity. Target: 75 lakh households. By mid-2024: ~40% of habitations have begun at least one intervention; road connectivity most advanced; health sub-centres lagging.',
          noteHi: 'PM JANMAN 15 नवंबर 2023 को शुरू। ₹24,104 करोड़, 18 राज्यों में 22,544 PVTG बसाहट, 75 लाख परिवार। 11 हस्तक्षेप: आवास, जल, स्वास्थ्य, स्कूल, सड़क, मोबाइल टावर, बिजली। 2024 मध्य तक: ~40% बसाहट में कम से कम एक हस्तक्षेप शुरू।',
        },
      ],
    },
    {
      name: 'Farmers',
      nameHi: 'किसान',
      promises: [
        {
          promise: 'Continue PM-KISAN — ₹6,000/year direct income support to all eligible farmers',
          promiseHi: 'पीएम-किसान जारी — सभी पात्र किसानों को ₹6,000/वर्ष प्रत्यक्ष आय सहायता',
          status: 'implemented',
          note: '19 instalments released; ₹3.24 lakh crore transferred to 11.4 crore farmers. Backbone of farm income support. Key gap: excludes 14 crore+ tenant farmers and agricultural labourers — the poorest agricultural workers. World Bank notes affluent landowners are also enrolled.',
          noteHi: '19 किस्तें जारी; 11.4 करोड़ किसानों को ₹3.24 लाख करोड़। कृषि आय का आधार। कमी: 14 करोड़+ काश्तकार किसान और मजदूर बाहर — सबसे गरीब कृषि कामगार। विश्व बैंक: संपन्न भूस्वामी भी शामिल।',
        },
        {
          promise: 'MSP-based procurement — ensure fair minimum support price for all major crops',
          promiseHi: 'MSP आधारित खरीद — सभी प्रमुख फसलों के लिए उचित न्यूनतम समर्थन मूल्य सुनिश्चित करना',
          status: 'in-progress',
          note: 'MSP raised annually at 1.5× cost (A2+FL) for 23 crops. But only wheat and rice are procured at scale — mainly in Punjab-Haryana. Shanta Kumar Committee: only 6% of farmers can actually sell at MSP. Legal guarantee demanded by farmer unions; not provided despite the 2024 promise.',
          noteHi: 'MSP 23 फसलों के लिए 1.5× लागत (A2+FL) पर। लेकिन सिर्फ गेहूं और धान बड़े पैमाने पर — मुख्यतः पंजाब-हरियाणा में। शांता कुमार समिति: सिर्फ 6% किसान वास्तव में MSP पर बेच पाते हैं। कानूनी गारंटी — वादे के बावजूद नहीं दी।',
        },
      ],
    },
    {
      name: 'Infrastructure & Water',
      nameHi: 'बुनियादी ढांचा और जल',
      promises: [
        {
          promise: 'Har Ghar Jal — piped drinking water to every rural household under Jal Jeevan Mission',
          promiseHi: 'हर घर जल — जल जीवन मिशन के तहत हर ग्रामीण घर में नल से पेयजल',
          status: 'in-progress',
          note: '78% coverage by March 2024 — 22% of rural households still without connections. Standard is 55 LPCD for 8+ hours/day. CAG (Gujarat, 2024): 68% of "functional" connections fail this test; water quality untested in thousands of villages. Original 2024 deadline extended to 2026.',
          noteHi: 'मार्च 2024 तक 78% — 22% ग्रामीण अभी भी बिना। मानक: 55 LPCD 8+ घंटे/दिन। CAG (गुजरात 2024): 68% "कार्यात्मक" कनेक्शन इस परीक्षण में विफल। हजारों गांवों में गुणवत्ता परीक्षण नहीं। 2024 की समयसीमा 2026 तक बढ़ाई।',
          cagVerdict: 'CAG / JJM Functionality Assessment (Gujarat, 2024): 68% of connections failed the functional test; water quality not tested in many villages; ₹2,820 crore infrastructure inadequate.',
          cagVerdictHi: 'CAG / JJM कार्यात्मकता आकलन (गुजरात, 2024): 68% कनेक्शन कार्यात्मक परीक्षण में विफल; कई गांवों में जल गुणवत्ता परीक्षण नहीं; ₹2,820 करोड़ का बुनियादी ढांचा अपर्याप्त।',
          cagAmountCrore: 2820,
          cagSource: 'https://jaljeevanmission.gov.in/functionality-report-2024',
        },
        {
          promise: 'PM Surya Ghar Muft Bijli Yojana — rooftop solar for 1 crore homes, 300 units free electricity/month',
          promiseHi: 'PM सूर्य घर मुफ्त बिजली योजना — 1 करोड़ घरों में रूफटॉप सोलर, 300 यूनिट/माह मुफ्त',
          status: 'in-progress',
          note: 'Launched February 2024 with ₹75,021 crore outlay. 1.28 crore households registered; 5.5 lakh installations completed (Dec 2024) — a pace that needs to quadruple to meet the crore target by 2027. Subsidy: ₹30,000–78,000 per household depending on capacity. 300 units/month free for self-consumption. DISCOMS have been slow to issue grid-connection approvals in many states, creating installation bottlenecks.',
          noteHi: 'फरवरी 2024 में शुरू; ₹75,021 करोड़। 1.28 करोड़ पंजीकृत; 5.5 लाख इंस्टॉलेशन (दिसंबर 2024)। लक्ष्य तक पहुंचने के लिए गति 4 गुना बढ़ानी होगी। DISCOM की मंजूरी में देरी बड़ी बाधा।',
        },
        {
          promise: 'Viksit Bharat 2047 — make India a developed nation by 2047, centenary of independence',
          promiseHi: 'विकसित भारत 2047 — स्वतंत्रता की शताब्दी तक भारत को विकसित राष्ट्र बनाना',
          status: 'in-progress',
          note: 'Overarching vision announced 2023–24: GDP target of $30+ trillion by 2047 (from ~$3.9T in 2025); per-capita income to reach $12,000+ (developed-country threshold). Requires sustained 8%+ annual growth for 23 years — India has averaged 6.5% over the past decade. No statutory plan, measurable milestones or parliamentary accountability mechanism has been attached to the vision.',
          noteHi: '2047 तक GDP $30+ ट्रिलियन लक्ष्य; प्रति व्यक्ति $12,000+। 23 वर्षों तक 8%+ विकास जरूरी — पिछले दशक औसत 6.5%। कोई वैधानिक योजना या संसदीय जवाबदेही तंत्र नहीं।',
        },
        {
          promise: 'Women\'s reservation (33%) — one-third seats in Lok Sabha and state assemblies for women',
          promiseHi: 'महिला आरक्षण (33%) — लोकसभा और राज्य विधानसभाओं में महिलाओं के लिए एक-तिहाई सीटें',
          status: 'pending',
          note: 'Nari Shakti Vandan Adhiniyam passed unanimously September 2023 — historic after 27 years of failed attempts. However the law is linked to delimitation and a fresh census before it can come into force. Census has not been conducted since 2011 (overdue since 2021). Delimitation exercise requires several more years. Earliest implementation: 2029 Lok Sabha elections at best. Women MPs remain at 15% in current Parliament.',
          noteHi: 'नारी शक्ति वंदन अधिनियम सर्वसम्मति से सितंबर 2023 — 27 वर्षों बाद ऐतिहासिक। लेकिन परिसीमन और नई जनगणना से पहले लागू नहीं होगा। जनगणना 2021 से लंबित। संभावित लागू: 2029 लोकसभा। महिला सांसद अभी 15%।',
        },
        {
          promise: 'Strengthen border infrastructure — roads, connectivity and security along all international borders',
          promiseHi: 'सीमा अवसंरचना को मजबूत करना — सभी अंतर्राष्ट्रीय सीमाओं पर सड़क, संपर्क और सुरक्षा',
          status: 'in-progress',
          note: 'BRO built a record 6,806 km of roads in FY24 (3× the 2014 pace). Vibrant Villages Programme covers 663 border villages in Arunachal, Himachal, Sikkim, Uttarakhand and Ladakh with roads, internet and power (₹4,800 crore Phase 1). India-China LAC standoff since 2020 has made this a genuine strategic priority.',
          noteHi: 'BRO ने FY24 में रिकॉर्ड 6,806 km सड़क बनाई (2014 की गति का 3 गुना)। वाइब्रेंट विलेज: 5 राज्यों में 663 सीमावर्ती गांव — सड़क, इंटरनेट, बिजली (₹4,800 करोड़ Phase 1)। 2020 से LAC तनाव ने इसे वास्तविक प्राथमिकता बनाया।',
        },
      ],
    },
    {
      name: 'Technology & Innovation',
      nameHi: 'प्रौद्योगिकी और नवाचार',
      promises: [
        {
          promise: 'India AI Mission — build sovereign AI compute infrastructure; foster AI start-ups and applications',
          promiseHi: 'इंडिया AI मिशन — संप्रभु AI कम्प्यूट इन्फ्रास्ट्रक्चर; AI स्टार्टअप और अनुप्रयोगों को बढ़ावा',
          status: 'in-progress',
          note: 'Union Cabinet approved March 7, 2024: ₹10,372 crore over 5 years. Key pillars: (1) AI compute — 10,000+ GPU cluster accessible to researchers and start-ups; (2) IndiaAI datasets platform; (3) FutureSkills Prime AI upskilling; (4) AI start-up funding through iDEX and NASSCOM. NVIDIA announced 18,000 GPU supercomputer partnership with Reliance/TATA. As of late 2024: GPU procurement tender ongoing; no operational public compute yet. India ranked 7th in AI readiness (Tortoise Global AI Index 2024).',
          noteHi: 'मार्च 2024 को कैबिनेट मंजूरी: ₹10,372 करोड़। 10,000+ GPU क्लस्टर; IndiaAI डेटासेट; AI स्टार्टअप। NVIDIA ने 18,000 GPU सुपरकंप्यूटर की घोषणा। 2024 के अंत तक: GPU खरीद टेंडर जारी; कोई सार्वजनिक कम्प्यूट उपलब्ध नहीं। Tortoise AI इंडेक्स 2024 में भारत 7वें।',
        },
        {
          promise: 'Semiconductor manufacturing in India — attract fabs and OSAT units; reduce import dependence in chips',
          promiseHi: 'भारत में सेमीकंडक्टर निर्माण — फैब और OSAT इकाइयां; चिप आयात निर्भरता कम करना',
          status: 'in-progress',
          note: 'India Semiconductor Mission (ISM) under MEITY: ₹76,000 crore incentive scheme. Three units approved by Cabinet: (1) Tata Electronics–PSMC fab (Dholera, Gujarat) — 28nm/22nm technology, 50,000 wafers/month capacity; (2) Tata Semiconductor Assembly and Test OSAT (Morigaon, Assam); (3) CG Power–Renesas ATMP (Sanand, Gujarat). Construction underway at all sites; first chips expected 2025–26. India currently imports ~$40 billion in semiconductors annually. Full self-sufficiency is a decade-long journey.',
          noteHi: 'ISM: ₹76,000 करोड़। तीन इकाइयां मंजूर: (1) Tata-PSMC फैब (धोलेरा, 28nm); (2) Tata OSAT (असम); (3) CG Power ATMP (सानंद)। निर्माण शुरू; पहली चिप 2025-26। भारत अभी ~$40 अरब सेमीकंडक्टर आयात करता है।',
        },
        {
          promise: 'National Green Hydrogen Mission — produce 5 MMT of green hydrogen by 2030; become global export hub',
          promiseHi: 'राष्ट्रीय हरित हाइड्रोजन मिशन — 2030 तक 5 MMT हरित हाइड्रोजन; वैश्विक निर्यात केंद्र बनना',
          status: 'in-progress',
          note: 'Mission approved January 4, 2023. ₹19,744 crore incentive: ₹17,490 crore SIGHT (Strategic Interventions for Green Hydrogen Transition) for domestic production; ₹1,466 crore for pilot projects in steel, shipping, transport. 11 pilot projects sanctioned (2024). No commercial-scale production yet; electrolyser costs still ~4× competitive threshold. India must add 125 GW dedicated renewable capacity for 5 MMT target — significant capital challenge. MNRE expects commercial scale by 2027–28.',
          noteHi: 'जनवरी 2023 में मंजूर। ₹19,744 करोड़। 11 पायलट परियोजनाएं। अभी तक कोई व्यावसायिक उत्पादन नहीं। इलेक्ट्रोलाइजर लागत अभी प्रतिस्पर्धी सीमा से 4 गुना। 5 MMT के लिए 125 GW नवीकरणीय जरूरी। MNRE: 2027-28 तक व्यावसायिक।',
        },
      ],
    },
    {
      name: 'Farmers (Additional 2024)',
      nameHi: 'किसान (अतिरिक्त 2024)',
      promises: [
        {
          promise: 'Natural farming expansion — PM PRANAM scheme; 1 crore farmers adopt chemical-free, zero-budget farming',
          promiseHi: 'प्राकृतिक खेती विस्तार — PM PRANAM योजना; 1 करोड़ किसान रासायनिक मुक्त, शून्य-बजट खेती अपनाएं',
          status: 'in-progress',
          note: 'PM PRANAM (Promotion of Alternate Nutrients for Agriculture Management): launched in Budget 2023; ₹3,856 crore incentive pool for states that reduce chemical fertiliser consumption. Bhartiya Prakritik Krishi Paddhati (BPKP): 30 lakh farmers trained in natural farming practices (2024); ~9 lakh adopted (self-reported). Natural Farming Mission separately announced in 2024 budget. Andhra Pradesh APCNF model referenced as benchmark. Challenges: extension outreach thin outside pilot states; no third-party yield/income validation at scale; chemical fertiliser subsidy still ₹1.64 lakh crore/year — incentive structure contradicts stated goal.',
          noteHi: 'PM PRANAM: ₹3,856 करोड़। BPKP: 30 लाख प्रशिक्षित; ~9 लाख अपनाया। लेकिन: रासायनिक उर्वरक सब्सिडी ₹1.64 लाख करोड़/वर्ष — विरोधाभासी। स्वतंत्र सत्यापन नहीं।',
        },
        {
          promise: 'Nano urea and One Nation One Fertiliser — nano-liquid urea to cut import bill; unified brand for subsidised fertiliser',
          promiseHi: 'नैनो यूरिया और एक राष्ट्र एक उर्वरक — आयात बिल घटाने के लिए नैनो-तरल यूरिया; सब्सिडी उर्वरक के लिए एकीकृत ब्रांड',
          status: 'partial',
          note: 'Nano urea liquid (IFFCO, 2021): 1 bottle (500 ml) replaces 1 bag of conventional urea for foliar application; IFFCO sold 7.5 crore bottles (2024). One Nation One Fertiliser (Pradhanmantri Bhartiya Jan Urvarak Pariyojana — PMBJP): unified "Bharat" brand for urea, DAP, MOP, NPK (2022). Meant to reduce retailer malpractice. Resistance from private fertiliser companies on branding. But: nano urea efficacy disputed — ICAR trials show mixed results; urea subsidy remains ₹1.64 lakh crore (FY24); India still 4th largest urea importer.',
          noteHi: 'नैनो यूरिया: 7.5 करोड़ बोतलें। भारत ब्रांड: 2022 में। लेकिन: ICAR परीक्षण — मिश्रित परिणाम; यूरिया आयात जारी; सब्सिडी ₹1.64 लाख करोड़।',
        },
        {
          promise: 'PM Kisan Samridhi Kendras — convert 3.3 lakh agro-retail outlets into one-stop farmer service centres',
          promiseHi: 'PM किसान समृद्धि केंद्र — 3.3 लाख कृषि-खुदरा दुकानों को एकल-खिड़की किसान सेवा केंद्र में बदलना',
          status: 'in-progress',
          note: '1.85 lakh agro-retail centres converted to PM Kisan Samridhi Kendras (PMKSKs) by 2024 — against target of 3.3 lakh. Services offered: quality seeds, fertilisers, tools, soil testing, PM-KISAN status, crop insurance, Kisan credit cards. Digital integration with eSamridhi portal. Progress uneven: urban PMKSKs functional; tribal-area centres often without internet or trained staff. No independent user-satisfaction survey published. Total target of 3.3 lakh likely to take until 2027.',
          noteHi: '1.85 लाख PMKSK (3.3 लाख लक्ष्य के विरुद्ध)। बीज, उर्वरक, मृदा परीक्षण, PM-KISAN — एकल खिड़की। शहरी: कार्यात्मक; आदिवासी क्षेत्र: इंटरनेट/प्रशिक्षण की कमी।',
        },
      ],
    },
    {
      name: 'Housing & Social Reform',
      nameHi: 'आवास और सामाजिक सुधार',
      promises: [
        {
          promise: 'PMAY Urban 2.0 — 3 crore pucca homes for urban middle class and EWS; credit-linked subsidy and direct grant',
          promiseHi: 'PMAY शहरी 2.0 — शहरी मध्यम वर्ग और EWS के लिए 3 करोड़ पक्के मकान; क्रेडिट-लिंक्ड सब्सिडी और अनुदान',
          status: 'in-progress',
          note: 'Union Cabinet approved PMAY Urban 2.0 in August 2024: 1 crore urban homes (EWS/LIG/MIG) with central outlay ₹2.2 lakh crore over 5 years; Credit Linked Subsidy Scheme (CLSS) interest subsidy up to ₹2.67 lakh; Beneficiary-Led Construction (BLC) and Affordable Housing in Partnership (AHP) components. Separate 2 crore rural homes target also included in broader "3 crore" promise. Just launched — no substantial completions yet. Challenge: urban land cost often exceeds project viability; state government land bank compliance critical.',
          noteHi: 'कैबिनेट अगस्त 2024: 1 करोड़ शहरी घर; ₹2.2 लाख करोड़; CLSS ब्याज सब्सिडी। अभी शुरुआत — कोई पूर्णता नहीं। शहरी भूमि लागत: मुख्य चुनौती।',
          cagAmountCrore: 54282,
          cagVerdict: 'CAG Audit of Union Government Accounts FY 2024–25: 33,973 utilisation certificates (UCs) worth ₹54,282.32 crore outstanding as of March 31, 2025 — disbursed funds with no submitted proof of use. Ministry of Housing & Urban Affairs is among the primary flagged departments (alongside Dept of Higher Education). Additionally, ₹12,754 crore flagged as misclassified expenditure across central ministries. Note: CAG does not confirm the money is stolen — it confirms the documentation proving correct use is missing, which is itself a serious public finance governance failure.',
          cagVerdictHi: 'CAG केंद्र सरकार लेखा ऑडिट FY 2024–25: 31 मार्च 2025 तक 33,973 उपयोगिता प्रमाण पत्र (UC) लंबित — ₹54,282.32 करोड़ जारी धनराशि के उपयोग का कोई प्रमाण नहीं। आवास और शहरी कार्य मंत्रालय प्रमुख चिह्नित विभागों में (उच्च शिक्षा विभाग के साथ)। इसके अलावा ₹12,754 करोड़ गलत वर्गीकृत व्यय। नोट: CAG ने पैसा चोरी नहीं कहा — सही उपयोग का प्रमाण गायब है, जो स्वयं गंभीर वित्तीय शासन विफलता है।',
          cagSource: 'https://indianinquiry.com/cagreport/',
        },
        {
          promise: 'Waqf Amendment Act — audit and reform Waqf property management; protect rights of non-Muslim tenants and women',
          promiseHi: 'वक्फ संशोधन अधिनियम — वक्फ संपत्ति प्रबंधन का ऑडिट और सुधार; गैर-मुस्लिम किरायेदारों और महिलाओं के अधिकारों की रक्षा',
          status: 'in-progress',
          note: 'Waqf (Amendment) Bill 2024 introduced in Parliament August 8, 2024; referred to Joint Parliamentary Committee (JPC). Key provisions: non-Muslim member on Waqf Boards; district collector (not Waqf tribunal) to settle disputed properties; mandatory registration and audit of all Waqf assets; women\'s representation on Waqf Boards; government property cannot be declared Waqf. Muslim bodies (AIMPLB) call it unconstitutional; 10+ opposition parties oppose. JPC submissions ongoing. Passed by Parliament April 2025; SC petitions filed challenging it. Legally and politically contentious.',
          noteHi: 'वक्फ संशोधन बिल अगस्त 2024; JPC को। जिला कलेक्टर: विवादित संपत्ति। गैर-मुस्लिम सदस्य। AIMPLB ने असंवैधानिक बताया। संसद में अप्रैल 2025 पारित; SC में याचिकाएं।',
        },
      ],
    },
    {
      name: 'Economy & Manufacturing (2024)',
      nameHi: 'अर्थव्यवस्था और विनिर्माण (2024)',
      promises: [
        {
          promise: 'Manufacturing 25% of GDP — Make in India 2.0; PLI schemes to make India the world\'s factory',
          promiseHi: 'विनिर्माण GDP का 25% — मेक इन इंडिया 2.0; PLI योजनाएं भारत को दुनिया की फैक्ट्री बनाने के लिए',
          status: 'not-fulfilled',
          note: 'India\'s manufacturing GDP share: 17–18% (2014 and 2024 — structurally unchanged despite 10 years of Make in India). PLI across 14 sectors: ₹3.65 lakh crore investment attracted; 7.5 lakh jobs created (DPIIT). Mobile phones: India became #2 globally (Foxconn, Wistron, Dixon). Electronics exports: $23 bn (FY24) vs $4 bn (FY14). But manufacturing-to-GDP share has not moved — services sector dominance unchanged. Target of 25% by 2025 was not met. India\'s manufacturing is growing in absolute terms but not faster than services; formal manufacturing employment growth below projections.',
          noteHi: 'विनिर्माण GDP: 17-18% (2014 और 2024 — अपरिवर्तित)। PLI: ₹3.65 लाख करोड़ निवेश; 7.5 लाख नौकरियां। मोबाइल: दुनिया में दूसरा। लेकिन: 25% लक्ष्य 2025 तक नहीं मिला।',
        },
        {
          promise: 'Insurance for all — 100% insurance penetration; expand PM Jan Arogya, crop, life and property coverage',
          promiseHi: 'सबके लिए बीमा — 100% बीमा कवरेज; PM जन आरोग्य, फसल, जीवन और संपत्ति बीमा विस्तार',
          status: 'in-progress',
          note: '2024 manifesto target: "Insurance for All by 2047." Life insurance penetration: 3.2% (2023) vs 2.7% (2014) — modest improvement. Non-life: 1.0% vs 0.8%. FDI in insurance raised to 74%. Bima Sugam digital marketplace launched (2025): one portal for buying, comparing, claiming all insurance. IRDAI removed age limits for term insurance. PM Surya Ghar homes will include insurance. Major gap: 100 crore Indians have zero insurance coverage; rural penetration below 1%; health insurance covers only 55% of population (IRDAI 2023).',
          noteHi: 'लक्ष्य: 2047 तक सबके लिए बीमा। जीवन बीमा प्रवेश: 2.7% → 3.2%। Bima Sugam पोर्टल 2025। लेकिन: 100 करोड़ बिना बीमा; ग्रामीण कवरेज 1% से कम।',
        },
        {
          promise: 'ONDC — Open Network for Digital Commerce; democratise e-commerce for small sellers and buyers',
          promiseHi: 'ONDC — ओपन नेटवर्क फॉर डिजिटल कॉमर्स; छोटे विक्रेताओं और खरीदारों के लिए ई-कॉमर्स का लोकतंत्रीकरण',
          status: 'in-progress',
          note: 'ONDC launched April 2022 under DPIIT. Interoperable e-commerce network: any buyer on any app can buy from any seller registered on ONDC — challenging Amazon/Flipkart dominance. 85,000+ sellers; 5.5 mn daily orders (peak, 2024). Food delivery, grocery, mobility, financial products listed. Paytm, Magicpin, Ola, PhonePe onboarded as buyers/sellers. Growing but small: India\'s e-commerce GMV ₹16 lakh crore/year — ONDC share ~2%. Regulatory challenge: quality control, return/refund standards below Amazon/Flipkart.',
          noteHi: 'अप्रैल 2022। 85,000+ विक्रेता; 55 लाख ऑर्डर/दिन (शीर्ष)। भोजन, किराना, गतिशीलता, वित्त। लेकिन: Amazon/Flipkart बाजार का केवल 2%। गुणवत्ता नियंत्रण कमजोर।',
        },
      ],
    },
    {
      name: 'Defence & Security (2024)',
      nameHi: 'रक्षा और सुरक्षा (2024)',
      promises: [
        {
          promise: 'Defence exports ₹50,000 crore by FY29 — make India a top-10 global arms exporter',
          promiseHi: 'FY29 तक रक्षा निर्यात ₹50,000 करोड़ — भारत को शीर्ष 10 वैश्विक हथियार निर्यातक बनाना',
          status: 'in-progress',
          note: 'Defence exports: ₹686 crore (FY14) → ₹21,083 crore (FY24) — 30× rise. Previous target of ₹35,000 crore by FY25 revised upward to ₹50,000 crore by FY29. Key export: BrahMos supersonic cruise missiles (Philippines deal ₹2,900 crore; next batches in pipeline). Tejas Mk1A: letters of intent from Malaysia, Egypt. HARAS radar, Pinaka rockets, Do-228 aircraft, Akash missile — export pipeline. India now exports to 85+ countries. At FY24 pace: ₹50,000 crore target requires 2.4× growth by FY29 — ambitious but achievable if Tejas/BrahMos deals close.',
          noteHi: 'FY14: ₹686 करोड़ → FY24: ₹21,083 करोड़ (30×)। BrahMos (फिलीपींस)। Tejas, Pinaka, Akash। 85+ देशों को निर्यात। ₹50,000 करोड़ FY29 — 2.4× वृद्धि जरूरी।',
        },
        {
          promise: 'Indigenous defence platforms — INS Vikrant, Tejas Mk2, AMCA 5th-gen fighter; achieve 75% domestic defence production',
          promiseHi: 'स्वदेशी रक्षा प्लेटफॉर्म — INS विक्रांत, तेजस Mk2, AMCA; 75% स्वदेशी रक्षा उत्पादन',
          status: 'in-progress',
          note: 'INS Vikrant (IAC-1): commissioned September 2, 2022 — India\'s first indigenous aircraft carrier; 76% indigenous content; ₹20,000 crore cost. Tejas Mk1A: 83 aircraft ordered (₹46,898 crore); deliveries starting 2024. Arjun Mk2 tank upgrades. AMCA (Advanced Medium Combat Aircraft — 5th gen stealth): technology demonstration contract awarded; prototype expected 2028. Domestic defence production: ₹1.27 lakh crore (FY24) vs ₹54,953 crore (FY19). Positive indigenisation lists: 411 items. But India still imports ₹1 lakh crore in defence annually — import dependency structural.',
          noteHi: 'INS विक्रांत: 2 सितंबर 2022, 76% स्वदेशी। Tejas Mk1A: 83 ऑर्डर। AMCA: प्रोटोटाइप 2028। घरेलू उत्पादन ₹1.27 लाख करोड़। लेकिन: ₹1 लाख करोड़ वार्षिक आयात जारी।',
        },
      ],
    },
    {
      name: 'Science & Research (2024)',
      nameHi: 'विज्ञान और अनुसंधान (2024)',
      promises: [
        {
          promise: 'National Research Foundation — ₹50,000 crore over 5 years; fund basic science and bridge academia-industry gap',
          promiseHi: 'राष्ट्रीय अनुसंधान फाउंडेशन — 5 साल में ₹50,000 करोड़; बुनियादी विज्ञान और शिक्षा-उद्योग के बीच सेतु',
          status: 'in-progress',
          note: 'NRF Act 2023 enacted; ₹50,000 crore over 5 years (2023–28); PM chairs governing board. Anusandhan National Research Foundation (ANRF) operationalised 2024: ANRF Secretariat in DST; first funding calls issued (transformative research, seed grants). Early-stage: actual disbursements minimal (₹300 crore released FY24). India\'s GERD still 0.65% GDP — unchanged since 2014; NRF target to catalyse private R&D spending. Challenge: private sector in India invests <25% of total R&D vs 70%+ in China/US. NRF success depends on reversing this structural gap.',
          noteHi: 'NRF Act 2023; ₹50,000 करोड़। ANRF 2024: पहले ग्रांट कॉल। FY24: ₹300 करोड़ जारी। GERD 0.65% — अपरिवर्तित। निजी R&D <25%; चीन/अमेरिका में 70%+।',
        },
        {
          promise: 'National Quantum Mission — build quantum computers, secure communication and sensing capability by 2031',
          promiseHi: 'राष्ट्रीय क्वांटम मिशन — 2031 तक क्वांटम कंप्यूटर, सुरक्षित संचार और सेंसिंग क्षमता',
          status: 'in-progress',
          note: 'Cabinet approved National Quantum Mission (NQM) March 2023: ₹6,003 crore over 8 years (2023–31). 4 Thematic Hubs at IISc/IITs: computing, communication, sensing, materials. Milestones: 50–1,000 qubit quantum computers by 2026–31; satellite-based QKD (quantum key distribution) by 2031; 1,000 km terrestrial QKD network. India is 6th country with a national quantum mission. Early progress: IISc Bangalore: 3-qubit processor; TIFR: photonic systems. IBM Q access already available. Significant talent deficit: India has ~500 quantum researchers vs 50,000 in US.',
          noteHi: '₹6,003 करोड़ (2023-31)। 4 थीमैटिक हब। 50-1,000 qubit (2026-31); QKD 2031। IISc: 3-qubit। 6वां देश। लेकिन: ~500 शोधकर्ता बनाम अमेरिका 50,000।',
        },
        {
          promise: 'PM Shri Schools — upgrade 14,500 schools into exemplar institutions under NEP 2020',
          promiseHi: 'PM SHRI विद्यालय — NEP 2020 के तहत 14,500 स्कूलों को आदर्श संस्थानों में उन्नत करना',
          status: 'in-progress',
          note: 'PM Schools for Rising India (PM SHRI): 14,500 schools (Kendriya Vidyalayas, Navodaya, state govt) selected and upgraded with STEM labs, smart classrooms, libraries, sports facilities. ₹27,360 crore (2022–27). 6,448 schools selected Phase 1; 4,202 released first-year grants (2024). NEP integration: experiential learning, art integration, foundational literacy focus. But: opposition states (Tamil Nadu, Kerala, West Bengal, Himachal) did not sign MoU initially — coverage gap in large southern states. ASER 2023: foundational literacy at Grade 5 still only 50% nationally.',
          noteHi: '14,500 स्कूल; ₹27,360 करोड़। 6,448 Phase 1 चयनित। STEM लैब, स्मार्ट क्लास। लेकिन: TN, Kerala, WB ने MoU नहीं। ASER 2023: कक्षा 5 साक्षरता 50%।',
        },
      ],
    },
    {
      name: 'Environment & Climate (2024)',
      nameHi: 'पर्यावरण और जलवायु (2024)',
      promises: [
        {
          promise: 'Net Zero 2070 — India commits to net-zero carbon emissions by 2070; 50% power from non-fossil by 2030',
          promiseHi: 'नेट जीरो 2070 — भारत 2070 तक नेट-जीरो कार्बन उत्सर्जन; 2030 तक 50% बिजली गैर-जीवाश्म से',
          status: 'in-progress',
          note: 'India committed net-zero by 2070 at COP26 (Glasgow, October 2021) and reiterated in 2024 manifesto. Updated NDC (2022): 45% emissions-intensity reduction by 2030 (vs 2005); 50% non-fossil electricity by 2030. Progress: non-fossil power at 44% of capacity (March 2024) — close to 50% target. Emissions intensity reduced 33% (2005–2020) — early goal met. But absolute CO₂ emissions still rising (+6% FY24). India 3rd-largest emitter globally. Coal-exit timeline unspecified; new coal capacity still being added (26 GW under construction). Net Zero 2070 dependent on global climate finance that has not materialised.',
          noteHi: 'COP26 में नेट-जीरो 2070। गैर-जीवाश्म: 44% (2024)। उत्सर्जन तीव्रता: 33% कम (2005-2020)। लेकिन: CO₂ उत्सर्जन +6% FY24; 26 GW कोयला निर्माणाधीन।',
        },
        {
          promise: 'Mission LiFE — global movement for sustainable lifestyle; make India the leader of pro-planet behaviour',
          promiseHi: 'मिशन LiFE — टिकाऊ जीवनशैली के लिए वैश्विक आंदोलन; भारत को प्रो-प्लैनेट व्यवहार का नेता बनाना',
          status: 'in-progress',
          note: 'Mission LiFE (Lifestyle for Environment) launched by PM Modi at COP27 (November 2022) and endorsed at G20 (India 2023). Identifies 75 pro-planet behaviours (reducing plastic, saving energy, water conservation, choosing sustainable food). 1 crore "Pro Planet People" pledged on myGov portal. Concept resonated internationally — adopted in UN Decade of Ecosystem Restoration. But: no measurable behaviour-change data published; no budget allocated for domestic implementation; awareness in rural areas near zero. Mission is aspirational and messaging-focused rather than programme-driven.',
          noteHi: 'COP27 नवंबर 2022 और G20 2023 में लॉन्च। 75 प्रो-प्लैनेट व्यवहार। 1 करोड़ प्रतिज्ञाएं। लेकिन: कोई मापने योग्य डेटा नहीं; कोई बजट आवंटन नहीं; ग्रामीण जागरूकता शून्य।',
        },
        {
          promise: 'India at global climate leadership — host or drive COP, G20 climate outcomes, and South-South climate cooperation',
          promiseHi: 'वैश्विक जलवायु नेतृत्व — COP, G20 जलवायु परिणाम, और दक्षिण-दक्षिण जलवायु सहयोग में नेतृत्व',
          status: 'partial',
          note: 'International Solar Alliance (ISA) launched 2015 (India-France, COP21): 120+ member countries; ₹400 mn mobilised for solar in developing world. Coalition for Disaster Resilient Infrastructure (CDRI): 39 members. G20 India (2023): New Delhi Declaration included "phase down" (not phase out) of fossil fuels — a watered-down win for India. COP28 (Dubai): India pushed for climate finance; Global Goal on Adaptation adopted. India\'s Climate Finance ask: $1 trillion/year from developed world by 2030 — not agreed. India\'s credibility: strong on renewables, questioned for new coal additions.',
          noteHi: 'ISA: 120+ देश। CDRI: 39 देश। G20 2023: जीवाश्म ईंधन "phase down"। COP28: जलवायु वित्त मांग $1 ट्रिलियन — नहीं मिला। नवीकरणीय पर विश्वसनीय; कोयला पर सवाल।',
        },
      ],
    },
  ],
};

const ALL_MANIFESTOS: ManifestoYear[] = [MANIFESTO_2014, MANIFESTO_2019, MANIFESTO_2024];

// ── old arrays deleted — replaced by the above ──────────────────────────────

const PROMISE_STATUS_META: Record<PromiseStatus, { label: string; labelHi: string; dot: string; text: string; bg: string; border: string }> = {
  implemented:    { label: 'Implemented',   labelHi: 'लागू',         dot: 'bg-green-500',           text: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-950/40',   border: 'border-green-200 dark:border-green-800'   },
  partial:        { label: 'Partial / CAG Flagged', labelHi: 'आंशिक / CAG चिह्नित', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40',   border: 'border-amber-200 dark:border-amber-800'   },
  'in-progress':  { label: 'In Progress',  labelHi: 'प्रगति में',    dot: 'bg-blue-500',            text: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-200 dark:border-blue-800'     },
  'not-fulfilled':{ label: 'Not Fulfilled', labelHi: 'पूरा नहीं',   dot: 'bg-red-500',             text: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-950/40',       border: 'border-red-200 dark:border-red-800'       },
  pending:        { label: 'Pending',       labelHi: 'लंबित',        dot: 'bg-muted-foreground/40', text: 'text-muted-foreground',               bg: 'bg-muted/30',                         border: 'border-border'                            },
};



function ManifestoSection() {
  const { i18n } = useTranslation();
  const [activeYear, setActiveYear] = useState<number>(2024);
  const [open, setOpen] = useState(false);
  const [activeTermDim, setActiveTermDim] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PromiseStatus | null>(null);
  const [page, setPage] = useState(0);
  const isHi = i18n.language === 'hi';

  const manifesto = ALL_MANIFESTOS.find(m => m.year === activeYear)!;
  const allPromises = manifesto.categories.flatMap(c =>
    c.promises.map(p => ({ ...p, categoryName: c.name, categoryNameHi: c.nameHi }))
  );

  // Overall stats across ALL years for the header roll-up pills
  const allYearPromises = ALL_MANIFESTOS.flatMap(m => m.categories.flatMap(c => c.promises));
  const totalAll    = allYearPromises.length;
  const implAll     = allYearPromises.filter(p => p.status === 'implemented').length;
  const partialAll  = allYearPromises.filter(p => p.status === 'partial').length;
  const inProgAll   = allYearPromises.filter(p => p.status === 'in-progress').length;
  const failAll     = allYearPromises.filter(p => p.status === 'not-fulfilled').length;

  // Per-term scores (based on the active manifesto year)
  const termTotal     = allPromises.length;
  const termImpl      = allPromises.filter(p => p.status === 'implemented').length;
  const termPartial   = allPromises.filter(p => p.status === 'partial').length;
  const termInProg    = allPromises.filter(p => p.status === 'in-progress').length;
  const termFail      = allPromises.filter(p => p.status === 'not-fulfilled').length;
  const termPending   = allPromises.filter(p => p.status === 'pending').length;
  const implScore     = termTotal > 0 ? Math.round((termImpl + (termPartial + termInProg) * 0.5) / termTotal * 100) : 0;

  // Per-term monetary management (CAG-flagged ₹ amounts on this manifesto's promises)
  const termFlaggedCrore   = allPromises.reduce((s, p) => s + (p.cagAmountCrore ?? 0), 0);
  // National-scale formula: coefficient 15 (vs 30 for state-level) — proportionate to Union Budget scale
  const moneyScore         = termFlaggedCrore === 0
    ? 100
    : Math.max(0, Math.round(100 - 15 * Math.log10(termFlaggedCrore / 10 + 1)));
  const termFlaggedPromises = allPromises.filter(p => p.cagAmountCrore);

  // Term rating dimensions — computed per active year
  const termDims = [
    {
      key: 'implementation', icon: TrendingUp,
      label: 'Implementation', labelHi: 'क्रियान्वयन',
      score: implScore,
      rationale: `Weighted delivery rate across ${termTotal} tracked BJP ${activeYear} manifesto promises: implemented = 1.0 pt, partial / in-progress = 0.5 pt, not-fulfilled / pending = 0 pt. Breakdown: ${termImpl} implemented, ${termPartial} partial, ${termInProg} in-progress, ${termFail} not fulfilled${termPending > 0 ? `, ${termPending} pending` : ''}. Score = (${termImpl} + ${termPartial + termInProg}×0.5) ÷ ${termTotal} × 100 = ${implScore}. Cross-verified against CAG published reports and independent sources.`,
      rationaleHi: `${termTotal} BJP ${activeYear} संकल्प पत्र वादों की भारित डिलीवरी दर: लागू = 1.0, आंशिक/प्रगति में = 0.5, पूरा नहीं/लंबित = 0। विवरण: ${termImpl} लागू, ${termPartial} आंशिक, ${termInProg} प्रगति में, ${termFail} पूरा नहीं${termPending > 0 ? `, ${termPending} लंबित` : ''}। स्कोर = (${termImpl} + ${termPartial + termInProg}×0.5) ÷ ${termTotal} × 100 = ${implScore}। CAG रिपोर्टों और स्वतंत्र स्रोतों से सत्यापित।`,
      sources: `BJP Manifesto ${activeYear} · CAG of India · ADR / myneta.info`,
      sourcesHi: `BJP संकल्प पत्र ${activeYear} · CAG of India · ADR / myneta.info`,
    },
    {
      key: 'money', icon: IndianRupee,
      label: 'Monetary Management', labelHi: 'वित्तीय प्रबंधन',
      score: moneyScore,
      rationale: termFlaggedCrore === 0
        ? `No specific CAG-flagged monetary amounts found in tracked BJP ${activeYear} manifesto promises. Score defaults to 100 until CAG audit findings with rupee amounts are linked.`
        : `CAG-flagged rupee amounts across ${termFlaggedPromises.length} promise${termFlaggedPromises.length > 1 ? 's' : ''}: ₹${termFlaggedCrore.toLocaleString('en-IN')} crore total (${termFlaggedPromises.map(p => { const lbl = p.promise.length > 40 ? p.promise.slice(0, 40) + '…' : p.promise; return `₹${(p.cagAmountCrore!).toLocaleString('en-IN')} cr — ${lbl}`; }).join('; ')}). National-scale log penalty: 100 − 15×log₁₀(${termFlaggedCrore}/10 + 1) = ${moneyScore} (coefficient halved vs state formula to be proportionate to Union Budget scale). Includes funds disbursed without utilisation certificates, misclassified expenditure, and amounts paid without construction evidence.`,
      rationaleHi: termFlaggedCrore === 0
        ? `BJP ${activeYear} संकल्प पत्र वादों में CAG द्वारा चिह्नित कोई विशेष राशि नहीं मिली। स्कोर 100 डिफ़ॉल्ट है।`
        : `${termFlaggedPromises.length} वादों में CAG-चिह्नित राशि: ₹${termFlaggedCrore.toLocaleString('en-IN')} करोड़ कुल। राष्ट्रीय स्तर लॉग-स्केल दंड: 100 − 15×log₁₀(${termFlaggedCrore}/10 + 1) = ${moneyScore} (केंद्रीय बजट अनुपात में राज्य फॉर्मूले का आधा गुणांक)। उपयोगिता प्रमाण पत्र बिना, गलत वर्गीकृत व्यय और निर्माण बिना भुगतान शामिल।`,
      sources: `CAG of India published audit reports · BJP Manifesto ${activeYear}`,
      sourcesHi: `CAG of India प्रकाशित ऑडिट रिपोर्टें · BJP संकल्प पत्र ${activeYear}`,
    },
  ];

  // Per-year stats for tab badges
  const yearStats = ALL_MANIFESTOS.map(m => {
    const ps = m.categories.flatMap(c => c.promises);
    return {
      year: m.year,
      total: ps.length,
      impl: ps.filter(p => p.status === 'implemented').length,
      partial: ps.filter(p => p.status === 'partial').length,
      fail: ps.filter(p => p.status === 'not-fulfilled').length,
    };
  });

  // Per-manifesto breakdown chips
  const chips = ([
    { status: 'implemented'   as PromiseStatus, count: allPromises.filter(p => p.status === 'implemented').length },
    { status: 'partial'       as PromiseStatus, count: allPromises.filter(p => p.status === 'partial').length },
    { status: 'in-progress'   as PromiseStatus, count: allPromises.filter(p => p.status === 'in-progress').length },
    { status: 'not-fulfilled' as PromiseStatus, count: allPromises.filter(p => p.status === 'not-fulfilled').length },
    { status: 'pending'       as PromiseStatus, count: allPromises.filter(p => p.status === 'pending').length },
  ] as { status: PromiseStatus; count: number }[]).filter(c => c.count > 0);

  return (
    <div className="px-6 py-5 border-t border-border">
      {/* Section header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {isHi ? 'भाजपा चुनावी वादे (2014–2024)' : 'BJP Election Promises · 2014–2024'}
        </p>
        <a
          href={manifesto.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex-shrink-0"
        >
          {isHi ? 'स्रोत' : 'Source'} <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Overall roll-up */}
      <p className="text-[11px] text-muted-foreground mb-3">
        {isHi
          ? `तीन घोषणापत्रों में ${totalAll} प्रमुख वादों का स्वतंत्र स्रोतों और CAG रिपोर्टों से मिलान।`
          : `${totalAll} key promises across three manifestos cross-verified with CAG reports and independent sources.`}
      </p>
      <div className="flex gap-2 flex-wrap mb-4 text-[11px] font-semibold">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{implAll} {isHi ? 'लागू' : 'Implemented'}
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{partialAll} {isHi ? 'आंशिक' : 'Partial'}
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{failAll} {isHi ? 'पूरा नहीं' : 'Not Fulfilled'}
        </span>
      </div>

      {/* ── Term Rating ──────────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {isHi ? `कार्यकाल रेटिंग · ${activeYear}` : `Term Rating · ${activeYear}`}
        </p>
        {(() => {
          const activeDim = termDims.find(d => d.key === activeTermDim) ?? null;
          return (
            <>
              <div className="grid grid-cols-2 gap-1 mb-1">
                {termDims.map(dim => {
                  const { score, icon: Icon, label, labelHi } = dim;
                  const R = 28; const C = 2 * Math.PI * R; const filled = (score / 100) * C;
                  const { ring, text, bg } = scoreColor(score);
                  const sc = scoreColor(score);
                  const selected = activeTermDim === dim.key;
                  return (
                    <button
                      key={dim.key}
                      onClick={() => setActiveTermDim(prev => prev === dim.key ? null : dim.key)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 focus:outline-none ${
                        selected ? `${bg} ring-2 ring-offset-2 ring-offset-background` : 'hover:bg-muted'
                      }`}
                      style={selected ? { '--tw-ring-color': ring } as React.CSSProperties : undefined}
                    >
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                          <circle cx="32" cy="32" r={R} fill="none" stroke={ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${filled} ${C - filled}`} />
                        </svg>
                        <Icon className={`w-5 h-5 ${text} relative z-10`} />
                      </div>
                      <span className={`text-xl font-bold leading-none ${text}`}>{score}</span>
                      <span className="text-[11px] text-muted-foreground text-center leading-tight">
                        {isHi ? labelHi : label}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
                        {isHi ? sc.labelHi : sc.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeDim && (
                <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <p className="text-xs font-semibold text-foreground mb-1">
                    {isHi ? activeDim.labelHi : activeDim.label} — {isHi ? 'कार्यप्रणाली' : 'Methodology'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isHi ? activeDim.rationaleHi : activeDim.rationale}
                  </p>
                  {activeDim.key === 'money' && termFlaggedPromises.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {isHi ? 'CAG ऑडिट स्रोत' : 'CAG Audit Sources'}
                      </p>
                      {termFlaggedPromises.map((p, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-[11px]">
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-destructive tabular-nums">
                              ₹{(p.cagAmountCrore!).toLocaleString('en-IN')} cr
                            </span>
                            <span className="text-muted-foreground ml-1.5 truncate">
                              {p.promise.length > 45 ? p.promise.slice(0, 45) + '…' : p.promise}
                            </span>
                          </div>
                          {p.cagSource ? (
                            <a
                              href={p.cagSource}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center gap-0.5 text-primary hover:text-primary/80 font-medium transition-colors"
                            >
                              {isHi ? 'रिपोर्ट' : 'Report'} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="flex-shrink-0 text-muted-foreground/50 text-[10px]">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-2 leading-tight">
                    {isHi ? activeDim.sourcesHi : activeDim.sources}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/50 text-center mt-2 font-mono">
                {isHi ? 'कार्यप्रणाली के लिए रिंग टैप करें' : 'Tap a ring for methodology'}
              </p>
            </>
          );
        })()}
      </div>

      {/* Year tabs */}
      <div className="flex gap-1 mb-4 border-b border-border pb-2">
        {yearStats.map(ys => (
          <button
            key={ys.year}
            onClick={() => { setActiveYear(ys.year); setOpen(true); setStatusFilter(null); setPage(0); }}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeYear === ys.year
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {ys.year}
          </button>
        ))}
      </div>

      {/* Active manifesto subtitle */}
      <p className="text-[11px] text-muted-foreground/70 italic mb-3">
        "{isHi ? manifesto.taglineHi : manifesto.tagline}"
      </p>

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
          const sm = PROMISE_STATUS_META[c.status];
          const active = statusFilter === c.status;
          return (
            <button
              key={c.status}
              onClick={() => { setStatusFilter(active ? null : c.status); setPage(0); }}
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                active
                  ? `${sm.bg} ${sm.border} ${sm.text} ring-1 ring-offset-1 ring-offset-background`
                  : `bg-muted/40 border-border text-muted-foreground hover:text-foreground`
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
              {c.count} {isHi ? sm.labelHi : sm.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <FileSearch className="w-4 h-4" />
        {open
          ? <><ChevronUp className="w-4 h-4" />{isHi ? 'छुपाएं' : 'Hide promises'}</>
          : <><ChevronDown className="w-4 h-4" />{isHi ? `वादे देखें (${allPromises.length})` : `Browse ${activeYear} promises (${allPromises.length})`}</>
        }
      </button>

      {open && (() => {
        const PAGE_SIZE = 10;
        const filtered = statusFilter ? allPromises.filter(p => p.status === statusFilter) : allPromises;
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const safePage = Math.min(page, totalPages - 1);
        const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

        const getPaginationItems = (): (number | null)[] => {
          if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
          const set = new Set<number>();
          set.add(0);
          set.add(totalPages - 1);
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
          <div className="mt-4 flex flex-col gap-3">
            {/* Count line */}
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
              const sm = PROMISE_STATUS_META[p.status];
              return (
                <div key={safePage * PAGE_SIZE + i} className={`rounded-lg border px-4 py-3 flex flex-col gap-1.5 ${sm.bg} ${sm.border}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${sm.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} flex-shrink-0`} />
                      {isHi ? sm.labelHi : sm.label}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground/70 bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[140px]">
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
                      {p.cagSource && (
                        <a href={p.cagSource} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors underline underline-offset-2">
                          {isHi ? 'CAG रिपोर्ट देखें →' : 'View CAG Report →'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                <button
                  onClick={() => setPage(pg => Math.max(0, pg - 1))}
                  disabled={safePage === 0}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {isHi ? 'पिछला' : 'Prev'}
                </button>
                <div className="flex items-center gap-0.5">
                  {getPaginationItems().map((pg, idx) =>
                    pg === null ? (
                      <span key={`e${idx}`} className="w-5 text-center text-[10px] text-muted-foreground select-none">…</span>
                    ) : (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-6 h-6 text-[10px] font-semibold rounded transition-colors ${
                          pg === safePage
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {pg + 1}
                      </button>
                    )
                  )}
                </div>
                <button
                  onClick={() => setPage(pg => Math.min(totalPages - 1, pg + 1))}
                  disabled={safePage === totalPages - 1}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {isHi ? 'अगला' : 'Next'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                {isHi
                  ? `स्रोत: BJP ${activeYear} संकल्प पत्र · Reuters · CAG of India`
                  : `Sources: BJP ${activeYear} Manifesto · Reuters · CAG of India`}
              </p>
              <a href={manifesto.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                {isHi ? 'पूरा दस्तावेज़' : 'Full manifesto'} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CentralData() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="India's Cabinet Accountability Scorecard"
        description="Track India's 72 Union Cabinet ministers — integrity scores, criminal records, asset growth, and CAG audit findings. PIB vs CAG for every major BJP-era scheme."
        path="/"
        ogImage="/og/default.jpg"
        jsonLd={websiteJsonLd}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('centralData')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('centralDataDescription')}
          </p>
          <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">
            {t('dataSources')}: ECI affidavits · ADR/myneta.info · NFHS-5 · NCRB · MOSPI · CAG published reports · ASER 2023
          </p>
        </div>

        {/* Card — same structure as StateFactCard */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Card header */}
          <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">{t('governmentOfIndia')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('alliance')}
              </p>
            </div>
            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded flex-shrink-0">{t('indiaCode')}</span>
          </div>

          <PMCabinetSection />
          <AccountabilitySection />
          <IndicatorsSection />
          <SchemesSection />
          <CagSection />
          <ManifestoSection />

        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center font-mono mt-4">
          {t('lastUpdated')}
        </p>
      </div>
    </div>
  );
}

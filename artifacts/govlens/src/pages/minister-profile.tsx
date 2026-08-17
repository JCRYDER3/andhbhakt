import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useTranslation } from 'react-i18next';
import { SEO, ministerJsonLd } from '@/components/seo';
import {
  ArrowLeft, ExternalLink, AlertTriangle, GraduationCap,
  ShieldCheck, ShieldAlert, Calendar, Building2, Users,
  TrendingUp, FileText, Scale, IndianRupee, Home, Receipt,
  ClipboardList,
} from 'lucide-react';
import { findMinisterBySlug, type MinisterProfile } from '@/data/ministers';
import { computeIntegrityScore, assetGrowthPenalty } from '@/lib/scoring';

const MONTHS_HI: Record<string, string> = {
  January: 'जनवरी', February: 'फ़रवरी', March: 'मार्च', April: 'अप्रैल',
  May: 'मई', June: 'जून', July: 'जुलाई', August: 'अगस्त',
  September: 'सितंबर', October: 'अक्टूबर', November: 'नवंबर', December: 'दिसंबर',
};
function hiDate(date: string): string {
  return date.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
    m => MONTHS_HI[m] ?? m);
}
import type { CagReport } from '@/data/cag-reports';
import ministryNamesHiRaw from '@/data/ministry-names-hi.json';
import officialTitlesHiRaw from '@/data/official-titles-hi.json';
import ministerBioHiRaw from '@/data/minister-bio-hi.json';
import personNamesHiRaw from '@/data/person-names-hi.json';
const namesHi = personNamesHiRaw as Record<string, string>;

const ministryNamesHi = ministryNamesHiRaw as Record<string, string>;
const ministerBioHi = ministerBioHiRaw as Record<string, string>;
const officialTitlesHi = officialTitlesHiRaw as Record<string, string>;

const MINISTER_ROLE_HI: Record<string, string> = {
  'Prime Minister': 'प्रधानमंत्री',
  'Cabinet Minister': 'कैबिनेट मंत्री',
  'MoS (Independent Charge)': 'राज्य मंत्री (स्वतंत्र प्रभार)',
  'Minister of State': 'राज्य मंत्री',
};

const CAG_SEVERITY_HI: Record<string, string> = {
  high: 'उच्च', medium: 'मध्यम', low: 'कम',
};

// ── Wikipedia API ─────────────────────────────────────────────────────────────

interface WikiSummary {
  extract: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

function useWikiSummary(title?: string, langCode = 'en') {
  const [data, setData] = useState<WikiSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title) return;
    setData(null);   // clear stale text immediately on language/title change
    setLoading(true);
    let cancelled = false;
    fetch(
      `https://${langCode}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' } }
    )
      .then(r => r.json())
      .then(d => {
        // If Hindi article is missing or too short, fall back to English
        if (langCode !== 'en' && (!d?.extract || d.extract.length < 80)) {
          return fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            { headers: { Accept: 'application/json' } }
          ).then(r => r.json());
        }
        return d;
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [title, langCode]);

  return { data, loading };
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-500' };
  if (score >= 55) return { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',   ring: 'border-amber-500' };
  if (score >= 35) return { bar: 'bg-orange-500',  text: 'text-orange-600 dark:text-orange-400', ring: 'border-orange-500' };
  return                 { bar: 'bg-red-500',      text: 'text-red-600 dark:text-red-400',       ring: 'border-red-500' };
}

function ScoreChip({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const c = scoreColor(score);
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border-2 ${c.ring} px-4 py-3 min-w-[80px]`}>
      <Icon className={`w-4 h-4 ${c.text}`} />
      <span className={`text-xl font-bold leading-none ${c.text}`}>{score}</span>
      <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

function ScoreBar({ label, score, caption, colorClass }: { label: string; score: number; caption: string; colorClass: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-sm font-bold font-mono w-8 text-right flex-shrink-0">{score}</span>
      </div>
      <p className="text-xs text-muted-foreground pl-[88px] leading-snug">{caption}</p>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, className = '' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Not found ─────────────────────────────────────────────────────────────────

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold text-foreground mb-2">{t('notFoundHeading')}</h1>
        <p className="text-muted-foreground mb-6">{t('notFoundDescription')}</p>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> {t('backToCentralData')}
        </Link>
      </div>
    </div>
  );
}

// ── Profile Page ──────────────────────────────────────────────────────────────

export default function MinisterProfilePage() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';

  // Lazy-load the 9.2 MB report data
  const [allReports, setAllReports] = useState<CagReport[] | null>(null);
  useEffect(() => {
    import('@/data/cag-reports-data.json').then(m => {
      setAllReports(m.default as unknown as CagReport[]);
    });
  }, []);

  // Lazy-load the 8.5 MB Hindi translations only when language is Hindi
  const [cagHi, setCagHi] = useState<Record<string, { titleHi?: string; overviewHi?: string; findingsHi?: string[] }>>({});
  useEffect(() => {
    if (isHi) {
      import('@/data/cag-reports-hi.json').then(m => {
        setCagHi(m.default as unknown as Record<string, { titleHi?: string; overviewHi?: string; findingsHi?: string[] }>);
      });
    }
  }, [isHi]);

  const params = useParams<{ slug: string }>();
  const minister = findMinisterBySlug(params.slug ?? '');
  const { data: wiki, loading: wikiLoading } = useWikiSummary(minister?.wikiTitle, isHi ? 'hi' : 'en');

  if (!minister) return <NotFound />;

  const integrityScore = computeIntegrityScore(
    minister.criminalCases,
    minister.seriousCriminalCases ?? 0,
    minister.assetGrowthPct
  );
  const assetPenalty = assetGrowthPenalty(minister.assetGrowthPct);
  const hasCases = minister.criminalCases > 0;
  const integrityColor = scoreColor(integrityScore);
  const educationColor = scoreColor(minister.educationScore);
  const wikiUrl = wiki?.content_urls?.desktop?.page
    ?? (minister.wikiTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(minister.wikiTitle)}` : undefined);

  // CAG reports linked to this minister's department(s) — populated once data lazy-loads
  const cagReports: CagReport[] = minister.cagReportIds && allReports
    ? allReports.filter(r => minister.cagReportIds!.includes(r.id))
    : [];

  // Photo: prefer Wikipedia thumbnail, else placeholder initials
  const photoUrl = wiki?.thumbnail?.source;
  const initials = minister.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isHi
          ? `${namesHi[minister.name] ?? minister.name} — कैबिनेट मंत्री प्रोफ़ाइल`
          : `${minister.name} — Cabinet Minister Profile`}
        description={isHi
          ? `${namesHi[minister.name] ?? minister.name}, ${officialTitlesHi[minister.title] ?? minister.title}। ईमानदारी स्कोर, आपराधिक मामले (${minister.criminalCases}), संपत्ति वृद्धि और CAG लेखापरीक्षा निष्कर्ष।`
          : `${minister.name}, ${minister.title}. Integrity score, criminal cases (${minister.criminalCases}), asset growth, and CAG audit findings. AndhBhakt.org accountability tracker.`}
        path={`/minister/${params.slug}`}
        ogImage="/og/ministers.jpg"
        type="article"
        jsonLd={ministerJsonLd(minister.name, minister.title, params.slug ?? '')}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('navCentralData')}
        </Link>

        {/* ── Hero ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-5">
          {/* Coloured band */}
          <div className="h-2 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />

          <div className="px-5 pt-5 pb-6">
            <div className="flex gap-4 items-start">

              {/* Photo */}
              <div className="flex-shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={minister.name}
                    width={96}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover object-top border border-border shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-muted border border-border flex items-center justify-center">
                    <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mb-1">{minister.name}</h1>
                <p className="text-sm text-muted-foreground mb-2 leading-snug">
                  {isHi ? (ministryNamesHi[minister.ministry] ?? minister.ministry) : minister.ministry}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {isHi ? (MINISTER_ROLE_HI[minister.title] ?? officialTitlesHi[minister.title] ?? minister.title) : minister.title}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{minister.party}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {t('inOfficeSince')} {isHi ? hiDate(minister.since) : minister.since}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {t('ministryName')}
                  </span>
                </div>
              </div>
            </div>

            {/* Score chips */}
            <div className="mt-5 flex gap-3 flex-wrap">
              <ScoreChip label={t('education')} score={minister.educationScore} icon={GraduationCap} />
              <ScoreChip label={t('legalIntegrity')} score={integrityScore} icon={hasCases ? ShieldAlert : ShieldCheck} />
              {hasCases && (
                <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-red-400 px-4 py-3 min-w-[80px]">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xl font-bold leading-none text-red-600 dark:text-red-400">{minister.criminalCases}</span>
                  <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">
                    {minister.criminalCases === 1 ? t('caseSingular') : t('casePlural')} {t('casesDeclared')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4">

          {/* ── Background ── */}
          <Section title={t('background')} icon={FileText}>
            {wikiLoading && (
              <div className="space-y-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`h-3 rounded bg-muted animate-pulse ${i === 3 ? 'w-3/5' : 'w-full'}`} />
                ))}
              </div>
            )}
            {/* Hindi: use pre-translated bio; English: live Wikipedia extract */}
            {isHi ? (
              ministerBioHi[params.slug ?? ''] ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ministerBioHi[params.slug ?? '']}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('biographyUnavailable')}</p>
              )
            ) : (
              <>
                {wikiLoading && (
                  <div className="space-y-2.5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`h-3 rounded bg-muted animate-pulse ${i === 3 ? 'w-3/5' : 'w-full'}`} />
                    ))}
                  </div>
                )}
                {!wikiLoading && wiki?.extract ? (
                  <>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {wiki.extract.length > 800 ? wiki.extract.slice(0, 800) + '…' : wiki.extract}
                    </p>
                    {wikiUrl && (
                      <a href={wikiUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
                        {t('fullBiographyWikipedia')} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </>
                ) : !wikiLoading && (
                  <p className="text-sm text-muted-foreground italic">
                    {t('biographyUnavailable')}{wikiUrl && (
                      <> <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline not-italic">{t('viewOnWikipedia')}</a></>
                    )}
                  </p>
                )}
              </>
            )}
          </Section>

          {/* ── Education ── */}
          <Section title={t('education')} icon={GraduationCap}>
            <ScoreBar
              label={t('score')}
              score={minister.educationScore}
              caption={isHi ? (minister.educationHi ?? minister.education) : minister.education}
              colorClass={educationColor.bar}
            />
            <p className="mt-3 text-[11px] text-muted-foreground/50 leading-snug">
              {t('educationScoreMethodology')}
            </p>
          </Section>

          {/* ── Legal Integrity ── */}
          <Section title={t('legalIntegrity')} icon={hasCases ? ShieldAlert : ShieldCheck}>
            <ScoreBar
              label={t('score')}
              score={integrityScore}
              caption={hasCases
                ? `${minister.criminalCases} ${minister.criminalCases > 1 ? t('casePlural').toLowerCase() : t('caseSingular').toLowerCase()} ${t('casesDeclaredCaption')} (${minister.seriousCriminalCases ?? 0} ${t('seriousIpc')})`
                : t('zeroCasesDeclared')}
              colorClass={integrityColor.bar}
            />

            {minister.criminalCaseNote && (
              <div className={`mt-4 rounded-lg p-3.5 text-sm leading-relaxed ${
                hasCases
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {hasCases && <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1.5 flex-shrink-0 mb-0.5" />}
                {i18n.language === 'hi' ? (minister.criminalCaseNoteHi ?? minister.criminalCaseNote) : minister.criminalCaseNote}
              </div>
            )}

            {minister.assetGrowthPct != null && minister.assetGrowthPct > 0 && (
              <div className="mt-3 rounded-lg p-3.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 text-sm text-orange-700 dark:text-orange-300 leading-relaxed flex items-start gap-2">
                <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{t('assetDeclarationGrowth')}</strong> {i18n.language === 'hi' ? (minister.assetGrowthNoteHi ?? minister.assetGrowthNote ?? `${minister.assetGrowthPct}% ${t('increaseAffidavits')}`) : (minister.assetGrowthNote ?? `${minister.assetGrowthPct}% ${t('increaseAffidavits')}`)}
                  {assetPenalty > 0 && `${t('integrityScoreReduced')}${assetPenalty}${t('points')}`}
                </span>
              </div>
            )}

            {/* Case links */}
            {minister.caseLinks && minister.caseLinks.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t('caseAndAffidavitLinks')}</p>
                <div className="flex flex-col gap-1.5">
                  {minister.caseLinks.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline w-fit">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Always show ADR + myneta */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t('verifySourceData')}</p>
              <div className="flex flex-wrap gap-3">
                <a href="https://adrindia.org" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3 h-3" /> {t('adrIndia')}
                </a>
                <a href={`https://myneta.info/search.php?q=${encodeURIComponent(minister.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3 h-3" /> {t('mynetaAffidavit')}
                </a>
                <a href="https://affidavit.eci.gov.in/" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3 h-3" /> {t('eciAffidavitPortal')}
                </a>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-2 leading-snug">
                {t('criminalCasesSelfDeclared')} {minister.affidavitYear ?? 2024}.
              </p>
            </div>
          </Section>

          {/* ── Declared Assets & Net Worth ── */}
          {minister.declaredAssetsCr != null && (
            <Section title={t('declaredAssetsNetWorth')} icon={IndianRupee}>
              <div className="flex items-end gap-6 mb-4 flex-wrap">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    ₹{minister.declaredAssetsCr >= 100
                      ? `${minister.declaredAssetsCr.toFixed(0)} cr`
                      : `${minister.declaredAssetsCr.toFixed(2)} cr`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('totalDeclaredAssets')} {minister.declaredAssetsYear ?? minister.affidavitYear} {t('eciAffidavit')}
                  </p>
                </div>
                {minister.declaredAssetsPrevCr != null && (
                  <div>
                    <p className="text-xl font-semibold text-muted-foreground">
                      ₹{minister.declaredAssetsPrevCr >= 100
                        ? `${minister.declaredAssetsPrevCr.toFixed(0)} cr`
                        : `${minister.declaredAssetsPrevCr.toFixed(2)} cr`}
                    </p>
                    <p className="text-xs text-muted-foreground">{minister.declaredAssetsPrevYear ?? 2019} {t('affidavit')}</p>
                  </div>
                )}
              </div>

              {minister.assetGrowthPct != null && minister.assetGrowthPct > 0 && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold mb-3 ${
                  minister.assetGrowthPct > 100
                    ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                    : minister.assetGrowthPct > 50
                    ? 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                    : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                }`}>
                  <TrendingUp className="w-4 h-4" />
                  +{minister.assetGrowthPct}% {t('growth')} ({minister.declaredAssetsPrevYear ?? 2019}→{minister.declaredAssetsYear ?? 2024})
                  {assetPenalty > 0 && <span className="ml-1 opacity-75">{t('integrityPts')}{assetPenalty} {t('integrityScore').toLowerCase()} pts</span>}
                </div>
              )}

              {minister.assetGrowthNote && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{isHi ? (minister.assetGrowthNoteHi ?? minister.assetGrowthNote) : minister.assetGrowthNote}</p>
              )}

              <div className="pt-3 border-t border-border flex flex-wrap gap-3 items-center">
                <a href={`https://myneta.info/search.php?q=${encodeURIComponent(minister.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> {t('verifyOnMyneta')}
                </a>
                <a href="https://affidavit.eci.gov.in/" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> {t('eciAffidavitPortal')}
                </a>
                <a href="https://adrindia.org" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> {t('adrIndiaAnalysis')}
                </a>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-2 leading-snug">
                {t('declaredAssetsDisclaimer')}
              </p>
            </Section>
          )}

          {/* ── Residence & Government Expenditure ── */}
          {(minister.officialResidence || (minister.govtExpenditure && minister.govtExpenditure.length > 0)) && (
            <Section title={t('residenceGovernmentExpenditure')} icon={Receipt}>
              {minister.officialResidence && (
                <div className="flex items-start gap-3 mb-4 pb-4 border-b border-border">
                  <Home className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t('officialResidence')}</p>
                    <p className="text-sm font-medium text-foreground">{minister.officialResidence}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {t('governmentAllottedResidence')}
                    </p>
                  </div>
                </div>
              )}

              {minister.govtExpenditure && minister.govtExpenditure.length > 0 && (
                <div className="flex flex-col gap-3">
                  {minister.govtExpenditure.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-3.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{isHi ? (item.labelHi ?? item.label) : item.label}</p>
                      <p className="text-lg font-bold text-foreground leading-tight">{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{isHi ? (item.periodHi ?? item.period) : item.period}</p>
                      <div className="mt-2 pt-2 border-t border-border/50">
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-primary transition-colors">
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" /> {item.source}
                          </a>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/70">{item.source}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[10px] text-muted-foreground/50 leading-snug">
                {t('expenditureDisclosureDisclaimer')}
              </p>
            </Section>
          )}

          {/* ── CAG Audit Findings ── */}
          {cagReports.length > 0 && (
            <Section title={`${t('ministryAuditFindings')} (${cagReports.length} ${cagReports.length !== 1 ? t('cagReports') : t('cagReport')})`} icon={ClipboardList}>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {t('cagAuditDescription')}
              </p>
              <div className="flex flex-col gap-3">
                {cagReports.map(report => (
                  <a
                    key={report.id}
                    href={report.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-border bg-muted/30 p-3.5 hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        report.severity === 'high'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : report.severity === 'medium'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {isHi ? (CAG_SEVERITY_HI[report.severity] ?? report.severity) : report.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {report.reportNo} · {report.year}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {isHi ? (cagHi[report.id]?.titleHi ?? report.title) : report.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {(() => {
                        const text = isHi ? (cagHi[report.id]?.overviewHi ?? report.overview) : report.overview;
                        return text.length > 280 ? text.slice(0, 280) + '…' : text;
                      })()}
                    </p>
                    {report.keyFindings && report.keyFindings.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('keyFinding')}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {(() => {
                            const hiFindings = cagHi[report.id]?.findingsHi;
                            const text = isHi && hiFindings?.[0]
                              ? hiFindings[0]
                              : report.keyFindings[0].text;
                            return text.length > 220 ? text.slice(0, 220) + '…' : text;
                          })()}
                        </p>
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center gap-1 text-[10px] text-primary font-medium">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" /> {t('readCagReportPdf')}
                    </div>
                  </a>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground/50 leading-snug">
                {t('cagSourceDisclaimer')}
              </p>
            </Section>
          )}

          {/* ── Controversies ── */}
          {minister.controversies && minister.controversies.length > 0 && (
            <Section title={t('keyControversiesAllegations')} icon={Scale}>
              <ul className="flex flex-col gap-3">
                {(isHi ? (minister.controversiesHi ?? minister.controversies) : minister.controversies)!.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400
                                     text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[10px] text-muted-foreground/50 leading-snug">
                {t('controversiesDisclaimer')}
              </p>
            </Section>
          )}

          {/* ── Sources ── */}
          <Section title={t('sourcesOfficialLinks')} icon={ExternalLink}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {wikiUrl && (
                <a href={wikiUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  {t('wikipediaProfile')}
                </a>
              )}
              <a href={`https://myneta.info/search.php?q=${encodeURIComponent(minister.name)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                {t('eciAffidavitMyneta')}
              </a>
              <a href="https://adrindia.org" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                {t('adrCriminalBackgroundAnalysis')}
              </a>
              <a href="https://affidavit.eci.gov.in/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                {t('eciAffidavitPortal')}
              </a>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/50 leading-snug">
              {t('allDataSourced')}
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

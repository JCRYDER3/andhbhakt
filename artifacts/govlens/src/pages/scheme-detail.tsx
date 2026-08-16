import { useTranslation } from 'react-i18next';
import { useParams } from 'wouter';
import { SEO, schemeJsonLd } from '@/components/seo';
import schemeHiRaw from '../data/scheme-translations-hi.json';
import schemeDetailHiRaw from '../data/scheme-detail-hi.json';
import pibUnitsHiRaw from '../data/pib-units-hi.json';
import ministriesHiRaw from '../data/ministries-hi.json';
const pibUnitsHi = pibUnitsHiRaw as Record<string, string>;
const ministriesHi = ministriesHiRaw as Record<string, string>;
import { useGetScheme, useGetSchemeVerdict, useListPibEntries, useListCagAudits, getGetSchemeQueryKey, getGetSchemeVerdictQueryKey, getListPibEntriesQueryKey, getListCagAuditsQueryKey } from '@workspace/api-client-react';
import { SeverityBadge } from '@/components/severity-badge';
import { VerdictBadge } from '@/components/verdict-badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, FileText, AlertTriangle, ExternalLink, TrendingUp, Target } from 'lucide-react';
import { Link } from 'wouter';

const schemeHi: Record<string, { nameHi?: string; descriptionHi?: string; goalsHi?: string }> = schemeHiRaw as any;
const _sdHi = schemeDetailHiRaw as any;
const cagHiMap: Record<string, { parameterHi?: string; findingHi?: string; reportExcerptHi?: string; claimedHi?: string; actualHi?: string; unitHi?: string }> = _sdHi.cagMap;
const verdictHiMap: Record<string, string> = _sdHi.verdictMap;
const pibHiMap: Record<string, { headlineHi?: string; summaryHi?: string }> = _sdHi.pibMap;

/** Stable lookup key: first 120 chars lowercased — matches the key format in scheme-detail-hi.json */
function contentKey(text: string | null | undefined): string {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}
const claimTypeHi: Record<string, string> = {
  achievement: 'उपलब्धि', update: 'अपडेट', launch: 'शुभारंभ', target: 'लक्ष्य',
};

export default function SchemeDetail() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const slug = params.slug || '';

  const { data: scheme, isLoading: schemeLoading, error } = useGetScheme(slug, {
    query: { enabled: !!slug, queryKey: getGetSchemeQueryKey(slug) }
  });
  const { data: verdict, isLoading: verdictLoading } = useGetSchemeVerdict(slug, {
    query: { enabled: !!slug, queryKey: getGetSchemeVerdictQueryKey(slug) }
  });
  const { data: pibEntries = [] } = useListPibEntries(slug, {
    query: { enabled: !!slug, queryKey: getListPibEntriesQueryKey(slug) }
  });
  const { data: cagAudits = [] } = useListCagAudits(slug, {
    query: { enabled: !!slug, queryKey: getListCagAuditsQueryKey(slug) }
  });

  if (schemeLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-2/3 mb-8"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('schemeNotFound')}</h1>
            <p className="text-muted-foreground mb-6">{t('schemeNotFoundDescription')}</p>
            <Link href="/" className="text-primary hover:underline">
              {t('backToAllSchemes')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title={i18n.language === 'hi'
          ? `${schemeHi[slug]?.nameHi ?? scheme.name} — PIB दावे बनाम CAG लेखापरीक्षा निष्कर्ष`
          : `${scheme.name} — PIB Claims vs CAG Audit Findings`}
        description={i18n.language === 'hi'
          ? `${schemeHi[slug]?.nameHi ?? scheme.name} पर सरकार के दावे बनाम CAG के निष्कर्ष। मंत्रालय: ${ministriesHi[scheme.ministry] ?? scheme.ministry}। शुरुआत ${scheme.launchedYear}।`
          : `What the government claims vs what CAG found for ${scheme.name}. Ministry: ${scheme.ministry}. Launched ${scheme.launchedYear}. Evidence-based accountability.`}
        path={`/schemes/${slug}`}
        ogImage="/og/schemes.jpg"
        type="article"
        jsonLd={schemeJsonLd(scheme.name, slug, scheme.description ?? undefined)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="link-back-to-schemes">
          <ArrowLeft className="w-4 h-4" />
          {t('back')}
        </button>

        {/* Header */}
        <div className="bg-card border border-card-border rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-3" data-testid="text-scheme-name">
                {i18n.language === 'hi' ? (schemeHi[slug]?.nameHi ?? scheme.name) : scheme.name}
              </h1>
              {scheme.renamedFrom && (
                <p className="text-sm text-muted-foreground mb-3">
                  {t('previouslyKnownAs')} <span className="font-medium">{scheme.renamedFrom}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('ministry')}</span>
                  <span className="font-mono font-medium">{i18n.language === 'hi' ? (ministriesHi[scheme.ministry] ?? scheme.ministry) : scheme.ministry}</span>
                </div>
                <span className="text-muted-foreground">{t('separator')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('launched')}</span>
                  <span className="font-mono font-medium">{scheme.launchedYear}</span>
                </div>
                {scheme.budgetCrore && (
                  <>
                    <span className="text-muted-foreground">{t('separator')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{t('budget')}</span>
                      <span className="font-mono font-medium">{t('currencySymbol')}{scheme.budgetCrore.toLocaleString('en-IN')} {t('croreSuffix')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {verdict && !verdictLoading && (
              <VerdictBadge verdict={verdict.verdict as any} />
            )}
          </div>

          <p className="text-muted-foreground mb-4">
            {i18n.language === 'hi' ? (schemeHi[slug]?.descriptionHi ?? scheme.description) : scheme.description}
          </p>

          {scheme.goals && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t('statedGoals')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {i18n.language === 'hi' ? (schemeHi[slug]?.goalsHi ?? scheme.goals) : scheme.goals}
              </p>
            </div>
          )}

          {scheme.targetBeneficiaries && (
            <div className="text-sm">
              <span className="text-muted-foreground">{t('targetBeneficiaries')}</span>{' '}
              <span className="font-medium">{scheme.targetBeneficiaries}</span>
            </div>
          )}
        </div>

        {/* Accountability Verdict */}
        {verdict && !verdictLoading && (
          <div className="bg-card border border-card-border rounded-lg p-6 mb-6" data-testid="section-verdict">
            <h2 className="text-xl font-bold text-foreground mb-4">{t('accountabilityVerdict')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <div className="text-sm text-muted-foreground mb-2">{t('accountabilityScore')}</div>
                  <div className="flex items-end gap-3">
                    <div className="text-4xl font-bold font-mono text-foreground">{verdict.score}</div>
                    <div className="text-muted-foreground mb-1">{t('scoreDenominator')}</div>
                  </div>
                  <Progress value={verdict.score} className="mt-2" />
                </div>
                <p className="text-sm text-muted-foreground">{i18n.language === 'hi' ? (verdictHiMap[slug] ?? verdict.summary) : verdict.summary}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-2xl font-bold font-mono text-red-900">{verdict.criticalCount}</div>
                  <div className="text-xs text-red-700">{t('criticalSeverity')}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-2xl font-bold font-mono text-amber-900">{verdict.majorCount}</div>
                  <div className="text-xs text-amber-700">{t('majorSeverity')}</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-2xl font-bold font-mono text-yellow-900">{verdict.minorCount}</div>
                  <div className="text-xs text-yellow-700">{t('minorSeverity')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PIB vs CAG Comparison */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* PIB Claims */}
          <div className="bg-card border border-card-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">
                {t('governmentSaid')}
              </h2>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {pibEntries.length} {t('pibPressRelease')}{pibEntries.length !== 1 ? t('pluralSuffix') : ''}
            </div>
            <div className="space-y-4">
              {pibEntries.length > 0 ? (
                pibEntries.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-primary pl-4 py-2" data-testid={`pib-entry-${entry.id}`}>
                    <div className="text-xs text-muted-foreground font-mono mb-1">
                      {new Date(entry.date).toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                      {' • '}
                      <span className="uppercase">{i18n.language === 'hi' ? (claimTypeHi[entry.claimType] ?? entry.claimType) : entry.claimType}</span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{i18n.language === 'hi' ? (pibHiMap[contentKey(entry.headline)]?.headlineHi ?? entry.headline) : entry.headline}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{i18n.language === 'hi' ? (pibHiMap[contentKey(entry.headline)]?.summaryHi ?? entry.summary) : entry.summary}</p>
                    {entry.figure && (
                      <div className="text-sm font-mono font-semibold text-foreground">
                        {t('claimed')} {entry.figure} {i18n.language === 'hi' ? (pibUnitsHi[entry.figureUnit ?? ''] ?? entry.figureUnit) : entry.figureUnit}
                      </div>
                    )}
                    {entry.sourceUrl && (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        data-testid={`link-pib-source-${entry.id}`}
                      >
                        {t('source')} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('noPibEntries')}
                </div>
              )}
            </div>
          </div>

          {/* CAG Audits */}
          <div className="bg-card border border-card-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-bold text-foreground">
                {t('auditorsFound')}
              </h2>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {cagAudits.length} {t('cagAuditFinding')}{cagAudits.length !== 1 ? t('pluralSuffix') : ''}
            </div>
            <div className="space-y-4">
              {cagAudits.length > 0 ? (
                cagAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className={`border-l-2 pl-4 py-2 ${audit.severity === 'critical' ? 'border-red-600' : audit.severity === 'major' ? 'border-amber-500' : 'border-yellow-400'}`}
                    data-testid={`cag-audit-${audit.id}`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <SeverityBadge severity={audit.severity as any} />
                      <a
                        href={audit.sourceUrl ?? `https://cag.gov.in/search/?searchword=${encodeURIComponent(scheme.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border font-semibold hover:opacity-80 transition-opacity ${
                          audit.severity === 'critical'
                            ? 'bg-red-50 border-red-300 text-red-800'
                            : audit.severity === 'major'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-yellow-50 border-yellow-300 text-yellow-800'
                        }`}
                        data-testid={`audit-source-${audit.id}`}
                        title={audit.sourceUrl ? t('viewCagReport') : t('searchCagWebsite')}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {t('cagPrefix')} {audit.reportNumber}, {audit.reportYear}
                        {audit.sourceUrl && <ExternalLink className="w-3 h-3 ml-0.5" />}
                      </a>
                    </div>
                    <h4 className="font-semibold text-sm mb-2">{i18n.language === 'hi' ? (cagHiMap[contentKey(audit.parameter)]?.parameterHi ?? audit.parameter) : audit.parameter}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{i18n.language === 'hi' ? (cagHiMap[contentKey(audit.parameter)]?.findingHi ?? audit.finding) : audit.finding}</p>
                    {audit.reportExcerpt && (
                      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 mb-3">
                        <p className="text-xs text-muted-foreground italic">
                          "{i18n.language === 'hi' ? (cagHiMap[contentKey(audit.parameter)]?.reportExcerptHi ?? audit.reportExcerpt) : audit.reportExcerpt}"
                        </p>
                      </blockquote>
                    )}
                    {audit.claimed && audit.actual && (
                      <div className="bg-muted/50 rounded p-3 space-y-1">
                        {(() => {
                          const isHi = i18n.language === 'hi';
                          const hi = cagHiMap[contentKey(audit.parameter)] ?? {};
                          return <>
                            <div className="text-xs">
                              <span className="text-muted-foreground">{t('claimed')}</span>{' '}
                              <span className="font-mono font-semibold">
                                {isHi ? (hi.claimedHi ?? audit.claimed) : audit.claimed}{' '}
                                {audit.unit ? (isHi ? (hi.unitHi ?? audit.unit) : audit.unit) : null}
                              </span>
                            </div>
                            <div className="text-xs">
                              <span className="text-muted-foreground">{t('actual')}</span>{' '}
                              <span className="font-mono font-semibold">
                                {isHi ? (hi.actualHi ?? audit.actual) : audit.actual}{' '}
                                {audit.unit ? (isHi ? (hi.unitHi ?? audit.unit) : audit.unit) : null}
                              </span>
                            </div>
                            {audit.gapPercent !== null && audit.gapPercent !== undefined && (
                              <div className="text-xs font-semibold text-red-700">
                                {t('gap')} {audit.gapPercent.toFixed(1)}%
                              </div>
                            )}
                          </>;
                        })()}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('noCagAudits')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

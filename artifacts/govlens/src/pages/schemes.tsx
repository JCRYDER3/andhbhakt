import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/seo';
import { IdentityListingCard, SeveritySignal } from '@/components/ch/IdentityListingCard';
import { familyFromMinistry, hashedCardIdentity } from '@/lib/ch/stateIdentity';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Search, Filter, CircleHelp, DatabaseZap } from 'lucide-react';
import namesHiRaw from '@/data/ministries-hi.json';
import { MockSchemesSwitch } from '@/components/mock-schemes-toggle';
import { useSchemesCatalog } from '@/hooks/use-schemes-catalog';

const namesHi = namesHiRaw as Record<string, string>;

export default function Schemes() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [ministry, setMinistry] = useState<string | undefined>();
  const [severity, setSeverity] = useState<string | undefined>();

  const filtersActive = Boolean(search.trim() || categoryId || ministry || severity);
  const catalog = useSchemesCatalog({ search, categoryId, ministry, severity });
  const {
    schemes,
    categories,
    ministries,
    isLoading,
    apiFailed,
    apiEmpty,
    usingMock,
    mockEnabled,
    enableMock,
  } = catalog;

  const showOfflineBanner = apiFailed || apiEmpty || usingMock;
  const showEmpty = !isLoading && schemes.length === 0;
  const emptyBecauseFilters = showEmpty && (usingMock || (!apiFailed && filtersActive));

  return (
    <div className="ch-listing">
      <SEO
        title="Government Scheme Reality Check — PIB Claims vs CAG Findings"
        description="Compare Indian government press releases against Comptroller and Auditor General audit findings for 55+ BJP-era Union schemes. Evidence-based accountability."
        path="/schemes"
        ogImage="/og/schemes.jpg"
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <h1 className="ch-listing__title text-3xl font-bold">{t('pageHeading')}</h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--ch-text-muted)] hover:bg-[var(--ch-bg-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ch-border-focus)]"
                  aria-label={t('schemesHelpLabel')}
                >
                  <CircleHelp className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                {t('schemesHelpTooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="ch-listing__lede">{t('pageDescription')}</p>
        </div>

        {showOfflineBanner && (
          <div
            role="status"
            aria-live="polite"
            data-testid="schemes-offline-banner"
            className="mb-6 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[var(--ch-bg-panel)] px-4 py-3 text-sm text-[var(--ch-text-primary)]"
          >
            <p className="font-medium">{t('schemesOfflineBanner')}</p>
            <p className="mt-1 text-muted-foreground">{t('schemesOfflineHint')}</p>
            <div className="mt-3 flex flex-col gap-2 font-mono text-xs text-muted-foreground sm:flex-row sm:flex-wrap">
              <span>
                Windows: <code className="rounded bg-background px-1.5 py-0.5">$env:PORT=8080; pnpm --filter @workspace/api-server run start</code>
              </span>
              <span>
                *nix: <code className="rounded bg-background px-1.5 py-0.5">PORT=8080 pnpm --filter @workspace/api-server run start</code>
              </span>
            </div>
            <p className="mt-2">
              <a
                href="https://github.com/JCRYDER3/andhbhakt/blob/main/DEVELOPMENT.md"
                className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('schemesReadDevDocs')}
              </a>
            </p>
          </div>
        )}

        <div className="ch-filter-bar mb-6 p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ch-control pl-10"
                data-testid="input-search-schemes"
              />
            </div>

            <Select
              value={categoryId?.toString() || 'all'}
              onValueChange={(val) => setCategoryId(val === 'all' ? undefined : Number(val))}
            >
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder={t('allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {isHi ? (namesHi[cat.name] ?? cat.name) : cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={ministry || 'all'}
              onValueChange={(val) => setMinistry(val === 'all' ? undefined : val)}
            >
              <SelectTrigger data-testid="select-ministry">
                <SelectValue placeholder={t('allMinistries')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allMinistries')}</SelectItem>
                {ministries.map((min) => (
                  <SelectItem key={min} value={min}>
                    {isHi ? (namesHi[min] ?? min) : min}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={severity || 'all'}
              onValueChange={(val) => setSeverity(val === 'all' ? undefined : val)}
            >
              <SelectTrigger data-testid="select-severity">
                <SelectValue placeholder={t('allSeverities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allSeverities')}</SelectItem>
                <SelectItem value="critical">{t('criticalSeverity')}</SelectItem>
                <SelectItem value="major">{t('majorSeverity')}</SelectItem>
                <SelectItem value="minor">{t('minorSeverity')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(import.meta.env.DEV || mockEnabled) && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <MockSchemesSwitch compact />
              {usingMock && (
                <span className="rounded-full border border-[#fde68a]/40 bg-[#78350f]/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#fde68a]">
                  {t('schemesMockBadge')}
                </span>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-card-border bg-card p-4">
                <div className="mb-3 h-4 w-3/4 rounded bg-muted" />
                <div className="mb-2 h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : schemes.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-[var(--ch-text-secondary)]" role="status" aria-live="polite">
              {t('foundCountPrefix')} {schemes.length} {t('schemeSingular')}
              {schemes.length !== 1 ? t('schemePluralSuffix') : ''}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {schemes.map((scheme) => {
                const identity = hashedCardIdentity(String(scheme.id), familyFromMinistry(scheme.ministry));
                const sev = scheme.worstSeverity;
                const sevKind =
                  sev === 'critical' || sev === 'major' || sev === 'minor' ? sev : 'unaudited';
                return (
                  <IdentityListingCard
                    key={scheme.id}
                    identity={identity}
                    eyebrow={isHi ? (namesHi[scheme.ministry] ?? scheme.ministry) : scheme.ministry}
                    title={scheme.name}
                    headline={String(scheme.launchedYear)}
                    headlineLabel="Launched"
                    source="PIB / scheme record"
                    asOf={String(scheme.launchedYear)}
                    scope="Union of India"
                    freshness={usingMock ? 'fallback' : 'static'}
                    freshnessDetail={
                      usingMock
                        ? 'Sample catalog for local UI review — not a live API row.'
                        : 'Compiled scheme record in this checkout.'
                    }
                    chip={
                      <SeveritySignal
                        kind={sevKind}
                        label={sev ? sev : t('unaudited')}
                      />
                    }
                    href={`/schemes/${scheme.slug}`}
                    testId={`card-scheme-${scheme.slug}`}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <div
            className="py-16 text-center"
            role="status"
            aria-live="polite"
            data-testid="schemes-empty-state"
          >
            <Filter className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">{t('noSchemesFound')}</h3>
            <p className="mx-auto mb-6 max-w-md text-muted-foreground">
              {emptyBecauseFilters ? t('emptyStateHint') : t('schemesEmptyOffline')}
            </p>
            {!usingMock && (
              <Button
                type="button"
                data-testid="enable-mock-schemes"
                onClick={enableMock}
                className="min-h-11"
              >
                <DatabaseZap className="h-4 w-4" aria-hidden="true" />
                {t('schemesEnableMock')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

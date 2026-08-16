import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/seo';
import { useListSchemes, useListCategories, useListMinistries, getListSchemesQueryKey } from '@workspace/api-client-react';
import { SchemeCard } from '@/components/scheme-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import namesHiRaw from '@/data/ministries-hi.json';

const namesHi = namesHiRaw as Record<string, string>;

export default function Schemes() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [ministry, setMinistry] = useState<string | undefined>();
  const [severity, setSeverity] = useState<string | undefined>();

  const { data: schemesData, isLoading } = useListSchemes(
    { search, categoryId, ministry, severity },
    { query: { queryKey: getListSchemesQueryKey({ search, categoryId, ministry, severity }) } }
  );
  const { data: categoriesData } = useListCategories();
  const { data: ministriesData } = useListMinistries();
  const schemes = Array.isArray(schemesData) ? schemesData : [];
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const ministries = Array.isArray(ministriesData) ? ministriesData : [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title="Government Scheme Reality Check — PIB Claims vs CAG Findings"
        description="Compare Indian government press releases against Comptroller and Auditor General audit findings for 55+ BJP-era Union schemes. Evidence-based accountability."
        path="/schemes"
        ogImage="/og/schemes.jpg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('pageHeading')}</h1>
          <p className="text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-schemes"
              />
            </div>

            <Select value={categoryId?.toString() || 'all'} onValueChange={(val) => setCategoryId(val === 'all' ? undefined : Number(val))}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder={t('allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {isHi ? (namesHi[cat.name] ?? cat.name) : cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ministry || 'all'} onValueChange={(val) => setMinistry(val === 'all' ? undefined : val)}>
              <SelectTrigger data-testid="select-ministry">
                <SelectValue placeholder={t('allMinistries')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allMinistries')}</SelectItem>
                {ministries?.map((min) => (
                  <SelectItem key={min} value={min}>
                    {isHi ? (namesHi[min] ?? min) : min}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severity || 'all'} onValueChange={(val) => setSeverity(val === 'all' ? undefined : val)}>
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
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : schemes && schemes.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {t('foundCountPrefix')} {schemes.length} {t('schemeSingular')}{schemes.length !== 1 ? t('schemePluralSuffix') : ''}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schemes.map((scheme) => (
                <SchemeCard key={scheme.id} scheme={scheme} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('noSchemesFound')}</h3>
            <p className="text-muted-foreground">
              {t('emptyStateHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

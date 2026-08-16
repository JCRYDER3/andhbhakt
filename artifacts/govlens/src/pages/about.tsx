import { FileText, AlertTriangle, Scale, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/seo';

export default function About() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title="About AndhBhakt.org — India's Government Accountability Tracker"
        description="AndhBhakt.org tracks what the Indian government claims vs what CAG audits actually find. Independent, data-driven journalism on minister integrity and scheme performance."
        path="/about"
        ogImage="/og/default.jpg"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-6">{t('aboutTitle')}</h1>

        <div className="prose prose-sm max-w-none space-y-8">
          <section className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutWhatWeTrackTitle')}</h2>
            <p className="text-muted-foreground mb-4">{t('aboutWhatWeTrackP1')}</p>
            <p className="text-muted-foreground">{t('aboutWhatWeTrackP2')}</p>
          </section>

          <section className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutPibVsCagTitle')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{t('aboutPibTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{t('aboutPibDesc1')}</p>
                <p className="text-sm text-muted-foreground">{t('aboutPibDesc2')}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{t('aboutCagTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{t('aboutCagDesc1')}</p>
                <p className="text-sm text-muted-foreground">{t('aboutCagDesc2')}</p>
              </div>
            </div>
          </section>

          <section className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutSeverityTitle')}</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-20 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border bg-red-100 text-red-900 border-red-200">
                    {t('severityCritical')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{t('aboutCriticalDesc')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-20 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border bg-amber-100 text-amber-900 border-amber-200">
                    {t('severityMajor')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{t('aboutMajorDesc')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-20 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border bg-yellow-100 text-yellow-900 border-yellow-200">
                    {t('severityMinor')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{t('aboutMinorDesc')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-20 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border bg-gray-100 text-gray-700 border-gray-200">
                    {t('severityUnaudited')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{t('aboutUnauditedDesc')}</p>
              </div>
            </div>
          </section>

          <section className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutVerdictTitle')}</h2>
            <p className="text-muted-foreground mb-4">{t('aboutVerdictIntro')}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold border bg-green-100 text-green-900 border-green-200">
                  {t('verdictOnTrack')}
                </span>
                <span className="text-sm text-muted-foreground">{t('aboutOnTrackDesc')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold border bg-amber-100 text-amber-900 border-amber-200">
                  {t('verdictOffTrack')}
                </span>
                <span className="text-sm text-muted-foreground">{t('aboutOffTrackDesc')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold border bg-red-100 text-red-900 border-red-200">
                  {t('verdictCritical')}
                </span>
                <span className="text-sm text-muted-foreground">{t('aboutCriticalVerdictDesc')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold border bg-gray-100 text-gray-700 border-gray-200">
                  {t('verdictUnaudited')}
                </span>
                <span className="text-sm text-muted-foreground">{t('aboutUnauditedVerdictDesc')}</span>
              </div>
            </div>
          </section>

          <section className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutHowToUseTitle')}</h2>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>{t('aboutStep1')}</li>
              <li>{t('aboutStep2')}</li>
              <li>{t('aboutStep3')}</li>
              <li>{t('aboutStep4')}</li>
            </ol>
          </section>

          <section className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutDataSourcesTitle')}</h2>
            <p className="text-sm text-muted-foreground mb-3">{t('aboutDataSourcesIntro')}</p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>{t('aboutSourcePib')}</li>
              <li>{t('aboutSourceCag')}</li>
              <li>{t('aboutSourceMinistry')}</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">{t('aboutInfoNote')}</p>
          </section>

          <section className="bg-muted/50 border border-border rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{t('aboutDisclaimerTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('aboutDisclaimerText')}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

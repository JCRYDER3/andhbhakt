import { SEO } from '@/components/seo';
import { Link } from 'wouter';
import { ArrowLeft, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function TermsOfUse() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <SEO title={t('termsSeoTitle')} description={t('termsSeoDesc')} path="/terms" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('termsBack')}
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Scale className="w-6 h-6 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('termsTitle')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('termsLastUpdated')}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-muted-foreground">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms1Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms1P1')}</p>
            <p className="leading-relaxed text-sm mt-3">{t('terms1P2')}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms2Title')}</h2>
            <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
              <li>{t('terms2Item1')}</li>
              <li>{t('terms2Item2')}</li>
              <li>{t('terms2Item3')}</li>
              <li>{t('terms2Item4')}</li>
              <li>{t('terms2Item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms3Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms3Intro')}</p>
            <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed mt-2">
              <li>{t('terms3Item1')}</li>
              <li>{t('terms3Item2')}</li>
              <li>{t('terms3Item3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms4Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms4Intro')}</p>
            <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed mt-2">
              <li>{t('terms4Item1')}</li>
              <li>{t('terms4Item2')}</li>
              <li>{t('terms4Item3')}</li>
              <li>{t('terms4Item4')}</li>
              <li>{t('terms4Item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms5Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms5P1')}</p>
            <p className="leading-relaxed text-sm mt-3">
              {t('terms5P2')}{' '}
              <a href="https://affidavit.eci.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">affidavit.eci.gov.in</a>,{' '}
              <a href="https://cag.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">cag.gov.in</a>,{' '}
              <a href="https://adrindia.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">adrindia.org</a>,{' '}
              <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myneta.info</a>,{' '}
              <a href="https://sansad.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">sansad.in</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms6Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms6P1')}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms7Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms7P1')}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms8Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms8P1')}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms9Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms9P1')}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">{t('terms10Title')}</h2>
            <p className="leading-relaxed text-sm">{t('terms10P1')}</p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border">
          <Link href="/disclaimer" className="text-sm text-primary hover:underline">
            {t('termsReadDisclaimer')}
          </Link>
        </div>
      </div>
    </div>
  );
}

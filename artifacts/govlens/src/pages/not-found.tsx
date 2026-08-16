import { Link } from 'wouter';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-foreground mb-3">{t('notFoundTitle')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('notFoundDesc')}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('notFoundBack')}
        </Link>
      </div>
    </div>
  );
}

import { Link } from 'wouter';
import { Scale, Github, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const CLONE_CMD = 'git clone https://github.com/JCRYDER3/andhbhakt.git';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(CLONE_CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <footer className="mt-16 border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Scale className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>
              © {year} Andhbhakt.org — {t('footerTagline')}
            </span>
          </div>

          <nav aria-label={t('footerLegalNav')} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Link
              href="/terms"
              className="underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('footerTerms')}
            </Link>
            <Link
              href="/disclaimer"
              className="underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('footerDisclaimer')}
            </Link>
            <Link
              href="/about"
              className="underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('footerAbout')}
            </Link>
            <Link
              href="/report-issue"
              className="underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('footerReportIssue', 'Report an Issue')}
            </Link>
          </nav>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="https://github.com/JCRYDER3/andhbhakt"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Open source on GitHub</span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={copied ? t('cloneCopied') : t('copyCloneCommand')}
          >
            <span>{CLONE_CMD}</span>
            {copied
              ? <Check className="h-3 w-3 flex-shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />
              : <Copy className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
          </button>
        </div>

        <p className="mt-4 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground sm:text-left">
          {t('footerAttribution')}
        </p>
      </div>
    </footer>
  );
}

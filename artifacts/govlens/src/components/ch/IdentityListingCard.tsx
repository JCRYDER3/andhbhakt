import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertOctagon, Shield, Info, MinusSquare } from 'lucide-react';
import { StateYantra } from '@/components/ch/StateYantra';
import { DataFreshnessBadge } from '@/components/ch/DataFreshnessBadge';
import { useInViewOnce, usePressed } from '@/lib/ch/pointer';
import type { FreshnessKind } from '@/lib/ch/dataFreshness';
import type { YantraPattern } from '@/lib/ch/stateIdentity';

export function SeveritySignal({
  kind,
  label,
}: {
  kind: 'critical' | 'major' | 'minor' | 'high' | 'medium' | 'low' | 'central' | 'unaudited';
  label: string;
}) {
  const Icon =
    kind === 'critical' || kind === 'high'
      ? AlertOctagon
      : kind === 'major' || kind === 'medium'
        ? Shield
        : kind === 'central'
          ? MinusSquare
          : Info;
  return (
    <span className={`ch-chip-signal ch-chip-signal--${kind}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function IdentityListingCard({
  identity,
  eyebrow,
  title,
  headline,
  headlineLabel,
  source,
  asOf,
  scope,
  freshness = 'static',
  freshnessDetail,
  chip,
  actions,
  href,
  testId,
  children,
}: {
  identity: { pattern: YantraPattern; accentRgb: string };
  eyebrow: string;
  title: string;
  headline: string;
  headlineLabel?: string;
  source: string;
  asOf: string;
  scope: string;
  freshness?: FreshnessKind;
  freshnessDetail?: string;
  chip?: ReactNode;
  actions?: ReactNode;
  href?: string;
  testId?: string;
  children?: ReactNode;
}) {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.25);
  const { pressed, handlers } = usePressed();
  const className = [
    'ch-card ch-card--panel ch-state-card ch-state-card--landscape',
    inView ? 'is-inview' : '',
    pressed ? 'is-pressed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <StateYantra pattern={identity.pattern} />
      <div className="ch-state-card__scrim" aria-hidden="true" />
      <svg className="ch-state-card__ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1.2" y="1.2" width="97.6" height="97.6" rx="6" pathLength="1" />
      </svg>
      <header className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <p className="ch-label ch-page-accent-text">
          {eyebrow}
        </p>
        <DataFreshnessBadge kind={freshness} detail={freshnessDetail} source={source} />
      </header>
      <h3 className="ch-page-accent-text relative z-10 mb-2 text-base font-black leading-snug tracking-tight">
        {title}
      </h3>
      {chip ? <div className="relative z-10 mb-3">{chip}</div> : null}
      <p className="ch-metric__value relative z-10 mb-1">{headline}</p>
      {headlineLabel ? (
        <p className="ch-label relative z-10 mb-3">{headlineLabel}</p>
      ) : null}
      <dl className="relative z-10 space-y-1 text-[11px] text-[var(--ch-text-secondary)]">
        <div>Source · {source}</div>
        <div>As of · {asOf}</div>
        <div>Scope · {scope}</div>
      </dl>
      {children ? <div className="relative z-10 mt-3">{children}</div> : null}
      {actions ? <div className="relative z-10 mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </>
  );

  if (href) {
    return (
      <article
        ref={ref}
        className={className}
        style={{ ['--ch-state-rgb' as string]: identity.accentRgb }}
        data-testid={testId}
        {...handlers}
      >
        <Link href={href} className="block focus-visible:outline-none">
          {inner}
        </Link>
      </article>
    );
  }

  return (
    <article
      ref={ref}
      className={className}
      style={{ ['--ch-state-rgb' as string]: identity.accentRgb }}
      data-testid={testId}
      {...handlers}
    >
      {inner}
    </article>
  );
}

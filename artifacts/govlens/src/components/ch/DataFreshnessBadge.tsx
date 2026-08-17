import { useId } from 'react';
import {
  FRESHNESS_DOT,
  FRESHNESS_LABEL,
  formatUpdatedAgo,
  type FreshnessKind,
  type FreshnessMeta,
} from '@/lib/ch/dataFreshness';
import { useCitationReveal } from '@/lib/ch/pointer';

export function DataFreshnessBadge({
  kind,
  detail,
  source,
  fetchedAt,
  meta,
  className = '',
  testId,
}: {
  kind?: FreshnessKind;
  detail?: string;
  source?: string;
  fetchedAt?: number;
  meta?: FreshnessMeta;
  className?: string;
  testId?: string;
}) {
  const resolvedKind = meta?.kind ?? kind ?? 'static';
  const resolvedSource = meta?.source ?? source ?? '';
  const resolvedFetched = meta?.fetchedAt ?? fetchedAt;
  const resolvedDetail =
    meta?.detail ??
    detail ??
    (resolvedKind === 'live' && resolvedSource
      ? `Live via ${resolvedSource}, updated ${formatUpdatedAgo(resolvedFetched)}`
      : FRESHNESS_LABEL[resolvedKind]);

  const tipId = useId();
  const label = FRESHNESS_LABEL[resolvedKind];
  const color = FRESHNESS_DOT[resolvedKind];
  const { open, handlers } = useCitationReveal();

  return (
    <button
      type="button"
      className={`ch-freshness ${className}`.trim()}
      data-kind={resolvedKind}
      data-open={open ? 'true' : 'false'}
      data-testid={testId ?? `freshness-${resolvedKind}`}
      aria-label={`${label}: ${resolvedDetail}`}
      aria-describedby={tipId}
      aria-expanded={open}
      onPointerDown={(e) => {
        e.stopPropagation();
        handlers.onPointerDown(e);
      }}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onClick={(e) => {
        e.stopPropagation();
        handlers.onClick(e);
      }}
      onKeyDown={handlers.onKeyDown}
    >
      <span
        className="ch-freshness__dot"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        aria-hidden="true"
      />
      <span className="ch-freshness__label" style={{ color }}>
        {label}
      </span>
      <span id={tipId} className="ch-freshness__tip" role="tooltip">
        {resolvedDetail}
      </span>
    </button>
  );
}

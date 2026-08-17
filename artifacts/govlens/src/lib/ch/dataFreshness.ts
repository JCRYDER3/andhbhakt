export type FreshnessKind = 'live' | 'fallback' | 'static' | 'ai';

export const FRESHNESS_LABEL: Record<FreshnessKind, string> = {
  live: 'LIVE',
  fallback: 'FALLBACK',
  static: 'STATIC',
  ai: 'AI',
};

export const FRESHNESS_DOT: Record<FreshnessKind, string> = {
  live: '#10b981',
  fallback: '#f59e0b',
  static: '#a8a29e',
  ai: '#8b5cf6',
};

export interface FreshnessMeta {
  kind: FreshnessKind;
  source: string;
  detail: string;
  fetchedAt?: number;
}

export function staticFreshness(source: string, detail: string): FreshnessMeta {
  return { kind: 'static', source, detail };
}

export function formatUpdatedAgo(fetchedAt?: number, now: number = Date.now()): string {
  if (!fetchedAt) return 'time unknown';
  const sec = Math.max(0, Math.round((now - fetchedAt) / 1000));
  if (sec < 15) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)}h ago`;
}

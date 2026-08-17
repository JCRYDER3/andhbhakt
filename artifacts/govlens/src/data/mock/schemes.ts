// FOR DEV ONLY — loaders around schemes.sample.json. Not used in production API paths.
import type { Category, SchemeSummary } from '@workspace/api-client-react';
import sample from './schemes.sample.json';

export type SchemeFilters = {
  search?: string;
  categoryId?: number;
  ministry?: string;
  severity?: string;
};

export const MOCK_CATEGORIES: Category[] = sample.categories as Category[];
export const MOCK_SCHEMES: SchemeSummary[] = sample.schemes as SchemeSummary[];

export const MOCK_MINISTRIES: string[] = [...new Set(MOCK_SCHEMES.map((s) => s.ministry))].sort();

export function filterMockSchemes(filters: SchemeFilters): SchemeSummary[] {
  const q = (filters.search ?? '').trim().toLowerCase();
  return MOCK_SCHEMES.filter((s) => {
    if (filters.categoryId != null && s.categoryId !== filters.categoryId) return false;
    if (filters.ministry && s.ministry !== filters.ministry) return false;
    if (filters.severity === 'null' || filters.severity === 'unaudited') {
      if (s.worstSeverity) return false;
    } else if (filters.severity && s.worstSeverity !== filters.severity) {
      return false;
    }
    if (q) {
      const hay = `${s.name} ${s.ministry} ${s.description ?? ''} ${s.categoryName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function isMockSchemesQueryEnabled(): boolean {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_MOCK_SCHEMES === '1';
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('mockSchemes') === '1' || import.meta.env.VITE_MOCK_SCHEMES === '1';
}

export function setMockSchemesQuery(enabled: boolean) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('mockSchemes', '1');
  else url.searchParams.delete('mockSchemes');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

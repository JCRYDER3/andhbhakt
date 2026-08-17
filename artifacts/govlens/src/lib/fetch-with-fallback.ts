/**
 * Dev fetch helper: try the live API, then fall back to the sample catalog.
 * Used when the Vite proxy returns 502 { error: "API unreachable" } because
 * nothing is listening on :8080 (typical Windows UI-only checkout).
 */
import type { SchemeSummary } from '@workspace/api-client-react';
import {
  MOCK_CATEGORIES,
  MOCK_MINISTRIES,
  MOCK_SCHEMES,
  filterMockSchemes,
  type SchemeFilters,
} from '@/data/mock/schemes';

export type CatalogSource = 'api' | 'mock';

export type SchemesCatalogResult = {
  source: CatalogSource;
  schemes: SchemeSummary[];
  categories: typeof MOCK_CATEGORIES;
  ministries: string[];
  apiUnreachable: boolean;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function isApiUnreachablePayload(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === 'object' &&
      'error' in data &&
      (data as { error?: string }).error === 'API unreachable',
  );
}

const API_DOWN_KEY = 'govlens-api-down';

export async function probeApiHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(API_DOWN_KEY) === '1') {
      return false;
    }
    const res = await fetch('/api/health', { signal });
    const data = await readJson(res);
    if (!res.ok || isApiUnreachablePayload(data)) {
      sessionStorage?.setItem(API_DOWN_KEY, '1');
      return false;
    }
    if (data && typeof data === 'object' && 'status' in data) {
      const ok = (data as { status?: string }).status === 'ok';
      if (ok) sessionStorage?.removeItem(API_DOWN_KEY);
      return ok;
    }
    return true;
  } catch {
    sessionStorage?.setItem(API_DOWN_KEY, '1');
    return false;
  }
}

export async function fetchSchemesWithFallback(
  filters: SchemeFilters,
  signal?: AbortSignal,
): Promise<SchemesCatalogResult> {
  try {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.categoryId != null) params.set('categoryId', String(filters.categoryId));
    if (filters.ministry) params.set('ministry', filters.ministry);
    if (filters.severity) params.set('severity', filters.severity);
    const qs = params.toString();
    const res = await fetch(`/api/schemes${qs ? `?${qs}` : ''}`, { signal });
    const data = await readJson(res);
    if (!res.ok || isApiUnreachablePayload(data) || !Array.isArray(data)) {
      throw new Error('API unavailable');
    }
    if (data.length === 0) {
      throw new Error('Empty array');
    }
    return {
      source: 'api',
      schemes: data as SchemeSummary[],
      categories: MOCK_CATEGORIES,
      ministries: MOCK_MINISTRIES,
      apiUnreachable: false,
    };
  } catch {
    return {
      source: 'mock',
      schemes: filterMockSchemes(filters),
      categories: MOCK_CATEGORIES,
      ministries: MOCK_MINISTRIES,
      apiUnreachable: true,
    };
  }
}

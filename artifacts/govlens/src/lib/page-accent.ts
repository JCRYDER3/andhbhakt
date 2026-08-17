/** Per-page accent. 8 presets plus a free hex. Stored in localStorage, never sent to a server. */

import { readableOn } from '@/lib/contrast';

export const PAGE_ACCENTS = [
  { id: 'saffron', hex: '#c2410c', label: 'Saffron' },
  { id: 'gold', hex: '#eab308', label: 'Gold' },
  { id: 'forest', hex: '#10b981', label: 'Forest' },
  { id: 'air', hex: '#38bdf8', label: 'Air' },
  { id: 'water', hex: '#0d9488', label: 'Water' },
  { id: 'earth', hex: '#b45309', label: 'Earth' },
  { id: 'orchid', hex: '#c026d3', label: 'Orchid' },
  { id: 'rose', hex: '#e11d48', label: 'Rose' },
] as const;

export const DEFAULT_PAGE_ACCENT = PAGE_ACCENTS[0].hex;
const STORAGE_KEY = 'andhbhakt-page-accents';

export function hexToRgb(hex: string): string {
  const n = hex.replace('#', '').trim();
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const v = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(v)) return '194, 65, 12';
  return `${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}`;
}

export function pageAccentKey(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  if (pathname === '/central-data') return '/';
  if (pathname === '/central-schemes' || pathname.startsWith('/schemes')) return '/schemes';
  if (pathname.startsWith('/minister')) return '/minister';
  return pathname;
}

function readStore(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getPageAccent(pathname: string): string {
  const stored = readStore()[pageAccentKey(pathname)];
  return stored && /^#?[0-9a-fA-F]{3,8}$/.test(stored)
    ? stored.startsWith('#')
      ? stored
      : `#${stored}`
    : DEFAULT_PAGE_ACCENT;
}

export function setPageAccent(pathname: string, hex: string) {
  const next = { ...readStore(), [pageAccentKey(pathname)]: hex };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyPageAccent(hex);
}

export function applyPageAccent(hex: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const text = readableOn(hex, '#161618', 4.55);
  root.style.setProperty('--page-accent', hex);
  root.style.setProperty('--page-accent-rgb', hexToRgb(hex));
  root.style.setProperty('--page-accent-text', text);
  root.style.setProperty('--ch-accent', text);
  root.style.setProperty('--ch-border-focus', `rgba(${hexToRgb(hex)}, 0.55)`);
}

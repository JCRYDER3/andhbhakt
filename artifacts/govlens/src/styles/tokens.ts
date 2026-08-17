/**
 * JS mirror of src/styles/tokens.css.
 * Use these when a component needs token values in script (inline styles, charts).
 * Prefer Tailwind semantic classes (bg-primary, text-muted-foreground) in markup.
 */

export const color = {
  primary: 'hsl(22 90% 42%)',
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(215 20% 92%)',
  secondaryForeground: 'hsl(215 28% 14%)',
  background: 'hsl(210 20% 98%)',
  foreground: 'hsl(215 28% 10%)',
  muted: 'hsl(215 16% 94%)',
  mutedForeground: 'hsl(215 18% 32%)',
  accent: 'hsl(215 78% 42%)',
  destructive: 'hsl(0 78% 46%)',
  card: 'hsl(0 0% 100%)',
  border: 'hsl(215 16% 84%)',
  ring: 'hsl(22 90% 42%)',
  chart: {
    critical: 'hsl(0 78% 46%)',
    major: 'hsl(32 90% 40%)',
    minor: 'hsl(42 90% 38%)',
    onTrack: 'hsl(148 62% 32%)',
    unaudited: 'hsl(215 12% 42%)',
  },
} as const;

export const font = {
  sans: "'Space Grotesk', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'IBM Plex Mono', ui-monospace, 'Courier New', monospace",
} as const;

export const type = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  leadingBody: 1.5,
  leadingTight: 1.25,
} as const;

export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

export const radius = {
  sm: '0.125rem',
  md: '0.25rem',
  lg: '0.375rem',
  xl: '0.625rem',
  full: '9999px',
} as const;

export const elevation = {
  sm: '0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.08)',
  md: '0 4px 6px -2px rgb(15 23 42 / 0.05), 0 10px 15px -3px rgb(15 23 42 / 0.08)',
  lg: '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 20px 25px -5px rgb(15 23 42 / 0.1)',
} as const;

export const layout = {
  headerHeight: '4rem',
  touchMin: '2.75rem',
  contentMax: '80rem',
} as const;

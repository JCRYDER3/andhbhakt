/** WCAG 2.x relative luminance and contrast. */

export function parseHex(hex: string): [number, number, number] {
  const n = hex.replace('#', '').trim();
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n.padEnd(6, '0');
  const v = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(v)) return [194, 65, 12];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function srgbToLin(channel: number): number {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAa(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? 3 : 4.5);
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Lighten a decorative accent until body text on `bg` clears 4.5:1. */
export function readableOn(hex: string, bg: string, min = 4.55): string {
  let [r, g, b] = parseHex(hex);
  for (let i = 0; i < 48; i += 1) {
    const next = toHex(r, g, b);
    if (contrastRatio(next, bg) >= min) return next;
    r = Math.min(255, r + 7);
    g = Math.min(255, g + 7);
    b = Math.min(255, b + 7);
  }
  return '#f5f5f4';
}

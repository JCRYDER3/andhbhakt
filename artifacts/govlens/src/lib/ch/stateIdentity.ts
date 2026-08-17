/** Decorative card identity — copied from CropHealth hashedCardIdentity. Not a freshness signal. */

export type YantraPattern = 'sri' | 'lotus' | 'star' | 'grid' | 'hex';
export type IdentityFamily = 'gold' | 'air' | 'forest' | 'water' | 'earth' | 'orchid';

export const YANTRA_PATTERNS: readonly YantraPattern[] = ['sri', 'lotus', 'star', 'grid', 'hex'];

export const FAMILY_RGB: Record<IdentityFamily, string> = {
  gold: '234, 179, 8',
  air: '56, 189, 248',
  forest: '16, 185, 129',
  water: '13, 148, 176',
  earth: '180, 83, 9',
  orchid: '192, 38, 211',
};

export const fnv1a = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return [f(0), f(8), f(4)];
};

export const hashedCardIdentity = (
  id: string,
  family: IdentityFamily = 'gold',
): { pattern: YantraPattern; accentHex: string; accentRgb: string; hue: number; family: IdentityFamily } => {
  const hash = fnv1a(id);
  const hue0 = { gold: 42, air: 192, forest: 148, water: 200, earth: 14, orchid: 292 }[family];
  const hue = (hue0 + (hash % 16) - 4 + 360) % 360;
  const sat = 46 + (hash % 8);
  const light = 56 + ((hash >> 8) % 6);
  const [r, g, b] = hslToRgb(hue, sat, light);
  return {
    pattern: YANTRA_PATTERNS[hash % YANTRA_PATTERNS.length],
    accentHex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`,
    accentRgb: `${r}, ${g}, ${b}`,
    hue: Math.round(hue * 10) / 10,
    family,
  };
};

export function familyFromMinistry(ministry: string): IdentityFamily {
  const s = ministry.toLowerCase();
  if (/hous|urban affairs|slum/.test(s)) return 'earth';
  if (/health|family welfare|ayush/.test(s)) return 'orchid';
  if (/agricult|farmer|kisan/.test(s)) return 'forest';
  if (/jal|water|shakti/.test(s)) return 'water';
  if (/power|petroleum|energy|renewable/.test(s)) return 'gold';
  if (/educat|school|human resource/.test(s)) return 'air';
  if (/women|child|wcd/.test(s)) return 'orchid';
  if (/skill|employ|labour/.test(s)) return 'gold';
  if (/rural|panchayat/.test(s)) return 'earth';
  if (/finance|revenue|tax/.test(s)) return 'gold';
  return 'air';
}

export function familyFromCoalition(coalition: string): IdentityFamily {
  if (coalition === 'NDA') return 'gold';
  if (coalition === 'INDIA') return 'forest';
  if (coalition === 'State') return 'water';
  return 'orchid';
}

export function familyFromSector(sector: string): IdentityFamily {
  const s = sector.toLowerCase();
  if (/lotter|gaming|hotel/.test(s)) return 'gold';
  if (/infra|engineer|construct|real/.test(s)) return 'earth';
  if (/min|coal|steel/.test(s)) return 'forest';
  if (/telecom|airtel|tech/.test(s)) return 'air';
  if (/health|pharma|hospital/.test(s)) return 'orchid';
  if (/power|energy/.test(s)) return 'gold';
  return 'earth';
}

export function familyFromCagWing(category: string, ministry = ''): IdentityFamily {
  const s = `${category} ${ministry}`.toLowerCase();
  if (/financ|revenue|tax/.test(s)) return 'gold';
  if (/environment|mining|forest/.test(s)) return 'forest';
  if (/infra|road|rail|urban|housing|performance/.test(s)) return 'earth';
  if (/health|social|women|child/.test(s)) return 'orchid';
  if (/psu|rural|jal|water/.test(s)) return 'water';
  if (/compliance/.test(s)) return 'air';
  return 'earth';
}

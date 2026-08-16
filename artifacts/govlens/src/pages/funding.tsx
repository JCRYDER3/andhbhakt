import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/seo';
import {
  BONDS_META, PARTY_FUNDING, TOP_DONORS, PARTY_COLOR, PARTY_INCOME_HISTORY,
  PARTY_CLOSING_BALANCE, type Donor,
} from '@/data/funding-data';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle, IndianRupee, Building2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

const COALITION_HI: Record<string, string> = {
  'NDA': 'NDA',
  'INDIA': 'INDIA गठबंधन',
  'State': 'राज्य दल',
  'Other': 'अन्य',
};

function fmt(crore: number, isHi = false): string {
  if (crore >= 1000) return `₹${(crore / 1000).toFixed(1)}${isHi ? 'K करोड़' : 'K cr'}`;
  if (crore < 1)     return `₹${Math.round(crore * 100)} ${isHi ? 'ला.' : 'L'}`;
  return `₹${crore.toLocaleString('en-IN')} ${isHi ? 'करोड़' : 'cr'}`;
}

function fmtFull(crore: number, isHi = false): string {
  if (crore < 1) return `₹${Math.round(crore * 100)} ${isHi ? 'लाख' : 'lakh'}`;
  return `₹${crore.toLocaleString('en-IN')} ${isHi ? 'करोड़' : 'crore'}`;
}

const IDEOLOGY_HI: Record<string, string> = {
  'Hindu nationalism, Centre-right': 'हिंदू राष्ट्रवाद, केंद्र-दक्षिण',
  'Social democracy, Bengal regionalism': 'सामाजिक लोकतंत्र, बंगाल क्षेत्रवाद',
  'Social liberalism, Secularism': 'सामाजिक उदारवाद, धर्मनिरपेक्षता',
  'Telangana regionalism, Progressive': 'तेलंगाना क्षेत्रवाद, प्रगतिशील',
  'Odisha regionalism, Centrist': 'ओडिशा क्षेत्रवाद, मध्यमार्गी',
  'Tamil nationalism, Social justice': 'तमिल राष्ट्रवाद, सामाजिक न्याय',
  'Andhra regionalism, Welfare populism': 'आंध्र क्षेत्रवाद, कल्याणकारी लोकलुभावनवाद',
  'Andhra regionalism, Pro-business': 'आंध्र क्षेत्रवाद, व्यापार-समर्थक',
  'Marathi regionalism, Right-wing': 'मराठी क्षेत्रवाद, दक्षिणपंथी',
  'Social justice, Bihar regionalism': 'सामाजिक न्याय, बिहार क्षेत्रवाद',
  'Anti-corruption, Urban progressive': 'भ्रष्टाचार-विरोधी, शहरी प्रगतिशील',
  'Karnataka regionalism, Centrist': 'कर्नाटक क्षेत्रवाद, मध्यमार्गी',
  'Sikkim regionalism': 'सिक्किम क्षेत्रवाद',
  'Social democracy, Maharashtra': 'सामाजिक लोकतंत्र, महाराष्ट्र',
  'Telugu regionalism, Centre-right': 'तेलुगु क्षेत्रवाद, केंद्र-दक्षिण',
  'Socialism, UP regionalism': 'समाजवाद, UP क्षेत्रवाद',
  'Jharkhand tribal rights': 'झारखंड जनजातीय अधिकार',
  'Bihar regionalism, Centrist': 'बिहार क्षेत्रवाद, मध्यमार्गी',
};

const totalPartyBonds = PARTY_FUNDING.reduce((s, p) => s + p.amount, 0);

// Coalition roll-ups
const COALITION_TOTALS: Record<string, number> = {};
PARTY_FUNDING.forEach(p => {
  COALITION_TOTALS[p.coalition] = (COALITION_TOTALS[p.coalition] || 0) + p.amount;
});

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 flex gap-3 items-start', accent)}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// Horizontal mini-bar for donor→party breakdown
function DonorPartyBar({ party, shortName, amount, total }: {
  party: string; shortName: string; amount: number; total: number;
}) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const pct = Math.max((amount / total) * 100, 0.5);
  const color = PARTY_COLOR[shortName] ?? PARTY_COLOR['Other'];
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-20 text-xs text-right text-muted-foreground font-mono flex-shrink-0">{fmtFull(amount, isHi)}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-14 text-xs text-muted-foreground flex-shrink-0 truncate" title={party}>{shortName}</span>
    </div>
  );
}

// Expandable donor card
function DonorRow({ donor, rank }: { donor: Donor; rank: number }) {
  const { t, i18n } = useTranslation();
  const isHiDonor = i18n.language === 'hi';
  const [open, setOpen] = useState(false);
  const topParty = donor.parties[0];
  const topPct   = Math.round((topParty.amount / donor.amount) * 100);

  return (
    <div className={cn(
      'border border-border rounded-xl overflow-hidden transition-all',
      open ? 'bg-card' : 'bg-card/60 hover:bg-card',
    )}>
      {/* header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        {/* rank badge */}
        <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
          {rank}
        </span>

        {/* name + sector */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">{donor.name}</div>
          <div className="text-xs text-muted-foreground">{donor.sector}</div>
        </div>

        {/* amount */}
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-base text-foreground">{fmt(donor.amount, isHiDonor)}</div>
          <div className="text-xs text-muted-foreground">
            {t('topLabel')} <span className="font-medium" style={{ color: PARTY_COLOR[topParty.shortName] ?? '#888' }}>
              {topParty.shortName}
            </span>
            {' '}({topPct}%)
          </div>
        </div>

        {/* chevron */}
        <div className="flex-shrink-0 ml-1 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* expanded detail */}
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {/* note */}
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 leading-relaxed">
            {donor.note}
          </p>

          {/* government contracts */}
          {donor.contracts && donor.contracts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('keyGovtContracts')}
              </div>
              <div className="space-y-1.5">
                {donor.contracts.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="text-foreground font-medium leading-snug">{c.description}</div>
                      <div className="text-muted-foreground/70 mt-0.5">
                        {c.year} · {c.authority}
                        {c.value && <span> · <span className="text-amber-400/80 font-medium">{c.value}</span></span>}
                      </div>
                    </div>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 mt-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                        title={t('view')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* party breakdown bars */}
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {t('partyWiseDistribution')}
            </div>
            {donor.parties.map(p => (
              <DonorPartyBar
                key={p.shortName}
                party={p.party}
                shortName={p.shortName}
                amount={p.amount}
                total={donor.amount}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── custom recharts tooltip ─────────────────────────────────────────────────

function PartyTooltip({ active, payload }: any) {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = ((d.amount / totalPartyBonds) * 100).toFixed(1);
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-sm">
      <div className="font-semibold text-foreground">{d.party}</div>
      <div className="text-muted-foreground text-xs mb-1">{isHi ? (IDEOLOGY_HI[d.ideology] ?? d.ideology) : d.ideology}</div>
      <div className="font-bold" style={{ color: d.color }}>{fmtFull(d.amount, isHi)}</div>
      <div className="text-xs text-muted-foreground">{pct}% {t('disclosedTotal')}</div>
      <div className="text-xs mt-1 px-1.5 py-0.5 rounded inline-block" style={{ background: d.color + '22', color: d.color }}>
        {isHi ? (COALITION_HI[d.coalition] ?? d.coalition) : d.coalition}
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function Funding() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [tab, setTab] = useState<'parties' | 'donors' | 'history'>('parties');
  const [historyParties, setHistoryParties] = useState<string[]>(['BJP', 'INC', 'TMC', 'BSP', 'SP', 'AAP']);
  const [coalitionFilter, setCoalitionFilter] = useState<string>('All');

  const filteredParties = coalitionFilter === 'All'
    ? PARTY_FUNDING
    : PARTY_FUNDING.filter(p => p.coalition === coalitionFilter);

  const bjpShare = Math.round((5594 / totalPartyBonds) * 100);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Electoral Bond Funding — Who Funds Which Political Party"
        description="Follow the money in Indian politics — electoral bond data showing which companies funded BJP, Congress, and other parties. Sourced from SBI and Election Commission disclosures."
        path="/funding"
        ogImage="/og/default.jpg"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── hero header ── */}
        <div>
          <div className="flex items-start gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <IndianRupee className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('pageSubtitle')}
              </p>
            </div>
          </div>

          {/* SC struck-down banner */}
          <div className="flex gap-3 items-start bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-400">{t('schemeStatus')}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('schemeExplanation')}
              </p>
            </div>
          </div>
        </div>

        {/* ── stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={IndianRupee}
            label={t('totalBondsSold')}
            value="₹16,518 cr"
            sub={t('bondsRedeemed')}
            accent=""
          />
          <StatCard
            icon={TrendingUp}
            label={t('bjpShare')}
            value={`${bjpShare}%`}
            sub={t('bjpTotal')}
            accent=""
          />
          <StatCard
            icon={Building2}
            label={t('topCorporateDonor')}
            value={t('topDonorName')}
            sub={t('topDonorDetail')}
            accent=""
          />
          <StatCard
            icon={IndianRupee}
            label={t('partiesReceivedBonds')}
            value="24 parties"
            sub={`${PARTY_FUNDING.length} ${t('partiesAnalysed')}`}
            accent=""
          />
        </div>

        {/* ── tabs ── */}
        <div className="flex gap-1 border-b border-border">
          {([
            ['parties', t('partyWiseTotals')],
            ['donors',  `${t('topLabel')} ${TOP_DONORS.length} ${t('topDonors')}`],
            ['history', t('annualIncome')],
          ] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                tab === tabKey
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══ PARTIES TAB ══ */}
        {tab === 'parties' && (
          <div className="space-y-6">

            {/* coalition filter pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'All', label: t('allFilter') },
                { key: 'NDA', label: t('ndaFilter') },
                { key: 'INDIA', label: t('indiaFilter') },
                { key: 'State', label: t('stateFilter') },
                { key: 'Other', label: t('otherFilter') },
              ].map(({ key: c, label }) => (
                <button
                  key={c}
                  onClick={() => setCoalitionFilter(c)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                    coalitionFilter === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                  )}
                >
                  {label}
                  {c !== 'All' && COALITION_TOTALS[c] && (
                    <span className="ml-1 opacity-70">· {fmt(COALITION_TOTALS[c], isHi)}</span>
                  )}
                </button>
              ))}
            </div>

            {/* bar chart */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-4">
                {t('chartCaption')}
              </div>
              <ResponsiveContainer width="100%" height={Math.max(300, filteredParties.length * 38)}>
                <BarChart
                  data={filteredParties}
                  layout="vertical"
                  margin={{ top: 0, right: 80, left: 60, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={v => v >= 1000 ? `${v / 1000}K` : String(v)}
                  />
                  <YAxis
                    dataKey="shortName"
                    type="category"
                    width={55}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip content={<PartyTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {filteredParties.map((p) => (
                      <Cell key={p.shortName} fill={p.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* party table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('rowNumber')}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('partyColumn')}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('coalitionColumn')}</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('bondsColumn')}</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('shareColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParties.map((p, i) => {
                    const share = ((p.amount / totalPartyBonds) * 100).toFixed(1);
                    return (
                      <tr key={p.shortName} className={cn('border-b border-border/50 last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            <div>
                              <div className="font-medium text-foreground">{p.party}</div>
                              <div className="text-xs text-muted-foreground hidden sm:block">{isHi ? (IDEOLOGY_HI[p.ideology] ?? p.ideology) : p.ideology}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {isHi ? (COALITION_HI[p.coalition] ?? p.coalition) : p.coalition}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                          {p.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(share), 100)}%`, background: p.color }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t('totalShown')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold font-mono text-foreground">
                      {filteredParties.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {((filteredParties.reduce((s, p) => s + p.amount, 0) / totalPartyBonds) * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* NDA vs INDIA insight callout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: t('ndaReceived'), amount: COALITION_TOTALS['NDA'] ?? 0, color: '#FF6600' },
                { label: t('indiaReceived'), amount: COALITION_TOTALS['INDIA'] ?? 0, color: '#138808' },
                { label: t('regionalOther'), amount: (COALITION_TOTALS['State'] ?? 0) + (COALITION_TOTALS['Other'] ?? 0), color: '#78909C' },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-border bg-card/60 p-3 text-center">
                  <div className="text-lg font-bold" style={{ color: item.color }}>{fmt(item.amount, isHi)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                  <div className="text-xs text-muted-foreground/60">
                    {((item.amount / totalPartyBonds) * 100).toFixed(1)}% {t('ofTotal')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ DONORS TAB ══ */}
        {tab === 'donors' && (
          <div className="space-y-6">

            <p className="text-sm text-muted-foreground">
              {t('donorIntro')}{' '}
              {t('donorCombined')}{' '}
              <strong className="text-foreground">
                ₹{TOP_DONORS.reduce((s, d) => s + d.amount, 0).toLocaleString('en-IN')} {isHi ? 'करोड़' : 'crore'}
              </strong>{' '}
              — {t('approximately')} {Math.round((TOP_DONORS.reduce((s, d) => s + d.amount, 0) / BONDS_META.totalSold) * 100)}% {t('allBondsSold')}
              {' '}{t('fullDisclosure')}{' '}
              <a href="https://myneta.info/electoral_bonds/" target="_blank" rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground">
                {t('searchCompleteList')}
              </a>
            </p>

            <div className="space-y-2">
              {TOP_DONORS.map(donor => (
                <DonorRow key={donor.rank} donor={donor} rank={donor.rank} />
              ))}
            </div>

            {/* key insights */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
              <div className="text-sm font-semibold text-amber-400 mb-3">{t('keyPatterns')}</div>
              {[
                { icon: '🎰', text: t('futureGamingInsight') },
                { icon: '🏗️', text: t('meghaEngineeringInsight') },
                { icon: '⛏️', text: t('miningInsight') },
                { icon: '📡', text: t('airtelInsight') },
                { icon: '🏥', text: t('yashodaInsight') },
              ].map((item, i) => (
                <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab === 'history' && (() => {
          const LINES = [
            { key: 'BJP', color: '#FF6600', label: 'BJP' },
            { key: 'INC', color: '#138808', label: 'INC' },
            { key: 'TMC', color: '#17A2B8', label: 'TMC' },
            { key: 'BSP', color: '#6D28D9', label: 'BSP' },
            { key: 'SP',  color: '#E53935', label: 'SP'  },
            { key: 'AAP', color: '#0EA5E9', label: 'AAP' },
          ] as const;

          function HistoryTooltip({ active, payload, label: yr }: any) {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-sm space-y-1">
                <div className="font-semibold text-foreground mb-1">{yr}</div>
                {payload.map((p: any) => (
                  p.value != null && (
                    <div key={p.dataKey} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-muted-foreground w-8">{p.dataKey}</span>
                      <span className="font-semibold" style={{ color: p.color }}>
                        ₹{p.value.toLocaleString('en-IN')} cr
                      </span>
                    </div>
                  )
                ))}
              </div>
            );
          }

          const toggleParty = (key: string) =>
            setHistoryParties(prev =>
              prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
            );

          return (
            <div className="space-y-6">
              {/* explainer */}
              <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
                <p>
                  {t('incomeExplainer')}
                </p>
                <p className="text-muted-foreground/70 text-xs">
                  {t('pre2018Caveat')}
                  {' '}
                  {t('post2018Caveat')}{' '}
                  {t('sourceLabel')}{' '}
                  <a href="https://adrindia.org/research-and-reports/party-wise-reports" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{t('adrPartyReports')}</a>
                  {' · '}
                  <a href="https://www.eci.gov.in/annual-audit-reports" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{t('eciAuditReports')}</a>.
                </p>
              </div>

              {/* party toggle pills */}
              <div className="flex gap-2 flex-wrap">
                {LINES.map(({ key, color, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleParty(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      historyParties.includes(key)
                        ? 'text-white border-transparent'
                        : 'bg-transparent text-muted-foreground border-border opacity-40',
                    )}
                    style={historyParties.includes(key) ? { background: color, borderColor: color } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* line chart */}
              <div className="rounded-xl border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={PARTY_INCOME_HISTORY}
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={y => `'${y.slice(2, 4)}`}
                      interval={1}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={v => v >= 1000 ? `${v / 1000}K` : String(v)}
                      width={38}
                    />
                    <Tooltip content={<HistoryTooltip />} />
                    {/* event reference lines */}
                    {PARTY_INCOME_HISTORY.map((d, i) =>
                      d.election ? (
                        <ReferenceLine key={`el-${i}`} x={d.year} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" strokeOpacity={0.4} label={{ value: t('electionMarker'), position: 'top', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      ) : d.bondsStart ? (
                        <ReferenceLine key={`b-${i}`} x={d.year} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: t('bondsMarker'), position: 'top', fontSize: 9, fill: '#f59e0b' }} />
                      ) : null
                    )}
                    {LINES.map(({ key, color }) => (
                      historyParties.includes(key) && (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: color, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          connectNulls={false}
                        />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="text-xs text-muted-foreground mt-2 text-right">
                  {t('chartUnit')}{' '}
                  <a href="https://adrindia.org/research-and-reports/party-wise-reports" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{t('adrShort')}</a>
                  {' / '}
                  <a href="https://www.eci.gov.in/annual-audit-reports" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{t('eciFilings')}</a>
                  {' '}{t('historyRange')}
                </div>
              </div>

              {/* ── closing balance panel ── */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t('assetsTitle')}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t('assetsDescription')}{' '}
                      <a href="https://www.eci.gov.in/annual-audit-reports" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{t('eciAuditReports')}</a>
                      {' · '}
                      <a href="https://adrindia.org/research-and-reports/party-wise-reports" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{t('adrPartyReports')}</a>
                      {' '}{t('figuresApproximate')}
                    </div>
                  </div>
                </div>
                {(() => {
                  const maxBal = Math.max(...PARTY_CLOSING_BALANCE.map(p => p.balance));
                  return (
                    <div className="space-y-2.5 pt-1">
                      {PARTY_CLOSING_BALANCE.map(p => (
                        <div key={p.shortName} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold" style={{ color: p.color }}>{p.shortName}</span>
                            <span className="font-mono font-bold text-foreground">₹{p.balance.toLocaleString('en-IN')} cr</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-2.5 rounded-full transition-all"
                              style={{ width: `${(p.balance / maxBal) * 100}%`, backgroundColor: p.color }}
                            />
                          </div>
                          <div className="text-[11px] text-muted-foreground/70 leading-tight">{p.note}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* year-by-year table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('yearColumn')}</th>
                      {LINES.map(({ key, color }) => (
                        <th key={key} className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                          {key} (₹ cr)
                        </th>
                      ))}
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('noteColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARTY_INCOME_HISTORY.map((row, i) => (
                      <tr key={row.year} className={cn('border-b border-border/50 last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                        <td className="px-4 py-2 font-mono text-xs text-foreground">
                          {row.year}
                          {row.election && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">GE</span>}
                          {row.bondsStart && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">{t('bondsMarker')}</span>}
                        </td>
                        {LINES.map(({ key, color }) => {
                          const val = (row as any)[key] as number | null;
                          return (
                            <td key={key} className="px-4 py-2 text-right font-mono font-semibold" style={{ color: val != null ? color : undefined }}>
                              {val != null ? val.toLocaleString('en-IN') : <span className="text-muted-foreground/30">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground hidden sm:table-cell">
                          {row.election ? t('generalElectionYear') : row.bondsStart ? t('electoralBondsBegin') : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* key inflection callout */}
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                <div className="text-sm font-semibold text-foreground mb-3">{t('trendTitle')}</div>
                {[
                  { icon: '📈', text: t('incomeTrendOne') },
                  { icon: '💥', text: t('incomeTrendTwo') },
                  { icon: '📉', text: t('incomeTrendThree') },
                  { icon: '🔍', text: t('incomeTrendFour') },
                ].map((item, i) => (
                  <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── source footer ── */}
        <div className="border-t border-border pt-6 space-y-1.5 text-xs text-muted-foreground">
          <div className="font-semibold text-muted-foreground/80">{t('dataSources')}</div>
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <a href="https://adrindia.org/research-and-reports/party-wise-reports" target="_blank" rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2">
              {t('adrSource')}
            </a>
            {' '}{t('adrSourceDescription')}
          </div>
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <a href="https://www.eci.gov.in/annual-audit-reports" target="_blank" rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2">
              {t('eciSource')}
            </a>
            {' '}{t('eciSourceDescription')}
          </div>
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <a href="https://myneta.info/electoral_bonds/" target="_blank" rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2">
              {t('bondDatabaseSource')}
            </a>
            {' '}{t('bondDatabaseDescription')}
          </div>
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <a href="https://www.eci.gov.in/disclosure-of-electoral-bonds" target="_blank" rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2">
              {t('officialDisclosureSource')}
            </a>
            {' '}{t('officialDisclosureDescription')}
          </div>
          <p className="text-muted-foreground/60 pt-1">
            {t('footerNote')}
          </p>
        </div>

      </div>
    </div>
  );
}

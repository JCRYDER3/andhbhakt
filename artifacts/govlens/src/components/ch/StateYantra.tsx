import type { YantraPattern } from '@/lib/ch/stateIdentity';

/** Vedic-geometric linework. Copied from CropHealth StateYantra — do not invent patterns. */
export function StateYantra({ pattern }: { pattern: YantraPattern }) {
  const stroke = 'rgb(var(--ch-state-rgb))';

  return (
    <div className="ch-state-card__yantra" data-pattern={pattern} aria-hidden="true">
      <svg className="ch-state-card__yantra-orbit" viewBox="0 0 200 200" fill="none" stroke={stroke}>
        <circle cx="100" cy="100" r="96" strokeWidth="1.4" strokeOpacity="0.55" />
        <circle className="ch-state-card__yantra-crawl" cx="100" cy="100" r="78" strokeWidth="1.6" />
        <circle cx="100" cy="100" r="58" strokeWidth="1.2" strokeDasharray="2 8" strokeOpacity="0.7" />
        {[0, 45, 90, 135].map((deg) => (
          <line
            key={deg}
            x1="100"
            y1="8"
            x2="100"
            y2="28"
            strokeWidth="1.6"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </svg>

      <svg className="ch-state-card__yantra-motif" viewBox="0 0 200 200" fill="none" stroke={stroke} strokeWidth="1.7">
        {pattern === 'sri' && (
          <>
            <circle cx="100" cy="100" r="16" />
            <path d="M100 22 L156 168 L44 168 Z" />
            <path d="M100 178 L44 32 L156 32 Z" />
            <path d="M22 100 L178 148 L178 52 Z" strokeOpacity="0.65" />
            <circle cx="100" cy="100" r="5" fill={stroke} fillOpacity="0.55" />
          </>
        )}
        {pattern === 'lotus' && (
          <>
            <circle cx="100" cy="100" r="14" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <g key={deg} transform={`rotate(${deg} 100 100)`}>
                <path d="M100 100 C 122 74, 122 42, 100 20 C 78 42, 78 74, 100 100" />
              </g>
            ))}
          </>
        )}
        {pattern === 'star' && (
          <>
            <circle cx="100" cy="100" r="16" />
            <path d="M100 14 L120 72 L182 72 L132 110 L152 172 L100 134 L48 172 L68 110 L18 72 L80 72 Z" />
          </>
        )}
        {pattern === 'grid' && (
          <>
            <rect x="36" y="36" width="128" height="128" />
            <rect x="58" y="58" width="84" height="84" />
            <rect x="80" y="80" width="40" height="40" />
            <g transform="rotate(45 100 100)">
              <rect x="48" y="48" width="104" height="104" strokeOpacity="0.75" />
            </g>
            <line x1="100" y1="16" x2="100" y2="184" strokeOpacity="0.7" />
            <line x1="16" y1="100" x2="184" y2="100" strokeOpacity="0.7" />
          </>
        )}
        {pattern === 'hex' && (
          <>
            <polygon points="100,18 172,59 172,141 100,182 28,141 28,59" />
            <polygon points="100,42 154,73 154,127 100,158 46,127 46,73" strokeOpacity="0.85" />
            <path d="M100 42 L154 127 L46 127 Z" />
            <path d="M100 158 L154 73 L46 73 Z" />
            <circle cx="100" cy="100" r="10" />
          </>
        )}
      </svg>
    </div>
  );
}

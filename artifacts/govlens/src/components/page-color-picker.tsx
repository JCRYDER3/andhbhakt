import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Check, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_ACCENTS,
  applyPageAccent,
  getPageAccent,
  setPageAccent,
} from '@/lib/page-accent';

export function PageAccentSync() {
  const [location] = useLocation();
  useEffect(() => {
    applyPageAccent(getPageAccent(location));
  }, [location]);
  return null;
}

export function PageColorPicker() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(() => getPageAccent(location));
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHex(getPageAccent(location));
  }, [location]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(next: string) {
    setHex(next);
    setPageAccent(location, next);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid="page-color-settings"
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-current/20 px-2 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('pageColorLabel')}
        aria-expanded={open}
        aria-controls={panelId}
        title={t('pageColorLabel')}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('pageColorLabel')}
          className="absolute right-0 z-[80] mt-2 w-72 rounded-xl border border-white/10 bg-[#161618] p-4 text-[#f5f5f4] shadow-xl"
        >
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#a8a29e]">
            {t('pageColorLabel')}
          </p>
          <div className="grid grid-cols-4 gap-3" role="listbox" aria-label={t('pageColorLabel')}>
            {PAGE_ACCENTS.map((swatch) => {
              const selected = hex.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={swatch.label}
                  onClick={() => pick(swatch.hex)}
                  className="relative aspect-square min-h-11 w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{
                    backgroundColor: swatch.hex,
                    boxShadow: selected
                      ? '0 0 0 2px #161618, 0 0 0 4px #f5f5f4'
                      : undefined,
                  }}
                >
                  {selected && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white" strokeWidth={4} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          <label className="mt-4 flex min-h-11 items-center justify-between gap-3 text-xs text-[#d6d3d1]">
            <span>{t('pageColorCustom')}</span>
            <input
              type="color"
              value={hex.length === 7 ? hex : '#c2410c'}
              onChange={(e) => pick(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded border border-white/15 bg-transparent"
              aria-label={t('pageColorCustom')}
            />
          </label>
        </div>
      )}
    </div>
  );
}

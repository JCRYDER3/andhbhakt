import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  Search,
  BarChart3,
  Menu,
  X,
  FileText,
  BookOpen,
  Flag,
  IndianRupee,
  Globe,
  Github,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type NavLink = {
  href: string;
  label: string;
  icon: typeof Flag;
  badge?: string;
};

export function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { t } = useTranslation();

  const links: NavLink[] = [
    { href: '/', label: t('navCentralData'), icon: Flag },
    { href: '/state-facts', label: t('navStateData'), icon: BookOpen },
    { href: '/schemes', label: t('navCentralSchemes'), icon: Search },
    { href: '/reports', label: t('navCagReports'), icon: FileText },
    { href: '/funding', label: t('navPartyFunding'), icon: IndianRupee, badge: t('navBeta') },
    { href: '/development-index', label: t('navDevelopmentIndex'), icon: BarChart3 },
  ];

  useEffect(() => {
    function handlePointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handlePointer);
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  function isActive(href: string) {
    if (href === '/') return location === '/' || location === '/central-data';
    return location === href || location.startsWith(`${href}/`);
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('skipToContent')}
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="relative xl:hidden" ref={menuRef}>
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={open ? t('navCloseMenu') : t('navOpenMenu')}
              aria-expanded={open}
              aria-controls={panelId}
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>

            {open && (
              <div
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-label={t('navMainLabel')}
                className="absolute left-0 top-full z-50 mt-2 w-[min(18.5rem,calc(100vw-2rem))] rounded-lg border border-border bg-card py-2 shadow-lg"
              >
                <nav aria-label={t('navMainLabel')}>
                  <ul className="flex flex-col">
                    {links.map((link) => (
                      <li key={link.href}>
                        <NavItem link={link} active={isActive(link.href)} />
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="mt-1 border-t border-border px-4 py-3 sm:hidden">
                  <LanguageSelect id="lang-select-mobile" />
                </div>
              </div>
            )}
          </div>

          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-md py-1 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              decoding="async"
              fetchPriority="high"
              className="h-9 w-9 flex-shrink-0 rounded object-cover"
            />
            <span className="min-w-0">
              <span className="block font-bold leading-tight text-foreground">
                Andhbhakt.org
              </span>
              <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                {t('navSubtitle')}
              </span>
            </span>
          </Link>

          <nav className="ml-2 hidden min-w-0 flex-1 xl:block" aria-label={t('navMainLabel')}>
            <ul className="flex flex-wrap items-center gap-0.5">
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {link.label}
                      {link.badge && (
                        <span className="rounded-full border border-amber-700/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-amber-800 dark:text-amber-300">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <a
              href="https://github.com/JCRYDER3/andhbhakt"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="hidden h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
            </a>

            <div className="hidden sm:block">
              <LanguageSelect id="lang-select" />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

function LanguageSelect({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Globe className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        {t('langSelectLabel')}
      </label>
      <select
        id={id}
        value={i18n.language.startsWith('hi') ? 'hi' : 'en'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="cursor-pointer appearance-none border-none bg-transparent pr-1 text-sm font-medium text-foreground focus-visible:outline-none"
        aria-label={t('langSelectLabel')}
      >
        <option value="en">{t('langEnglish')}</option>
        <option value="hi">{t('langHindi')}</option>
      </select>
    </div>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">{link.label}</span>
      {link.badge && (
        <span className="rounded-full border border-amber-700/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-amber-800 dark:text-amber-300">
          {link.badge}
        </span>
      )}
    </Link>
  );
}

/** @deprecated Use Header. Kept so existing page imports keep compiling during the lift. */
export const Navbar = Header;

import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Search, BarChart3, Menu, X, FileText, BookOpen, Flag, IndianRupee, Globe, Github, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export function Navbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();

  const links = [
    { href: '/', label: t('navCentralData'), icon: Flag },
    { href: '/state-facts', label: t('navStateData'), icon: BookOpen },
    { href: '/schemes', label: t('navCentralSchemes'), icon: Search },
    { href: '/reports', label: t('navCagReports'), icon: FileText },
    { href: '/funding', label: t('navPartyFunding'), icon: IndianRupee, badge: t('navBeta') },
    { href: '/politicians', label: t('navPoliticians'), icon: Users },
    { href: '/development-index', label: t('navDevelopmentIndex'), icon: BarChart3 },
  ];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [location]);

  const currentLang = i18n.language === 'hi' ? 'हिंदी' : 'English';

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-3">

          {/* Hamburger + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t('navOpenMenu')}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {open && (
              <div className="absolute left-0 top-full mt-2 w-52 rounded-lg border border-border bg-card shadow-lg py-1 z-50">
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive = location === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                      data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {link.label}
                      {'badge' in link && link.badge && (
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 leading-none">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="Andhbhakt.org" className="w-9 h-9 rounded object-cover" />
            <div>
              <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                Andhbhakt.org
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {t('navSubtitle')}
              </div>
            </div>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* GitHub */}
          <a
            href="https://github.com/JCRYDER3/andhbhakt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>

          {/* Language dropdown */}
          <div className="relative">
            <label htmlFor="lang-select" className="sr-only">{t('langSelectLabel')}</label>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Globe className="w-4 h-4 flex-shrink-0" />
              <select
                id="lang-select"
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground appearance-none pr-1"
                aria-label={t('langSelectLabel')}
              >
                <option value="en">{t('langEnglish')}</option>
                <option value="hi">{t('langHindi')}</option>
              </select>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}

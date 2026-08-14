'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'relative flex items-center w-11 h-6 rounded-full border transition-colors shrink-0',
        isDark ? 'bg-foreground/10 border-foreground/25' : 'bg-muted border-border',
      )}
    >
      <Sun
        className={cn(
          'w-3.5 h-3.5 absolute left-1.5 transition-colors',
          isDark ? 'text-muted-foreground/40' : 'text-foreground',
        )}
      />
      <Moon
        className={cn(
          'w-3.5 h-3.5 absolute right-1.5 transition-colors',
          isDark ? 'text-foreground' : 'text-muted-foreground/40',
        )}
      />
      <span
        className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-card border border-border shadow-sm flex items-center justify-center transition-all',
          isDark ? 'right-0.5' : 'left-0.5',
        )}
      />
    </button>
  );
}

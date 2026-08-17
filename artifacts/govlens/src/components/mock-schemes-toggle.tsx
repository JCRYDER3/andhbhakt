import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isMockSchemesQueryEnabled, setMockSchemesQuery } from '@/data/mock/schemes';

type MockSchemesContextValue = {
  mockEnabled: boolean;
  enableMock: () => void;
  disableMock: () => void;
  toggleMock: () => void;
};

const MockSchemesContext = createContext<MockSchemesContextValue | null>(null);

export function MockSchemesProvider({ children }: { children: ReactNode }) {
  const [mockEnabled, setMockEnabled] = useState(isMockSchemesQueryEnabled);

  const enableMock = useCallback(() => {
    setMockSchemesQuery(true);
    setMockEnabled(true);
  }, []);

  const disableMock = useCallback(() => {
    setMockSchemesQuery(false);
    setMockEnabled(false);
  }, []);

  const toggleMock = useCallback(() => {
    setMockEnabled((prev) => {
      const next = !prev;
      setMockSchemesQuery(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mockEnabled, enableMock, disableMock, toggleMock }),
    [mockEnabled, enableMock, disableMock, toggleMock],
  );

  return <MockSchemesContext.Provider value={value}>{children}</MockSchemesContext.Provider>;
}

export function useMockSchemes() {
  const ctx = useContext(MockSchemesContext);
  if (!ctx) {
    throw new Error('useMockSchemes must be used inside MockSchemesProvider');
  }
  return ctx;
}

export function MockSchemesSwitch({
  compact = false,
  testId = 'toggle-mock-schemes',
}: {
  compact?: boolean;
  testId?: string;
}) {
  const { t } = useTranslation();
  const { mockEnabled, toggleMock } = useMockSchemes();
  const show = import.meta.env.DEV || mockEnabled || import.meta.env.VITE_MOCK_SCHEMES === '1';
  if (!show) return null;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mockEnabled}
      data-testid={testId}
      onClick={toggleMock}
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={t('schemesMockToggle')}
    >
      <span
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${mockEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${mockEnabled ? 'translate-x-4' : ''}`}
        />
      </span>
      {!compact && <span className="hidden xl:inline">{t('schemesMockToggle')}</span>}
      {compact && <span>{t('schemesMockToggle')}</span>}
    </button>
  );
}

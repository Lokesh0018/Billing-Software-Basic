import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { settingsApi } from '../api';
import type { ShopSettings } from '../types';

interface SettingsState {
  settings: ShopSettings | null;
  refresh: () => Promise<void>;
  setSettings: (s: ShopSettings) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

/** Shop settings (name, tax config, ...) loaded once after login and shared app-wide. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSettings(await settingsApi.get());
    } catch {
      /* pages that need settings show their own errors */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SettingsContext.Provider value={{ settings, refresh, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useShopSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useShopSettings must be used inside SettingsProvider');
  return ctx;
}

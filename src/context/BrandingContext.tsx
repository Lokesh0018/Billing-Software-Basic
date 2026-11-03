import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';

export interface Branding {
  appName: string;
  appTagline: string;
  shopName: string;
}

const DEFAULT: Branding = { appName: 'TiffinFlow', appTagline: 'Billing', shopName: '' };
const CACHE_KEY = 'tiffinflow.branding';

function cached(): Branding {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

interface BrandingState {
  branding: Branding;
  setBranding: (b: Branding) => void;
}

const BrandingContext = createContext<BrandingState | null>(null);

/** Editable app name (Settings → App name). Public, so the login page can show it too. */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setState] = useState<Branding>(cached);

  const setBranding = useCallback((b: Branding) => {
    setState(b);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(b));
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    api
      .get<Branding>('/branding')
      .then((r) => setBranding(r.data))
      .catch(() => undefined); // keep cached/default name if offline
  }, [setBranding]);

  useEffect(() => {
    document.title = [branding.appName, branding.appTagline].filter(Boolean).join(' ');
  }, [branding]);

  return <BrandingContext.Provider value={{ branding, setBranding }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used inside BrandingProvider');
  return ctx;
}

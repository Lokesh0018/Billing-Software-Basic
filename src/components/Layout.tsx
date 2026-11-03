import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptIndianRupee,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useShopSettings } from '../context/SettingsContext';
import { ConfirmDialog, cx, Kbd } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/billing', label: 'New bill', icon: ReceiptIndianRupee },
  { to: '/bills', label: 'Bill history', icon: History },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/reports', label: 'Sales reports', icon: BarChart3 },
];

const EXPAND_KEY = 'tiffinflow.railExpanded';

/** TiffinFlow's mark: a steamed idly on its plate, in lime. */
export function TiffinMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="16" fill={onDark ? '#ffffff' : '#141513'} />
      <ellipse cx="16" cy="18.5" rx="10" ry="5.2" fill={onDark ? '#141513' : '#e5f381'} />
      <ellipse cx="16" cy="16.2" rx="6.6" ry="3.3" fill={onDark ? '#e5f381' : '#ffffff'} />
    </svg>
  );
}

function initials(name?: string) {
  return (name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useShopSettings();
  const { branding } = useBranding();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(EXPAND_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPAND_KEY, expanded ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [expanded]);

  // Ctrl/⌘+K jumps to bill search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const shopName = settings?.shopName || branding.shopName || branding.appName;
  const onBilling = location.pathname === '/billing';

  const searchBills = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/bills?q=${encodeURIComponent(q)}` : '/bills');
    setQuery('');
    searchRef.current?.blur();
  };

  /** The black rail. `wide` shows labels (expanded on desktop, and the phone drawer). */
  const rail = (wide: boolean, onClose?: () => void) => {
    const item = (active: boolean) =>
      cx(
        'group relative flex h-12 items-center gap-3 rounded-[18px] text-sm font-medium transition-colors duration-150',
        wide ? 'px-3.5' : 'w-12 justify-center',
        active ? 'bg-white/14 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white',
      );
    const tip = (label: string) =>
      !wide && (
        <span className="pointer-events-none absolute left-full z-50 ml-4 rounded-full bg-brand-900 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {label}
        </span>
      );
    return (
      <div className={cx('flex h-full flex-col bg-brand-900 py-4 text-white', wide ? 'px-3' : 'items-center px-0')}>
        <div className={cx('mb-6 flex items-center gap-3', wide ? 'px-1.5' : 'justify-center')}>
          <TiffinMark className="size-11 shrink-0" onDark />
          {wide && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-semibold">{branding.appName}</p>
              <p className="truncate text-xs text-white/55">{shopName}</p>
            </div>
          )}
          {onClose && (
            <button className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close menu">
              <X className="size-5" />
            </button>
          )}
        </div>

        <nav className={cx('flex flex-1 flex-col gap-1.5', wide && 'w-full')} aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} aria-label={wide ? undefined : label} className={({ isActive }) => item(isActive)}>
              <Icon className="size-[19px] shrink-0" strokeWidth={1.7} />
              {wide && label}
              {tip(label)}
            </NavLink>
          ))}
        </nav>

        <div className={cx('flex flex-col gap-1.5', wide && 'w-full')}>
          <NavLink to="/settings" aria-label={wide ? undefined : 'Settings'} className={({ isActive }) => item(isActive)}>
            <Settings className="size-[19px] shrink-0" strokeWidth={1.7} />
            {wide && 'Settings'}
            {tip('Settings')}
          </NavLink>
          {!onClose && (
            <button onClick={() => setExpanded((x) => !x)} aria-label={wide ? 'Collapse menu' : 'Expand menu'} className={cx(item(false), 'hidden lg:flex')}>
              {wide ? <PanelLeftClose className="size-[19px]" strokeWidth={1.7} /> : <PanelLeftOpen className="size-[19px]" strokeWidth={1.7} />}
              {wide && 'Collapse'}
              {tip('Expand menu')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const accountMenu = (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex h-12 items-center gap-2.5 rounded-full bg-white pr-3 pl-1.5 text-left transition-colors hover:bg-brand-50"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">{initials(user?.name)}</span>
        <span className="hidden min-w-0 leading-tight xl:block">
          <span className="block max-w-40 truncate text-sm font-medium text-brand-900">{user?.name}</span>
          <span className="block max-w-40 truncate text-xs text-slate-600">{user?.email}</span>
        </span>
        <ChevronDown className="size-4 text-slate-500" />
      </button>
      {menuOpen && (
        <div role="menu" className="pop-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[22px] bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-brand-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-600">{user?.email}</p>
          </div>
          <Link role="menuitem" to="/settings" className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-sm text-brand-900 hover:bg-brand-50">
            <Settings className="size-4 text-slate-500" /> Shop settings
          </Link>
          <button role="menuitem" onClick={() => setConfirmLogout(true)} className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50">
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh bg-frame">
      {/* Desktop: the floating black rail */}
      <aside
        className={cx(
          'fixed top-3 bottom-3 left-3 z-30 hidden overflow-visible rounded-[28px] transition-[width] duration-200 ease-out lg:block [&>div]:rounded-[28px]',
          expanded ? 'w-[236px]' : 'w-[76px]',
        )}
      >
        {rail(expanded)}
      </aside>

      {/* Phones and tablets: the rail slides in as a drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-brand-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="slide-in absolute inset-y-2 left-2 w-72 max-w-[85%] overflow-hidden rounded-[28px] shadow-2xl">{rail(true, () => setMobileOpen(false))}</aside>
        </div>
      )}

      <div className={cx('transition-[padding] duration-200 ease-out', expanded ? 'lg:pl-[260px]' : 'lg:pl-[100px]')}>
        {/* Header on the ground */}
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 bg-frame/95 px-4 sm:px-6 lg:pr-6 lg:pl-0">
          <button onClick={() => setMobileOpen(true)} className="flex size-11 items-center justify-center rounded-full bg-white text-brand-900 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <p className="truncate text-[15px] font-semibold text-brand-900">{shopName}</p>
          </div>

          <form onSubmit={searchBills} className="relative hidden w-full max-w-[440px] lg:block" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-slate-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a bill by number, customer or phone"
              className="h-12 w-full rounded-full border border-transparent bg-white pr-16 pl-11 text-sm text-brand-900 transition-colors placeholder:text-slate-500 focus:border-focus focus:ring-3 focus:ring-focus/15 focus:outline-none"
              aria-label="Search bills"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-slate-500">
              <Kbd>Ctrl K</Kbd>
            </span>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/settings" className="hidden size-12 items-center justify-center rounded-full bg-white text-brand-900 transition-colors hover:bg-brand-50 sm:flex" aria-label="Settings" title="Settings">
              <Settings className="size-[19px]" strokeWidth={1.7} />
            </Link>
            {!onBilling && (
              <Link
                to="/billing"
                className="flex h-12 items-center gap-2 rounded-full bg-brand-900 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-5"
                aria-label="New bill"
              >
                <Plus className="size-[18px]" /> <span className="hidden sm:inline">New bill</span>
              </Link>
            )}
            {accountMenu}
          </div>
        </header>

        <main className="min-h-[calc(100dvh-72px)]">
          <div className={onBilling ? 'px-4 pb-4 sm:px-6 lg:pr-6 lg:pl-0' : 'px-4 pt-3 pb-10 sm:px-6 lg:pr-6 lg:pl-0'}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      />
    </div>
  );
}

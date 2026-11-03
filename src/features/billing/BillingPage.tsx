import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  Banknote,
  ChevronUp,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { billsApi, categoriesApi, productsApi } from '../../api';
import { errorMessage } from '../../api/client';
import { Button, ConfirmDialog, EmptyState, ErrorState, Kbd, LoadingBlock, Segmented, cx } from '../../components/ui';
import { useShopSettings } from '../../context/SettingsContext';
import { formatAmount, formatINR, pct, splitTax } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import type { Bill, PaymentMethod, Product } from '../../types';
import { ReceiptModal } from '../receipt/ReceiptModal';
import { MAX_QTY, useCart } from './useCart';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
];

export function BillingPage() {
  const { settings, refresh: refreshSettings } = useShopSettings();
  const catalog = useAsync(
    async () => {
      const [products, categories] = await Promise.all([productsApi.list({ active: 'true' }), categoriesApi.list()]);
      const visibleCats = categories.filter((c) => c.isActive);
      const visibleIds = new Set(visibleCats.map((c) => c.id));
      return { products: products.filter((p) => visibleIds.has(p.categoryId)), categories: visibleCats };
    },
    [],
  );
  const cart = useCart(settings);
  const { syncWithProducts } = cart;

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<number | 'all'>('all');
  const [showCustomer, setShowCustomer] = useState(() => !!(cart.state.customerName || cart.state.customerPhone));
  const [cashReceived, setCashReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Bill | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep prices in the cart current with the database.
  useEffect(() => {
    if (catalog.data) syncWithProducts(catalog.data.products);
  }, [catalog.data, syncWithProducts]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog.data?.products ?? []).filter(
      (p) => (category === 'all' || p.categoryId === category) && (!q || p.name.toLowerCase().includes(q)),
    );
  }, [catalog.data, category, search]);

  const qtyInCart = useMemo(() => new Map(cart.state.lines.map((l) => [l.productId, l.quantity])), [cart.state.lines]);
  const { totals, state } = cart;

  // ---- validation of the right-hand panel
  const phoneError = state.customerPhone && !/^[6-9]\d{9}$/.test(state.customerPhone) ? 'Enter a valid 10-digit mobile number' : '';
  const discountError =
    state.discountType === 'PERCENT' && cart.discountNumber > 100
      ? 'Cannot exceed 100%'
      : state.discountType === 'FLAT' && cart.discountNumber > totals.subtotal
        ? 'Cannot exceed subtotal'
        : state.discountType !== 'NONE' && state.discountValue && !/^\d+(\.\d{1,2})?$/.test(state.discountValue)
          ? 'Max 2 decimals'
          : '';
  const canSubmit = state.lines.length > 0 && !phoneError && !discountError && !submitting;

  const cashNum = Number(cashReceived) || 0;
  const change = cashNum - totals.grandTotal;

  const addProduct = (p: Product) => {
    if ((qtyInCart.get(p.id) ?? 0) >= MAX_QTY) return;
    cart.add(p);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const bill = await billsApi.create({
        items: state.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        discountType: state.discountType,
        discountValue: state.discountType === 'NONE' ? 0 : cart.discountNumber,
        paymentMethod: state.paymentMethod,
        customerName: state.customerName.trim() || null,
        customerPhone: state.customerPhone.trim() || null,
        expectedTotal: totals.grandTotal,
      });
      setReceipt(bill);
      cart.clear();
      setCashReceived('');
      setShowCustomer(false);
      setMobileCartOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save bill'), { duration: 6000 });
      // Prices, availability or tax changed: refresh so the cashier sees the real total.
      if (axios.isAxiosError(err) && [400, 409].includes(err.response?.status ?? 0)) {
        catalog.reload();
        refreshSettings();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const newBill = () => {
    setReceipt(null);
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // ---- keyboard shortcuts: "/" focus search, F2 complete bill, Esc clear search
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (receipt) return;
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receipt]);

  if (catalog.loading && !catalog.data) return <LoadingBlock label="Loading menu…" />;
  if (catalog.error && !catalog.data) return <ErrorState message={catalog.error} onRetry={catalog.reload} />;

  const taxLines = () => {
    if (!settings?.taxEnabled || totals.taxAmount <= 0) return null;
    const prefix = settings.taxInclusive ? 'Incl. ' : '';
    const muted = settings.taxInclusive;
    if (settings.splitTax) {
      const [c, s] = splitTax(totals.taxAmount);
      const half = pct(settings.taxRate / 2);
      return (
        <>
          <SummaryRow label={`${prefix}CGST @ ${half}`} value={formatAmount(c)} muted={muted} />
          <SummaryRow label={`${prefix}SGST @ ${half}`} value={formatAmount(s)} muted={muted} />
        </>
      );
    }
    return <SummaryRow label={`${prefix}${settings.taxLabel} @ ${pct(settings.taxRate)}`} value={formatAmount(totals.taxAmount)} muted={muted} />;
  };

  const categories = catalog.data?.categories ?? [];
  const countByCategory = new Map<number, number>();
  for (const p of catalog.data?.products ?? []) countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);

  const cartPanel = (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-[-0.02em] text-brand-900">
          Current bill
          {totals.itemCount > 0 && <span className="tabular rounded-full bg-saffron-200 px-2.5 py-0.5 text-xs font-semibold text-brand-900">{totals.itemCount}</span>}
        </h2>
        <div className="flex items-center gap-1">
          {state.lines.length > 0 && (
            <button onClick={() => setConfirmClear(true)} className="rounded-lg px-2 py-1 text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700">
              Clear
            </button>
          )}
          <button className="rounded-lg p-1 text-slate-500 hover:bg-raised lg:hidden" onClick={() => setMobileCartOpen(false)} aria-label="Close cart">
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Lines */}
      <div className="scroll-thin mx-3 min-h-[120px] flex-1 overflow-y-auto rounded-[22px] bg-raised">
        {state.lines.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
            <ShoppingCart className="size-6 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-brand-900">No items yet</p>
            <p className="mt-0.5 text-sm text-slate-600">Tap a dish to add it to the bill.</p>
          </div>
        ) : (
          <ul>
            {state.lines.map((l) => (
              <li key={l.productId} className="rise-in flex items-center gap-3 border-b border-white px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-900">{l.name}</p>
                  <p className="tabular text-xs text-slate-500">{formatINR(l.unitPrice)} each</p>
                </div>
                <div className="flex h-9 items-center rounded-full bg-white">
                  <button className="flex size-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-900" onClick={() => cart.setQty(l.productId, l.quantity - 1)} aria-label={`Decrease ${l.name}`}>
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    className="tabular h-8 w-9 bg-transparent text-center text-sm font-semibold text-brand-900 focus:outline-none"
                    inputMode="numeric"
                    value={l.quantity}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(/\D/g, ''));
                      if (v > 0) cart.setQty(l.productId, v);
                    }}
                    onFocus={(e) => e.target.select()}
                    aria-label={`${l.name} quantity`}
                  />
                  <button
                    className="flex size-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-900 disabled:opacity-40"
                    disabled={l.quantity >= MAX_QTY}
                    onClick={() => cart.setQty(l.productId, l.quantity + 1)}
                    aria-label={`Increase ${l.name}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <p className="tabular w-[72px] text-right text-sm font-semibold text-brand-900">{formatAmount(l.unitPrice * l.quantity)}</p>
                <button className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700" onClick={() => cart.remove(l.productId)} aria-label={`Remove ${l.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Customer, discount, totals, payment, checkout */}
      <div className="space-y-4 px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {showCustomer ? (
          <div className="rise-in grid grid-cols-2 gap-2">
            <input className="input h-9" placeholder="Customer name" maxLength={100} value={state.customerName} onChange={(e) => cart.update('customerName', e.target.value)} />
            <div>
              <input
                className={cx('input h-9', phoneError && 'border-red-400')}
                placeholder="Mobile number"
                inputMode="tel"
                maxLength={10}
                value={state.customerPhone}
                onChange={(e) => cart.update('customerPhone', e.target.value.replace(/\D/g, ''))}
              />
              {phoneError && <p className="mt-1 text-[11px] text-red-700">{phoneError}</p>}
            </div>
          </div>
        ) : (
          <button className="flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:text-brand-900" onClick={() => setShowCustomer(true)}>
            <UserRound className="size-4" /> Add customer (optional)
          </button>
        )}

        <div className="flex items-start gap-2">
          <Segmented
            size="sm"
            ariaLabel="Discount"
            value={state.discountType}
            onChange={(t) => {
              cart.update('discountType', t);
              if (t === 'NONE') cart.update('discountValue', '');
            }}
            options={[
              { value: 'NONE', label: 'No discount' },
              { value: 'FLAT', label: '₹ off' },
              { value: 'PERCENT', label: '% off' },
            ]}
          />
          {state.discountType !== 'NONE' && (
            <div className="min-w-0 flex-1">
              <input
                className={cx('input tabular h-8', discountError && 'border-red-400')}
                inputMode="decimal"
                placeholder={state.discountType === 'FLAT' ? 'Amount ₹' : 'Percent %'}
                value={state.discountValue}
                onChange={(e) => cart.update('discountValue', e.target.value.replace(/[^\d.]/g, ''))}
                autoFocus
              />
              {discountError && <p className="mt-1 text-[11px] text-red-700">{discountError}</p>}
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          <SummaryRow label={`Subtotal · ${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'}`} value={formatAmount(totals.subtotal)} />
          {totals.discountAmount > 0 && (
            <SummaryRow
              label={state.discountType === 'PERCENT' ? `Discount (${pct(cart.discountNumber)})` : 'Discount'}
              value={`−${formatAmount(totals.discountAmount)}`}
              accent="text-emerald-700"
            />
          )}
          {taxLines()}
          {totals.roundOff !== 0 && <SummaryRow label="Round off" value={`${totals.roundOff > 0 ? '+' : '−'}${formatAmount(Math.abs(totals.roundOff))}`} muted />}
        </div>

        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-sm font-medium text-slate-600">Total payable</span>
          <span className="tabular text-[34px] leading-none font-normal tracking-[-0.04em] text-brand-900">{formatINR(totals.grandTotal)}</span>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
          {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = state.paymentMethod === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={active}
                onClick={() => cart.update('paymentMethod', value)}
                className={cx(
                  'flex h-14 flex-col items-center justify-center gap-1 rounded-[20px] text-[13px] font-medium transition-all duration-150 active:scale-[0.97]',
                  active ? 'bg-brand-900 text-white' : 'bg-raised text-brand-800 hover:bg-brand-100',
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} /> {label}
              </button>
            );
          })}
        </div>

        {state.paymentMethod === 'CASH' && state.lines.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <input
              className="input tabular h-9 flex-1"
              inputMode="decimal"
              placeholder="Cash received (optional)"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value.replace(/[^\d.]/g, ''))}
            />
            {cashReceived && (
              <span className={cx('tabular shrink-0 font-semibold', change >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                {change >= 0 ? `Return ${formatINR(change)}` : `Short ${formatINR(-change)}`}
              </span>
            )}
          </div>
        )}

        <Button size="lg" className="w-full" onClick={submit} loading={submitting} disabled={!canSubmit}>
          Complete bill · <span className="tabular">{formatINR(totals.grandTotal)}</span>
          <span className="ml-1 hidden sm:inline">
            <Kbd>F2</Kbd>
          </span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:h-[calc(100dvh-72px-16px)] lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_432px]">
      {/* Menu */}
      <section className="flex min-w-0 flex-col pt-3 pb-28 lg:overflow-hidden lg:pb-0">
        <div className="mb-4">
          <h1 className="text-[30px] leading-[1.05] font-medium tracking-[-0.035em] text-brand-900 sm:text-[40px]">New bill</h1>
          <p className="mt-1.5 text-[15px] text-slate-600">
            {catalog.data?.products.length ?? 0} dishes on the menu
            {settings?.taxEnabled && (
              <>
                {' '}
                · {settings.taxLabel} {pct(settings.taxRate)} {settings.taxInclusive ? 'included in prices' : 'added at checkout'}
              </>
            )}
          </p>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            className="input h-12 rounded-full border-transparent pr-20 pl-11 text-[15px]"
            placeholder="Search dishes"
            title="Shortcut: press / to search, Enter adds the first match"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && visibleProducts.length > 0 && search.trim()) {
                addProduct(visibleProducts[0]);
                setSearch('');
              }
              if (e.key === 'Escape') setSearch('');
            }}
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5 text-slate-500">
            {search ? (
              <button className="rounded p-1 hover:text-brand-900" onClick={() => setSearch('')} aria-label="Clear search">
                <X className="size-4" />
              </button>
            ) : (
              <span className="hidden sm:inline">
                <Kbd>/</Kbd>
              </span>
            )}
          </div>
        </div>

        <div className="scroll-thin -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categories">
          {[{ id: 'all' as const, name: 'All', count: catalog.data?.products.length ?? 0 }, ...categories.map((c) => ({ id: c.id, name: c.name, count: countByCategory.get(c.id) ?? 0 }))].map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c.id)}
                className={cx(
                  'flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                  active ? 'bg-brand-900 text-white' : 'bg-white text-brand-800 hover:bg-brand-50',
                )}
              >
                {c.name}
                <span className={cx('tabular text-xs', active ? 'text-brand-200' : 'text-slate-500')}>{c.count}</span>
              </button>
            );
          })}
        </div>

        <div className="scroll-thin flex-1 lg:-mr-2 lg:overflow-y-auto lg:pr-2">
          {visibleProducts.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title={catalog.data?.products.length ? 'No dishes match' : 'No dishes on the menu'}
              hint={catalog.data?.products.length ? 'Try another name or category.' : 'Add products from the Products page.'}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleProducts.map((p) => {
                const qty = qtyInCart.get(p.id) ?? 0;
                return (
                  <div key={p.id} className="relative">
                    <button
                      onClick={() => addProduct(p)}
                      className={cx(
                        'group flex min-h-[118px] w-full flex-col justify-between rounded-[24px] p-4 text-left transition-[background-color,transform] duration-150 active:scale-[0.98]',
                        qty > 0
                          ? 'bg-saffron-200'
                          : 'bg-white hover:bg-brand-50',
                      )}
                    >
                      <span className="pr-14 text-[15px] leading-snug font-semibold text-brand-900">{p.name}</span>
                      <span className="mt-3 flex items-end justify-between gap-2">
                        <span className="tabular text-xl font-medium tracking-[-0.02em] text-brand-900">{formatINR(p.price)}</span>
                        <span className="truncate text-xs text-slate-500">{p.categoryName}</span>
                      </span>
                    </button>
                    {qty > 0 && (
                      <div className="pop-in absolute top-2.5 right-2.5 flex items-center gap-1">
                        <button
                          onClick={() => cart.setQty(p.id, qty - 1)}
                          className="flex size-7 items-center justify-center rounded-full bg-white text-brand-900 transition-colors hover:bg-brand-50"
                          aria-label={`Remove one ${p.name}`}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="tabular flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-900 px-2 text-xs font-semibold text-white">{qty}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Cart: a side panel on desktop */}
      <aside className="hidden overflow-hidden rounded-[28px] bg-white lg:block lg:h-full">{cartPanel}</aside>

      {/* Cart: bottom bar + sheet on phones and tablets */}
      <div className="fixed inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <button onClick={() => setMobileCartOpen(true)} className="flex h-16 w-full items-center justify-between rounded-full bg-brand-900 px-6 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.99]">
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="size-4" /> {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'} · View bill <ChevronUp className="size-4" />
          </span>
          <span className="tabular text-lg font-semibold">{formatINR(totals.grandTotal)}</span>
        </button>
      </div>
      {mobileCartOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-brand-950/45" onClick={() => setMobileCartOpen(false)} />
          <div className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] bg-white">{cartPanel}</div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear bill"
        message="Remove all items from the current bill?"
        confirmLabel="Clear"
        danger
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          cart.clear();
          setCashReceived('');
          setConfirmClear(false);
        }}
      />

      <ReceiptModal bill={receipt} justCreated onClose={newBill} onNewBill={newBill} />
    </div>
  );
}

function SummaryRow({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: string }) {
  return (
    <div className={cx('flex justify-between', muted ? 'text-slate-500' : 'text-slate-700')}>
      <span>{label}</span>
      <span className={cx('tabular font-medium', accent)}>{value}</span>
    </div>
  );
}

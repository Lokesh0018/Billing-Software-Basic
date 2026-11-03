import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, History, Package, Play, ReceiptIndianRupee, ReceiptText, RefreshCw, Settings, ShoppingBasket, Wallet } from 'lucide-react';
import { billsApi, dashboardApi } from '../../api';
import { AnimatedNumber, Badge, EmptyState, ErrorState, Kbd, PAYMENT_BADGE, Segmented, Skeleton, cx } from '../../components/ui';
import { useShopSettings } from '../../context/SettingsContext';
import { formatDate, formatDayMonth, formatINR, PAYMENT_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import type { Bill } from '../../types';

/** Today's bills (all pages) for the hour-by-hour rush. Reuses the bill history API. */
async function loadToday(date: string): Promise<Bill[]> {
  const pageSize = 100;
  const first = await billsApi.list({ from: date, to: date, page: 1, pageSize });
  const pages = Math.ceil(first.total / pageSize);
  if (pages <= 1) return first.data;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => billsApi.list({ from: date, to: date, page: i + 2, pageSize })));
  return [first.data, ...rest.map((r) => r.data)].flat();
}

async function loadDashboard() {
  const summary = await dashboardApi.summary();
  const todayBills = await loadToday(summary.date).catch(() => null);
  return { summary, todayBills, loadedAt: new Date() };
}

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const short = (v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${Math.round(v)}`);
const whole = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

// ---------------------------------------------------------------- building blocks

function IconChip({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <span className={cx('flex size-11 shrink-0 items-center justify-center rounded-full [&>svg]:size-[18px]', dark ? 'bg-brand-900 text-white' : 'bg-white text-brand-900')}>{children}</span>;
}

/** A row of capsules filled up to value/total (the reference's segmented progress). */
function Capsules({ value, total, count = 7, onLime }: { value: number; total: number; count?: number; onLime?: boolean }) {
  const filled = total > 0 ? Math.min(count, Math.round((value / total) * count)) : 0;
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx(
            'h-11 flex-1 rounded-full transition-colors duration-500',
            i < filled ? 'bg-brand-900' : cx('border-[1.5px] border-dashed', onLime ? 'border-brand-900/30' : 'border-brand-300'),
          )}
        />
      ))}
    </div>
  );
}

function PctPill({ pct, onLime }: { pct: number | null; onLime?: boolean }) {
  if (pct === null) return null;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', onLime ? 'bg-white text-brand-900' : 'bg-saffron-200 text-brand-900')}>
      <span className="tabular">{Math.round(pct)}%</span>
      <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${(p / 100) * 37.7} 37.7`} strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * Capsule bar chart: rounded black bars with a dot at the top, the highlight bar in lime,
 * empty periods as dashed tracks. Values show on hover.
 */
function CapsuleChart({
  rows,
  format,
  height = 220,
  labelEvery = 1,
}: {
  rows: { key: string; label: string; value: number; highlight?: boolean; detail?: string }[];
  format: (n: number) => string;
  height?: number;
  labelEvery?: number;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  const step = niceStep(max);
  const top = Math.max(step * 4, step * Math.ceil(max / step));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();

  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col justify-between text-right text-[11px] text-slate-500" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="tabular -my-1.5 leading-none">
            {format(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-rule" style={{ top: `${(1 - t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-between gap-1">
            {rows.map((r, i) => {
              const h = top > 0 ? (r.value / top) * 100 : 0;
              // Keep hover labels inside the card: left half anchors left, right half anchors right.
              const anchor = i < rows.length / 2 ? 'left-0' : 'right-0';
              return (
                <div key={r.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  {r.value > 0 ? (
                    <div
                      className={cx('relative w-[min(34px,78%)] rounded-full transition-[height] duration-500', r.highlight ? 'bg-saffron-200' : 'bg-brand-900')}
                      style={{ height: `max(${h}%, 30px)` }}
                    >
                      <span className={cx('absolute top-2 left-1/2 size-2 -translate-x-1/2 rounded-full', r.highlight ? 'bg-brand-900' : 'bg-white')} />
                    </div>
                  ) : (
                    <div className="h-full w-[min(34px,78%)] rounded-full border-[1.5px] border-dashed border-brand-200" />
                  )}
                  <span className={cx('pointer-events-none absolute bottom-full z-10 mb-1 rounded-full bg-brand-900 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100', anchor)}>
                    {r.detail ?? `${r.label}: ${format(r.value)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2.5 flex justify-between gap-1">
          {rows.map((r, i) => (
            <span key={r.key} className="min-w-0 flex-1 text-center text-[11px] text-slate-500">
              {i % labelEvery === 0 ? r.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceStep(max: number) {
  if (max <= 0) return 1;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function Card({ children, className, tone = 'white' }: { children: ReactNode; className?: string; tone?: 'white' | 'lime' | 'dark' }) {
  const bg = tone === 'lime' ? 'bg-saffron-200' : tone === 'dark' ? 'bg-brand-900 text-white' : 'bg-white';
  return <section className={cx('rounded-[28px] p-5 sm:p-6', bg, className)}>{children}</section>;
}

function CardHead({ icon, title, aside }: { icon: ReactNode; title: string; aside?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-brand-900 [&>svg]:size-[18px]">{icon}</span>
      <h2 className="mr-auto text-lg font-medium tracking-[-0.01em] text-brand-900">{title}</h2>
      {aside}
    </header>
  );
}

// ---------------------------------------------------------------- loading

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-12 w-72 rounded-full" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-60 rounded-[28px] bg-white p-6">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="mt-8 h-14 w-40" />
            <Skeleton className="mt-6 h-11 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- page

export function DashboardPage() {
  const { data, error, loading, reload } = useAsync(loadDashboard, []);
  const { settings } = useShopSettings();
  const [trendMetric, setTrendMetric] = useState<'totalSales' | 'billCount'>('totalSales');
  const [range, setRange] = useState<'7' | '14'>('7');

  const rush = useMemo(() => {
    const byHour = new Map<number, { amount: number; count: number }>();
    for (const b of data?.todayBills ?? []) {
      const h = Number(b.createdAt.slice(11, 13));
      const cur = byHour.get(h) ?? { amount: 0, count: 0 };
      byHour.set(h, { amount: cur.amount + b.grandTotal, count: cur.count + 1 });
    }
    const seen = [...byHour.keys()];
    const start = Math.min(6, ...seen);
    const end = Math.max(21, ...seen);
    const hours = Array.from({ length: end - start + 1 }, (_, i) => {
      const h = start + i;
      const v = byHour.get(h) ?? { amount: 0, count: 0 };
      return { hour: h, amount: Math.round(v.amount * 100) / 100, count: v.count };
    });
    const peak = hours.reduce<(typeof hours)[number] | null>((best, h) => (h.count > 0 && (!best || h.amount > best.amount) ? h : best), null);
    return { hours, peak };
  }, [data?.todayBills]);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { summary, todayBills, loadedAt } = data;
  const t = summary.today;
  const y = summary.yesterday;
  const shop = settings?.shopName ?? '';
  const stamp = loadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const salesPct = y.totalSales > 0 ? (t.totalSales / y.totalSales) * 100 : null;
  const billsPct = y.billCount > 0 ? (t.billCount / y.billCount) * 100 : null;

  const trendRows = summary.dailySales.slice(-Number(range));
  const trendBest = trendRows.reduce((b, r) => (r[trendMetric] > b ? r[trendMetric] : b), 0);
  const payParts = [
    { key: 'CASH' as const, amount: t.cashSales, tone: 'bg-brand-900' },
    { key: 'UPI' as const, amount: t.upiSales, tone: 'bg-saffron-200' },
    { key: 'CARD' as const, amount: t.cardSales, tone: 'bg-brand-300' },
  ];

  const links = [
    { to: '/products', icon: <Package />, title: 'Products', text: `${summary.products.active} of ${summary.products.total} dishes on the billing screen` },
    { to: '/bills', icon: <History />, title: 'Bill history', text: 'Search, view and reprint any bill' },
    { to: '/reports', icon: <BarChart3 />, title: 'Sales reports', text: 'Totals, payments and dishes for any period' },
    { to: '/settings', icon: <Settings />, title: 'Shop settings', text: 'Receipt details, GST and your plan' },
  ];

  return (
    <>
      {/* Title row */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[34px] leading-[1.02] font-medium tracking-[-0.04em] text-brand-900 sm:text-[52px]">
            Today's counter
            {shop && <span className="block text-slate-400">at {shop}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {formatDate(summary.date)} · Updated {stamp}
          </span>
          <button
            onClick={reload}
            className="flex size-11 items-center justify-center rounded-full bg-white text-brand-900 transition-colors hover:bg-brand-50"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={cx('size-[18px]', loading && 'animate-spin')} strokeWidth={1.7} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Headline cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex flex-col">
              <div className="flex items-center gap-3">
                <IconChip>
                  <Wallet />
                </IconChip>
                <p className="font-medium text-brand-900">Today's sales</p>
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
                <p className="text-[44px] leading-none font-normal tracking-[-0.04em] text-brand-900 sm:text-[52px]">
                  <AnimatedNumber value={t.totalSales} format={(n) => `₹${whole(n)}`} />
                </p>
                <PctPill pct={salesPct} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{y.totalSales > 0 ? <>of {formatINR(y.totalSales)} yesterday</> : 'No sales yesterday to compare'}</p>
              <div className="mt-auto pt-5">
                <Capsules value={t.totalSales} total={y.totalSales} />
              </div>
            </Card>

            <Card tone="lime" className="flex flex-col">
              <div className="flex items-center gap-3">
                <IconChip>
                  <ReceiptText />
                </IconChip>
                <p className="font-medium text-brand-900">Bills today</p>
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
                <p className="text-[44px] leading-none font-normal tracking-[-0.04em] text-brand-900 sm:text-[52px]">
                  <AnimatedNumber value={t.billCount} format={(n) => whole(n)} />
                </p>
                <PctPill pct={billsPct} onLime />
              </div>
              <p className="mt-2 text-sm text-brand-800">
                {t.itemsSold} items sold{y.billCount > 0 && <> · {y.billCount} bills yesterday</>}
              </p>
              <div className="mt-auto pt-5">
                <Capsules value={t.billCount} total={y.billCount} onLime />
              </div>
            </Card>

            <Card tone="dark" className="flex flex-col">
              <p className="text-[26px] leading-[1.1] font-normal tracking-[-0.03em]">Bill the next customer</p>
              <p className="mt-3 text-sm text-white/65">Tap the dishes, choose Cash, UPI or Card, print the receipt.</p>
              <div className="mt-auto pt-6">
                <Link to="/billing" className="flex h-14 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-brand-900 transition-colors hover:bg-saffron-100">
                  New bill <Play className="size-4" />
                </Link>
                <p className="mt-2.5 text-center text-xs text-white/50">
                  Press <Kbd>F2</Kbd> on the bill screen to complete
                </p>
              </div>
            </Card>
          </div>

          {/* Breakfast rush: today's takings by hour */}
          <Card>
            <CardHead
              icon={<BarChart3 />}
              title="Breakfast rush"
              aside={
                <div className="flex items-center gap-4 text-[13px] text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-brand-900" /> Takings per hour
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-saffron-200 ring-1 ring-saffron-600/40" /> Busiest hour
                  </span>
                </div>
              }
            />
            {todayBills === null ? (
              <p className="py-12 text-center text-sm text-slate-600">Hourly view unavailable right now.</p>
            ) : (
              <>
                <p className="-mt-2 mb-5 text-sm text-slate-600">
                  {rush.peak ? (
                    <>
                      Busiest so far: <b className="font-medium text-brand-900">{hourLabel(rush.peak.hour)}–{hourLabel(rush.peak.hour + 1)}</b>, {formatINR(rush.peak.amount)} from {rush.peak.count} bill
                      {rush.peak.count === 1 ? '' : 's'}
                    </>
                  ) : (
                    'No bills yet today. Each hour fills in as you bill.'
                  )}
                </p>
                <CapsuleChart
                  rows={rush.hours.map((h) => ({
                    key: String(h.hour),
                    label: hourLabel(h.hour),
                    value: h.amount,
                    highlight: rush.peak?.hour === h.hour,
                    detail: `${hourLabel(h.hour)}: ${formatINR(h.amount)} · ${h.count} bill${h.count === 1 ? '' : 's'}`,
                  }))}
                  format={short}
                  labelEvery={2}
                />
              </>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Sales trend */}
            <Card>
              <CardHead
                icon={<ReceiptIndianRupee />}
                title="Sales trend"
                aside={
                  <div className="flex flex-wrap gap-2">
                    <Segmented size="sm" value={trendMetric} onChange={setTrendMetric} ariaLabel="Metric" options={[{ value: 'totalSales', label: 'Sales' }, { value: 'billCount', label: 'Bills' }]} />
                    <Segmented size="sm" value={range} onChange={setRange} ariaLabel="Range" options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }]} />
                  </div>
                }
              />
              <CapsuleChart
                rows={trendRows.map((d) => ({
                  key: d.date,
                  label: range === '7' ? formatDayMonth(d.date) : d.date.slice(8),
                  value: d[trendMetric],
                  highlight: d.date === summary.date,
                  detail: `${formatDate(d.date)}: ${formatINR(d.totalSales)} · ${d.billCount} bills`,
                }))}
                format={trendMetric === 'totalSales' ? short : (n) => whole(n)}
                height={200}
              />
              <p className="mt-4 text-xs text-slate-500">
                Today in lime · best day {trendMetric === 'totalSales' ? formatINR(trendBest) : `${trendBest} bills`}
              </p>
            </Card>

            {/* Payments */}
            <Card className="flex flex-col">
              <CardHead icon={<Wallet />} title="Payments today" />
              <p className="text-[40px] leading-none font-normal tracking-[-0.04em] text-brand-900">
                <AnimatedNumber value={t.totalSales} format={(n) => `₹${whole(n)}`} />
              </p>
              <div className="mt-5 flex h-11 gap-1.5" aria-hidden>
                {t.totalSales > 0 ? (
                  payParts
                    .filter((p) => p.amount > 0)
                    .map((p) => <div key={p.key} className={cx('h-full min-w-11 rounded-full', p.tone)} style={{ flexGrow: p.amount }} />)
                ) : (
                  <div className="h-full flex-1 rounded-full border-[1.5px] border-dashed border-brand-200" />
                )}
              </div>
              <ul className="mt-5 space-y-3">
                {payParts.map((p) => (
                  <li key={p.key} className="flex items-center gap-3 text-sm">
                    <span className={cx('size-3 rounded-full', p.tone)} />
                    <span className="flex-1 text-brand-900">{PAYMENT_LABEL[p.key]}</span>
                    <span className={cx('tabular font-medium', p.amount ? 'text-brand-900' : 'text-slate-500')}>{formatINR(p.amount)}</span>
                    <span className="tabular w-11 text-right text-slate-500">{t.totalSales > 0 ? `${Math.round((p.amount / t.totalSales) * 100)}%` : '—'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Recent bills */}
          <Card className="px-0 pb-2 sm:px-0">
            <div className="px-5 sm:px-6">
              <CardHead
                icon={<ReceiptText />}
                title="Recent bills"
                aside={
                  <Link to="/bills" className="flex h-9 items-center gap-1 rounded-full bg-raised px-4 text-[13px] font-medium text-brand-900 transition-colors hover:bg-brand-100">
                    View all <ArrowUpRight className="size-3.5" />
                  </Link>
                }
              />
            </div>
            {summary.recentBills.length === 0 ? (
              <EmptyState icon={<ReceiptText />} title="No bills yet" hint="Bills you create will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="pl-6">Bill</th>
                      <th className="hidden sm:table-cell">Time</th>
                      <th className="hidden md:table-cell">Customer</th>
                      <th>Payment</th>
                      <th className="num pr-6">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentBills.map((b) => (
                      <tr key={b.id}>
                        <td className="pl-6 font-medium whitespace-nowrap text-brand-900">{b.billNo}</td>
                        <td className="tabular hidden whitespace-nowrap text-slate-600 sm:table-cell">
                          {b.billDate === summary.date ? 'Today' : formatDayMonth(b.billDate)}, {b.createdAt.slice(11, 16)}
                        </td>
                        <td className="hidden text-slate-600 md:table-cell">{b.customerName ?? 'Walk-in'}</td>
                        <td>
                          <Badge color={PAYMENT_BADGE[b.paymentMethod]}>{PAYMENT_LABEL[b.paymentMethod]}</Badge>
                        </td>
                        <td className="num pr-6 font-semibold whitespace-nowrap text-brand-900">{formatINR(b.grandTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: top dishes and quick links */}
        <aside className="space-y-4">
          <Card>
            <CardHead icon={<ShoppingBasket />} title="Top dishes today" />
            {summary.topItems.length === 0 ? (
              <p className="pb-2 text-sm text-slate-600">Nothing sold yet today. The first bill will show here.</p>
            ) : (
              <ul className="space-y-4">
                {summary.topItems.map((it, i) => {
                  const max = summary.topItems[0].quantity || 1;
                  return (
                    <li key={it.productName}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-brand-900">{it.productName}</span>
                        <span className="tabular shrink-0 text-slate-600">
                          <b className="font-medium text-brand-900">{it.quantity}</b> · {formatINR(it.amount)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-raised">
                        <div className={cx('h-2 rounded-full', i === 0 ? 'bg-saffron-400' : 'bg-brand-900')} style={{ width: `${(it.quantity / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="group block rounded-[28px] bg-white p-5 transition-colors hover:bg-brand-50">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-full bg-raised text-brand-900 transition-colors group-hover:bg-white [&>svg]:size-[18px]">{l.icon}</span>
                  <ArrowUpRight className="size-5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-900" />
                </div>
                <p className="mt-4 font-medium text-brand-900">{l.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-slate-600">{l.text}</p>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

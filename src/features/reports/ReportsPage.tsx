import { useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, FileSpreadsheet, FileText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reportsApi } from '../../api';
import { errorMessage } from '../../api/client';
import { Button, cx, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from '../../components/ui';
import { formatAmount, formatDate, formatDayMonth, formatINR, todayISO } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import type { DailyRow, SalesSummary } from '../../types';

function monthStart(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function monthEnd(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths + 1);
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRESETS = [
  { label: 'Today', range: () => [todayISO(), todayISO()] },
  { label: 'Yesterday', range: () => [todayISO(-1), todayISO(-1)] },
  { label: 'Last 7 days', range: () => [todayISO(-6), todayISO()] },
  { label: 'This month', range: () => [monthStart(), todayISO()] },
  { label: 'Last month', range: () => [monthStart(-1), monthEnd(-1)] },
] as const;

export function ReportsPage() {
  const [from, setFrom] = useState(todayISO(-6));
  const [to, setTo] = useState(todayISO());
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const rangeError = !from || !to ? 'Select both dates' : from > to ? '"From" date must be on or before "To" date' : '';

  const { data, error, loading, reload } = useAsync(
    () => (rangeError ? Promise.resolve(null) : reportsApi.sales(from, to)),
    [from, to, rangeError],
  );

  const doExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      await reportsApi.export(from, to, format);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'));
    } finally {
      setExporting(null);
    }
  };

  const s = data?.summary;

  const activePreset = PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  })?.label;

  return (
    <>
      <PageHeader
        title="Sales reports"
        subtitle={
          <>
            {from && to ? (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`) : 'Choose a period'}
            {s && (
              <>
                {' '}
                · <span className="tabular font-medium text-brand-900">{s.billCount}</span> bill{s.billCount === 1 ? '' : 's'}
              </>
            )}
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} loading={exporting === 'csv'} disabled={!!rangeError} onClick={() => doExport('csv')}>
              CSV
            </Button>
            <Button variant="secondary" icon={<FileText className="size-4" />} loading={exporting === 'pdf'} disabled={!!rangeError} onClick={() => doExport('pdf')}>
              PDF report
            </Button>
          </>
        }
      />

      {/* Period: presets, then the exact dates */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scroll-thin max-w-full overflow-x-auto">
          <Segmented
            ariaLabel="Period"
            value={activePreset ?? 'Custom'}
            onChange={(label) => {
              const p = PRESETS.find((x) => x.label === label);
              if (!p) return;
              const [f, t] = p.range();
              setFrom(f);
              setTo(t);
            }}
            options={[...PRESETS.map((p) => ({ value: p.label as string, label: p.label })), ...(activePreset ? [] : [{ value: 'Custom', label: 'Custom' }])]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <label className="flex min-w-0 flex-col gap-1 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:gap-2">
            <span>From</span>
            <input type="date" className="input h-9 w-full min-w-0 sm:w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:gap-2">
            <span>To</span>
            <input type="date" className="input h-9 w-full min-w-0 sm:w-auto" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>
      {rangeError && <p className="-mt-2 mb-4 text-sm text-red-700">{rangeError}</p>}

      {loading && !data ? (
        <div aria-busy="true">
          <div className="card grid grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-3 h-8 w-32" />
              </div>
            ))}
          </div>
          <div className="card mt-4 h-72 p-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-6 h-52 w-full" />
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || !s ? null : (
        <div className={cx('space-y-4 transition-opacity', loading && 'opacity-60')}>
          {/* KPIs: one container split by hairlines; total sales leads */}
          <section className="card grid grid-cols-2 lg:grid-cols-4" aria-label="Summary">
            {[
              { label: 'Total sales', value: formatINR(s.totalSales), sub: s.totalTax > 0 ? `Includes ${formatINR(s.totalTax)} tax` : 'No tax collected', lead: true },
              { label: 'Bills', value: String(s.billCount), sub: s.billCount ? `Average ${formatINR(s.averageBill)} per bill` : 'No bills in this period' },
              { label: 'Items sold', value: String(s.itemsSold), sub: data.items[0] ? `Most sold: ${data.items[0].productName}` : '—' },
              { label: 'Discounts given', value: formatINR(s.totalDiscount), sub: s.totalSales + s.totalDiscount > 0 ? `${((s.totalDiscount / (s.totalSales + s.totalDiscount)) * 100).toFixed(1)}% of gross` : '—' },
            ].map((k, i) => (
              <div key={k.label} className={cx('min-w-0 p-4 sm:p-5', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line lg:border-t-0', i === 2 && 'lg:border-l')}>
                <p className="text-[13px] text-slate-600">{k.label}</p>
                <p className={cx('tabular mt-1.5 truncate font-semibold tracking-[-0.01em] text-brand-900', k.lead ? 'text-[26px] sm:text-[32px]' : 'text-xl sm:text-2xl')}>{k.value}</p>
                <p className="mt-1.5 truncate text-xs text-slate-500">{k.sub}</p>
              </div>
            ))}
          </section>

          {s.billCount === 0 ? (
            <div className="card">
              <EmptyState icon={<BarChart3 />} title="No sales in this period" hint="Choose another period above." />
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <RevenueTrend rows={data.daily} />
                </div>
                <PaymentBreakdown s={s} />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <section className="card overflow-hidden xl:col-span-2">
                  <header className="flex items-center justify-between px-5 pt-4 pb-3">
                    <h2 className="text-[15px] font-semibold text-brand-900">Day by day</h2>
                    <span className="text-sm text-slate-600">Newest first</span>
                  </header>
                  <div className="scroll-thin max-h-[440px] overflow-auto">
                    <table className="data-table">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr>
                          <th className="pl-5">Date</th>
                          <th className="num">Bills</th>
                          <th className="num hidden sm:table-cell">Cash</th>
                          <th className="num hidden sm:table-cell">UPI</th>
                          <th className="num hidden sm:table-cell">Card</th>
                          <th className="num hidden sm:table-cell">Discount</th>
                          <th className="num pr-5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data.daily].reverse().map((d) => (
                          <tr key={d.date} className={d.billCount ? '' : 'text-slate-500'}>
                            <td className="pl-5 whitespace-nowrap">{formatDate(d.date)}</td>
                            <td className="num">{d.billCount}</td>
                            <td className="num hidden sm:table-cell">{formatAmount(d.cashSales)}</td>
                            <td className="num hidden sm:table-cell">{formatAmount(d.upiSales)}</td>
                            <td className="num hidden sm:table-cell">{formatAmount(d.cardSales)}</td>
                            <td className="num hidden sm:table-cell">{formatAmount(d.totalDiscount)}</td>
                            <td className={cx('num pr-5 font-semibold', d.billCount > 0 && 'text-brand-900')}>{formatAmount(d.totalSales)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="tabular sticky bottom-0 bg-raised font-semibold text-brand-900">
                        <tr>
                          <td className="h-11 border-t border-line pl-5">Total</td>
                          <td className="border-t border-line px-4 text-right">{s.billCount}</td>
                          <td className="hidden border-t border-line px-4 text-right sm:table-cell">{formatAmount(s.cashSales)}</td>
                          <td className="hidden border-t border-line px-4 text-right sm:table-cell">{formatAmount(s.upiSales)}</td>
                          <td className="hidden border-t border-line px-4 text-right sm:table-cell">{formatAmount(s.cardSales)}</td>
                          <td className="hidden border-t border-line px-4 text-right sm:table-cell">{formatAmount(s.totalDiscount)}</td>
                          <td className="border-t border-line pr-5 text-right">{formatAmount(s.totalSales)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <section className="card flex flex-col overflow-hidden">
                  <header className="flex items-center justify-between px-5 pt-4 pb-3">
                    <h2 className="text-[15px] font-semibold text-brand-900">Dishes sold</h2>
                    <span className="text-sm text-slate-600">{data.items.length} dishes</span>
                  </header>
                  <ul className="scroll-thin max-h-[440px] space-y-3.5 overflow-auto px-5 pb-5">
                    {data.items.map((it, i) => {
                      const max = data.items[0]?.quantity || 1;
                      return (
                        <li key={it.productName}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-brand-900">
                              {it.productName}
                              {it.categoryName && <span className="text-slate-500"> · {it.categoryName}</span>}
                            </span>
                            <span className="tabular shrink-0 text-slate-600">
                              <b className="font-medium text-brand-900">{it.quantity}</b> · {formatINR(it.amount)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 rounded-full bg-slate-100">
                            <div className={cx('h-1 rounded-full', i === 0 ? 'bg-saffron-500' : 'bg-brand-300')} style={{ width: `${(it.quantity / max) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-auto border-t border-line px-5 py-3 text-xs text-slate-600">Dish amounts are before bill discounts and tax.</p>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const BAR = '#141513';
const TICK = { fontSize: 12, fill: '#5f6b7e' };
const rupees = (v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${v}`);

function RevenueTrend({ rows }: { rows: DailyRow[] }) {
  const [metric, setMetric] = useState<'totalSales' | 'billCount'>('totalSales');
  const best = rows.reduce<DailyRow | null>((b, r) => (r.billCount > 0 && (!b || r[metric] > b[metric]) ? r : b), null);
  return (
    <section className="card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-1">
        <h2 className="text-[15px] font-semibold text-brand-900">Revenue by day</h2>
        <Segmented size="sm" value={metric} onChange={setMetric} ariaLabel="Metric" options={[{ value: 'totalSales', label: 'Sales' }, { value: 'billCount', label: 'Bills' }]} />
      </header>
      <p className="px-5 text-sm text-slate-600">
        {best ? (
          <>
            Best day: <b className="font-medium text-brand-900">{formatDate(best.date)}</b> with{' '}
            <span className="tabular">{metric === 'totalSales' ? formatINR(best.totalSales) : `${best.billCount} bills`}</span>
          </>
        ) : (
          '—'
        )}
      </p>
      <div className="h-60 px-3 pt-3 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="#eceef2" />
            <XAxis dataKey="date" tickFormatter={formatDayMonth} tick={TICK} tickLine={false} axisLine={{ stroke: '#cfd5df' }} minTickGap={16} />
            <YAxis tickFormatter={metric === 'totalSales' ? rupees : undefined} tick={TICK} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: '#f8f9fb' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as DailyRow;
                return (
                  <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(12,21,41,0.25)]">
                    <p className="font-medium text-brand-900">{formatDate(d.date)}</p>
                    <p className="tabular mt-0.5 text-slate-700">
                      {formatINR(d.totalSales)} · {d.billCount} bill{d.billCount === 1 ? '' : 's'}
                    </p>
                    <p className="tabular text-slate-500">
                      Cash {formatINR(d.cashSales)} · UPI {formatINR(d.upiSales)} · Card {formatINR(d.cardSales)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey={metric} fill={BAR} radius={[14, 14, 14, 14]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const PAY_TONES = { Cash: '#141513', UPI: '#e5f381', Card: '#aeb2aa' } as const;

function PaymentBreakdown({ s }: { s: SalesSummary }) {
  const parts = [
    { label: 'Cash' as const, amount: s.cashSales },
    { label: 'UPI' as const, amount: s.upiSales },
    { label: 'Card' as const, amount: s.cardSales },
  ];
  const total = s.totalSales;
  return (
    <section className="card px-5 pt-4 pb-5">
      <h2 className="text-[15px] font-semibold text-brand-900">Payment breakdown</h2>
      <p className="mt-1 text-sm text-slate-600">How customers paid in this period</p>
      <div className="mt-5 flex h-10 gap-1.5 overflow-hidden rounded-full">
        {total > 0 &&
          parts
            .filter((p) => p.amount > 0)
            .map((p) => <div key={p.label} style={{ width: `${(p.amount / total) * 100}%`, background: PAY_TONES[p.label] }} className="h-full min-w-10 rounded-full" />)}
      </div>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {parts.map((p) => (
            <tr key={p.label} className="border-b border-rule last:border-0">
              <td className="py-2.5">
                <span className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ background: PAY_TONES[p.label] }} />
                  {p.label}
                </span>
              </td>
              <td className={cx('tabular py-2.5 text-right font-medium', p.amount === 0 ? 'text-slate-500' : 'text-brand-900')}>{formatINR(p.amount)}</td>
              <td className="tabular w-16 py-2.5 text-right text-slate-500">{total > 0 ? `${((p.amount / total) * 100).toFixed(1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

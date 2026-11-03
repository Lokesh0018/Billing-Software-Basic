import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Eye, Printer, ReceiptText, Search, X } from 'lucide-react';
import { billsApi } from '../../api';
import { errorMessage } from '../../api/client';
import { Badge, cx, EmptyState, ErrorState, PageHeader, Pagination, PAYMENT_BADGE, Segmented, Skeleton } from '../../components/ui';
import { formatDateTime, formatINR, PAYMENT_LABEL, todayISO } from '../../lib/format';
import { can } from '../../lib/platform';
import { useAsync, useDebounced } from '../../lib/useAsync';
import type { Bill, PaymentMethod } from '../../types';
import { PaymentSuccess } from '../receipt/PaymentSuccess';
import { ReceiptModal } from '../receipt/ReceiptModal';

const PAGE_SIZE = 20;

const QUICK_RANGES = [
  { label: 'Today', from: () => todayISO(), to: () => todayISO() },
  { label: 'Yesterday', from: () => todayISO(-1), to: () => todayISO(-1) },
  { label: 'Last 7 days', from: () => todayISO(-6), to: () => todayISO() },
  { label: 'All', from: () => '', to: () => '' },
];

export function BillHistoryPage() {
  // The top bar's bill search lands here as /bills?q=...
  const [params] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payment, setPayment] = useState<PaymentMethod | ''>('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Bill | null>(null);
  const [celebrating, setCelebrating] = useState<Bill | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const debouncedQ = useDebounced(q.trim(), 300);

  useEffect(() => {
    if (urlQ) {
      setQ(urlQ);
      setPage(1);
    }
  }, [urlQ]);

  const dateError = from && to && from > to ? '"From" date must be before "To" date' : '';

  const { data, error, loading, reload } = useAsync(
    () =>
      dateError
        ? Promise.resolve(null)
        : billsApi.list({
            q: debouncedQ || undefined,
            from: from || undefined,
            to: to || undefined,
            paymentMethod: payment || undefined,
            page,
            pageSize: PAGE_SIZE,
          }),
    [debouncedQ, from, to, payment, page, dateError],
  );

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  /** List rows don't include items; fetch the full bill before showing/printing. */
  const withFullBill = async (b: Bill, action: (full: Bill) => void | Promise<void>) => {
    setBusyId(b.id);
    try {
      await action(await billsApi.get(b.id));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const filtersActive = q || from || to || payment;


  const activeRange = QUICK_RANGES.find((r) => r.from() === from && r.to() === to)?.label ?? 'Custom';

  const actions = (b: Bill) => (
    <div className="flex justify-end gap-0.5">
      <IconBtn label="View bill" disabled={busyId === b.id} onClick={() => withFullBill(b, setViewing)}>
        <Eye className="size-4" />
      </IconBtn>
      <IconBtn label="Print receipt" disabled={busyId === b.id} onClick={() => withFullBill(b, setCelebrating)}>
        <Printer className="size-4" />
      </IconBtn>
      {can.pdf() && (
        <IconBtn label="Download PDF" disabled={busyId === b.id} onClick={() => withFullBill(b, (full) => billsApi.downloadPdf(full, 'a4'))}>
          <Download className="size-4" />
        </IconBtn>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Bill history"
        subtitle={
          data ? (
            <>
              <span className="tabular font-medium text-brand-900">{data.total}</span> bill{data.total === 1 ? '' : 's'} ·{' '}
              <span className="tabular font-medium text-brand-900">{formatINR(data.totalAmount)}</span> {filtersActive ? 'matching your filters' : 'in total'}
            </>
          ) : (
            'Search, view and reprint previous bills'
          )
        }
      />

      <div className="card overflow-hidden">
        {/* Filters: search first, then the period, then payment */}
        <div className="space-y-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
              <input className="input h-9 pl-9" placeholder="Bill number, customer or phone" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} aria-label="Search bills" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <label className="flex min-w-0 flex-col gap-1 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:gap-2">
                <span>From</span>
                <input type="date" className="input h-9 w-full min-w-0 sm:w-auto" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:gap-2">
                <span>To</span>
                <input type="date" className="input h-9 w-full min-w-0 sm:w-auto" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="scroll-thin max-w-full overflow-x-auto">
              <Segmented
                ariaLabel="Period"
                value={activeRange}
                onChange={(label) => {
                  const r = QUICK_RANGES.find((x) => x.label === label);
                  if (!r) return;
                  setFrom(r.from());
                  setTo(r.to());
                  setPage(1);
                }}
                options={[...QUICK_RANGES.map((r) => ({ value: r.label, label: r.label })), ...(activeRange === 'Custom' ? [{ value: 'Custom', label: 'Custom' }] : [])]}
              />
            </div>
            <div className="scroll-thin max-w-full overflow-x-auto">
              <Segmented
                ariaLabel="Payment method"
                value={payment || 'ALL'}
                onChange={(v) => resetPage(setPayment)(v === 'ALL' ? '' : (v as PaymentMethod))}
                options={[
                  { value: 'ALL', label: 'All payments' },
                  { value: 'CASH', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'CARD', label: 'Card' },
                ]}
              />
            </div>
            {filtersActive && (
              <button
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-slate-600 hover:bg-raised hover:text-brand-900"
                onClick={() => {
                  setQ('');
                  setFrom('');
                  setTo('');
                  setPayment('');
                  setPage(1);
                }}
              >
                <X className="size-3.5" /> Clear filters
              </button>
            )}
          </div>
          {dateError && <p className="text-sm text-red-700">{dateError}</p>}
        </div>

        {loading && !data ? (
          <div className="divide-y divide-rule" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-14 items-center gap-6 px-5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="hidden h-4 w-40 md:block" />
                <Skeleton className="hidden h-4 w-24 md:block" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={<ReceiptText />} title={filtersActive ? 'No bills match these filters' : 'No bills yet'} hint={filtersActive ? 'Try another search or period.' : 'Completed bills will appear here.'} />
        ) : (
          <>
            {/* Phones: two-line rows */}
            <ul className={cx('divide-y divide-rule transition-opacity md:hidden', loading && 'opacity-60')}>
              {data.data.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-900">{b.billNo}</p>
                      <p className="text-xs text-slate-600">{formatDateTime(b.createdAt)}</p>
                    </div>
                    <p className="tabular shrink-0 font-semibold text-brand-900">{formatINR(b.grandTotal)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge color={PAYMENT_BADGE[b.paymentMethod]}>{PAYMENT_LABEL[b.paymentMethod]}</Badge>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                      {b.itemCount} items · {b.customerName || b.customerPhone ? [b.customerName, b.customerPhone].filter(Boolean).join(' · ') : 'Walk-in'}
                    </span>
                    {actions(b)}
                  </div>
                </li>
              ))}
            </ul>

            <div className={cx('hidden overflow-x-auto transition-opacity md:block', loading && 'opacity-60')}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-5">Bill</th>
                    <th>Date &amp; time</th>
                    <th>Customer</th>
                    <th className="num">Items</th>
                    <th>Payment</th>
                    <th className="num">Amount</th>
                    <th className="pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((b) => (
                    <tr key={b.id}>
                      <td className="pl-5 font-medium whitespace-nowrap text-brand-900">{b.billNo}</td>
                      <td className="tabular whitespace-nowrap text-slate-600">{formatDateTime(b.createdAt)}</td>
                      <td>
                        {b.customerName || b.customerPhone ? (
                          <>
                            <p className="text-brand-900">{b.customerName ?? '—'}</p>
                            {b.customerPhone && <p className="tabular text-xs text-slate-600">{b.customerPhone}</p>}
                          </>
                        ) : (
                          <span className="text-slate-500">Walk-in</span>
                        )}
                      </td>
                      <td className="num text-slate-600">{b.itemCount}</td>
                      <td>
                        <Badge color={PAYMENT_BADGE[b.paymentMethod]}>{PAYMENT_LABEL[b.paymentMethod]}</Badge>
                      </td>
                      <td className="num font-semibold whitespace-nowrap text-brand-900">{formatINR(b.grandTotal)}</td>
                      <td className="pr-4">{actions(b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>

      <ReceiptModal bill={viewing} onClose={() => setViewing(null)} />
      <PaymentSuccess bill={celebrating} onClose={() => setCelebrating(null)} />
    </>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-900 disabled:opacity-40"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

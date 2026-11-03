import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { Button } from '../../components/ui';
import { formatDateTime, formatINR, PAYMENT_LABEL } from '../../lib/format';
import type { Bill } from '../../types';

const AUTO_CLOSE_MS = 3200;
const PAY_ICON = { CASH: Banknote, UPI: Smartphone, CARD: CreditCard } as const;

/**
 * Shown instead of the browser print dialog: an animated "payment successful" confirmation for
 * the bill. Closes itself after a few seconds, or on Done, Escape or a click outside.
 */
export function PaymentSuccess({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!bill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // don't also close the receipt dialog underneath
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const t = setTimeout(() => closeRef.current(), AUTO_CLOSE_MS);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      clearTimeout(t);
    };
  }, [bill]);

  if (!bill) return null;
  const PayIcon = PAY_ICON[bill.paymentMethod];

  // Portal to <body> so the receipt dialog's transforms and scrolling never clip it.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fade-in absolute inset-0 bg-brand-950/55" onClick={onClose} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pay-ok-title"
        aria-describedby="pay-ok-desc"
        className="success-card relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white px-7 pt-9 pb-7 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
      >
        {/* Animated check: ring pops, one soft pulse, then the tick draws itself */}
        <div className="relative mx-auto size-24">
          <span className="success-pulse absolute inset-0 rounded-full bg-emerald-500/25" />
          <svg viewBox="0 0 96 96" className="success-badge relative size-24" aria-hidden>
            <circle cx="48" cy="48" r="44" className="fill-emerald-600" />
            <path d="M30 49.5 42.5 62 67 36" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="success-tick" />
          </svg>
        </div>

        <h2 id="pay-ok-title" className="success-text mt-6 text-[22px] font-semibold tracking-[-0.02em] text-brand-900">
          Payment successful
        </h2>
        <p id="pay-ok-desc" className="success-text mt-1 text-sm text-slate-600">
          Bill <span className="font-medium text-brand-900">{bill.billNo}</span> generated
        </p>

        <p className="success-text tabular mt-5 text-[34px] leading-none font-semibold tracking-[-0.02em] text-brand-900">{formatINR(bill.grandTotal)}</p>
        <div className="success-text mt-3 flex items-center justify-center gap-2 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset">
            <PayIcon className="size-3.5" /> {PAYMENT_LABEL[bill.paymentMethod]}
          </span>
          <span>
            {bill.itemCount} item{bill.itemCount === 1 ? '' : 's'}
          </span>
        </div>
        <p className="success-text mt-2 text-xs text-slate-500">{formatDateTime(bill.createdAt)}</p>

        <Button autoFocus variant="success" size="lg" className="success-text mt-7 w-full" onClick={onClose}>
          Done
        </Button>

        {/* Time left before it closes by itself */}
        <span className="success-timer absolute inset-x-0 bottom-0 h-1 origin-left bg-emerald-500" style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }} />
      </div>
    </div>,
    document.body,
  );
}

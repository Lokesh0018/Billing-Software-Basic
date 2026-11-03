const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const inrShort = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatINR = (n: number) => inr.format(n);
export const formatINRShort = (n: number) => inrShort.format(n);
export const formatAmount = (n: number) => num.format(n);

/** "2026-11-02 09:15:00" -> "02 Nov 2026, 09:15 AM" */
export function formatDateTime(s: string) {
  const [d, t = '00:00:00'] = s.split(' ');
  const [hh, mm] = t.split(':').map(Number);
  const h12 = hh % 12 || 12;
  return `${formatDate(d)}, ${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-02" -> "02 Nov 2026" */
export function formatDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** "2026-11-02" -> "02 Nov" */
export function formatDayMonth(s: string) {
  const [, m, d] = s.split('-');
  return `${d} ${MONTHS[Number(m) - 1]}`;
}

/** Local date as YYYY-MM-DD (shop's computer clock). */
export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const PAYMENT_LABEL = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card' } as const;

export function pct(n: number) {
  return `${Number(n.toFixed(2))}%`;
}

/** Splits a tax amount so CGST + SGST add up exactly to the total. */
export function splitTax(total: number) {
  const paise = Math.round(total * 100);
  const first = Math.floor(paise / 2);
  return [first / 100, (paise - first) / 100] as const;
}

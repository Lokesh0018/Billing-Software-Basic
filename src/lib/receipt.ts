import type { Bill, ShopSettings } from '../types';
import { formatAmount, formatDateTime, formatINR, PAYMENT_LABEL, pct, splitTax } from './format';

export type PaperSize = '80mm' | '58mm' | 'a4';

const PAPER_KEY = 'tiffinflow.paper';

/** Printer paper size chosen on this computer (defaults to 80mm thermal). */
export function readPaperPreference(): PaperSize {
  try {
    const v = localStorage.getItem(PAPER_KEY);
    return v === '58mm' || v === 'a4' ? v : '80mm';
  } catch {
    return '80mm';
  }
}

export function savePaperPreference(p: PaperSize) {
  try {
    localStorage.setItem(PAPER_KEY, p);
  } catch {
    /* storage unavailable */
  }
}

interface SummaryLine {
  label: string;
  value: string;
  muted?: boolean;
}

/** Mirror of server/src/utils/receipt.ts so printed and PDF receipts match. */
export function summaryLines(bill: Bill, s: ShopSettings): SummaryLine[] {
  const lines: SummaryLine[] = [{ label: 'Subtotal', value: formatAmount(bill.subtotal) }];
  if (bill.discountAmount > 0) {
    lines.push({
      label: bill.discountType === 'PERCENT' ? `Discount (${pct(bill.discountValue)})` : 'Discount',
      value: `-${formatAmount(bill.discountAmount)}`,
    });
  }
  if (bill.taxEnabled && bill.taxAmount > 0) {
    const prefix = bill.taxInclusive ? 'Incl. ' : '';
    if (bill.taxInclusive) {
      lines.push({ label: 'Taxable value', value: formatAmount(bill.taxableAmount - bill.taxAmount), muted: true });
    }
    if (s.splitTax) {
      const [c, g] = splitTax(bill.taxAmount);
      const half = pct(bill.taxRate / 2);
      lines.push({ label: `${prefix}CGST @ ${half}`, value: formatAmount(c), muted: bill.taxInclusive });
      lines.push({ label: `${prefix}SGST @ ${half}`, value: formatAmount(g), muted: bill.taxInclusive });
    } else {
      lines.push({ label: `${prefix}${s.taxLabel || 'GST'} @ ${pct(bill.taxRate)}`, value: formatAmount(bill.taxAmount), muted: bill.taxInclusive });
    }
  }
  if (bill.roundOff !== 0) {
    lines.push({ label: 'Round off', value: `${bill.roundOff > 0 ? '+' : ''}${formatAmount(bill.roundOff)}` });
  }
  return lines;
}

export const receiptTitle = (bill: Bill, s: ShopSettings) => (bill.taxEnabled && s.gstin ? 'TAX INVOICE' : 'BILL RECEIPT');

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const THERMAL_CSS = (width: string) => `
  @page { size: ${width} auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${width}; padding: 3mm 3mm 6mm; color: #000;
         font: 12px/1.35 'Courier New', ui-monospace, monospace; -webkit-print-color-adjust: exact; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .shop { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
  .small { font-size: 11px; } .muted { color: #333; }
  .rule { border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 1px 0; vertical-align: top; font-weight: inherit; }
  th { font-weight: 700; text-align: left; }
  .qty { width: 12%; text-align: right; } .rate { width: 20%; text-align: right; } .amt { width: 22%; text-align: right; }
  .total td { font-size: 15px; font-weight: 700; padding-top: 3px; }
  .footer { margin-top: 6px; }
`;

const A4_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #0f172a; font: 13px/1.5 'Inter', 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 8px; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .shop { font-size: 24px; font-weight: 700; color: #1e2b89; }
  .small { font-size: 12px; } .muted { color: #64748b; }
  .title { margin: 14px 0 10px; font-weight: 700; letter-spacing: .08em; }
  .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .rule { border-top: 1px solid #e2e8f0; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eff4ff; color: #1e2b89; text-align: left; padding: 8px; font-size: 12px; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
  .qty, .rate, .amt { text-align: right; }
  .totals { width: 320px; margin-left: auto; margin-top: 10px; }
  .totals td { border: 0; padding: 4px 8px; }
  .total td { background: #1e2b89; color: #fff; font-size: 16px; font-weight: 700; padding: 10px 8px; }
  .footer { margin-top: 28px; color: #1e2b89; font-weight: 600; }
`;

/** Self-contained HTML document for a receipt, used for both preview and printing. */
export function receiptHtml(bill: Bill, s: ShopSettings, size: PaperSize = '80mm'): string {
  const items = bill.items ?? [];
  const totals = summaryLines(bill, s)
    .map((l) => `<tr${l.muted ? ' class="muted"' : ''}><td>${esc(l.label)}</td><td class="r">${esc(l.value)}</td></tr>`)
    .join('');
  const customer = [bill.customerName, bill.customerPhone].filter(Boolean).join(' / ');

  if (size === 'a4') {
    const rows = items
      .map(
        (it, i) =>
          `<tr><td>${i + 1}</td><td>${esc(it.productName)}</td><td class="qty">${it.quantity}</td><td class="rate">${formatAmount(it.unitPrice)}</td><td class="amt">${formatAmount(it.lineTotal)}</td></tr>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(bill.billNo)}</title><style>${A4_CSS}</style></head><body><div class="wrap">
      <div class="c"><div class="shop">${esc(s.shopName)}</div>
        ${s.address ? `<div class="small muted">${esc(s.address)}</div>` : ''}
        <div class="small muted">${[s.phone && `Phone: ${esc(s.phone)}`, s.gstin && `GSTIN: ${esc(s.gstin)}`].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>
        <div class="title">${receiptTitle(bill, s)}</div></div>
      <div class="meta"><div>Bill No: <b>${esc(bill.billNo)}</b><br>Date: ${esc(formatDateTime(bill.createdAt))}<br>Payment: ${PAYMENT_LABEL[bill.paymentMethod]}</div>
        <div class="r">${bill.customerName ? `Customer: ${esc(bill.customerName)}<br>` : ''}${bill.customerPhone ? `Phone: ${esc(bill.customerPhone)}` : ''}</div></div>
      <table><thead><tr><th>#</th><th>Item</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amt">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="totals"><tbody>${totals}<tr class="total"><td>Grand Total</td><td class="r">${esc(formatINR(bill.grandTotal))}</td></tr></tbody></table>
      <p class="small muted">Items: ${bill.itemCount} &nbsp;|&nbsp; Paid by ${PAYMENT_LABEL[bill.paymentMethod]}</p>
      ${s.receiptFooter ? `<div class="c footer">${esc(s.receiptFooter)}</div>` : ''}
    </div></body></html>`;
  }

  const rows = items
    .map(
      (it) =>
        `<tr><td>${esc(it.productName)}</td><td class="qty">${it.quantity}</td><td class="rate">${formatAmount(it.unitPrice)}</td><td class="amt">${formatAmount(it.lineTotal)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(bill.billNo)}</title><style>${THERMAL_CSS(size)}</style></head><body>
    <div class="c"><div class="shop">${esc(s.shopName)}</div>
      ${s.address ? `<div class="small">${esc(s.address)}</div>` : ''}
      ${s.phone ? `<div class="small">Ph: ${esc(s.phone)}</div>` : ''}
      ${s.gstin ? `<div class="small">GSTIN: ${esc(s.gstin)}</div>` : ''}</div>
    <div class="rule"></div>
    <div class="c b">${receiptTitle(bill, s)}</div>
    <table class="small"><tr><td>Bill: <b>${esc(bill.billNo)}</b></td><td class="r">${PAYMENT_LABEL[bill.paymentMethod]}</td></tr>
      <tr><td colspan="2">${esc(formatDateTime(bill.createdAt))}</td></tr>
      ${customer ? `<tr><td colspan="2">${esc(customer)}</td></tr>` : ''}</table>
    <div class="rule"></div>
    <table><thead><tr><th>Item</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amt">Amt</th></tr></thead></table>
    <div class="rule"></div>
    <table><tbody>${rows}</tbody></table>
    <div class="rule"></div>
    <table><tbody>${totals}</tbody></table>
    <div class="rule"></div>
    <table><tbody><tr class="total"><td>TOTAL</td><td class="r">${esc(formatINR(bill.grandTotal))}</td></tr>
      <tr class="small"><td>Items: ${bill.itemCount}</td><td class="r">Paid: ${PAYMENT_LABEL[bill.paymentMethod]}</td></tr></tbody></table>
    <div class="rule"></div>
    ${s.receiptFooter ? `<div class="c footer">${esc(s.receiptFooter)}</div>` : ''}
  </body></html>`;
}

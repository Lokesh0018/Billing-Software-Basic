/**
 * Bill calculation engine. All arithmetic is done in integer paise (1 rupee = 100 paise)
 * and percentages in basis points (1% = 100 bp) to avoid floating-point errors.
 *
 * Mirror of server/src/utils/billing.ts, used for the live cart total. The server recalculates
 * everything from database prices and rejects the bill if its total differs.
 */

export type DiscountType = 'NONE' | 'FLAT' | 'PERCENT';

export interface CalcLineInput {
  unitPrice: number; // rupees, max 2 decimals
  quantity: number;
}

export interface TaxConfig {
  enabled: boolean;
  rate: number; // percent, e.g. 5
  inclusive: boolean;
}

export interface CalcInput {
  lines: CalcLineInput[];
  discountType: DiscountType;
  discountValue: number; // rupees for FLAT, percent for PERCENT
  tax: TaxConfig;
}

export interface CalcResult {
  lineTotals: number[]; // rupees
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number; // amount after discount (incl. tax when inclusive)
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;
const toBp = (percent: number) => Math.round(percent * 100);

export function calculateBill(input: CalcInput): CalcResult {
  const linePaise = input.lines.map((l) => toPaise(l.unitPrice) * l.quantity);
  const subtotal = linePaise.reduce((a, b) => a + b, 0);
  const itemCount = input.lines.reduce((a, l) => a + l.quantity, 0);

  let discount = 0;
  if (input.discountType === 'FLAT') discount = toPaise(input.discountValue);
  else if (input.discountType === 'PERCENT') discount = Math.round((subtotal * toBp(input.discountValue)) / 10000);
  discount = Math.min(Math.max(discount, 0), subtotal);

  const afterDiscount = subtotal - discount;

  let tax = 0;
  let total = afterDiscount;
  if (input.tax.enabled && input.tax.rate > 0) {
    const rateBp = toBp(input.tax.rate);
    if (input.tax.inclusive) {
      // Price already contains tax: extract it.
      const base = Math.round((afterDiscount * 10000) / (10000 + rateBp));
      tax = afterDiscount - base;
    } else {
      tax = Math.round((afterDiscount * rateBp) / 10000);
      total = afterDiscount + tax;
    }
  }

  // Round grand total to the nearest rupee.
  const grand = Math.round(total / 100) * 100;

  return {
    lineTotals: linePaise.map(toRupees),
    itemCount,
    subtotal: toRupees(subtotal),
    discountAmount: toRupees(discount),
    taxableAmount: toRupees(afterDiscount),
    taxAmount: toRupees(tax),
    roundOff: toRupees(grand - total),
    grandTotal: toRupees(grand),
  };
}

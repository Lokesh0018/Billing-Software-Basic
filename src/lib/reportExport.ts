import type { SalesReport, ShopSettings } from '../types';
import { formatAmount, formatDate } from './format';

const period = (r: SalesReport) => (r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} to ${formatDate(r.to)}`);

/** Sales report as CSV: summary, then day-by-day, then dish-wise rows. Opens cleanly in Excel. */
export function salesReportCsv(r: SalesReport, shop: ShopSettings): Blob {
  const s = r.summary;
  const rows: (string | number)[][] = [
    [shop.shopName],
    ['Sales report', period(r)],
    [],
    ['Summary'],
    ['Total sales', s.totalSales],
    ['Bills', s.billCount],
    ['Average bill', s.averageBill],
    ['Items sold', s.itemsSold],
    ['Cash', s.cashSales],
    ['UPI', s.upiSales],
    ['Card', s.cardSales],
    ['Discounts given', s.totalDiscount],
    ['Tax collected', s.totalTax],
    [],
    ['Day by day'],
    ['Date', 'Bills', 'Items', 'Cash', 'UPI', 'Card', 'Discount', 'Tax', 'Total'],
    ...r.daily.map((d) => [d.date, d.billCount, d.itemsSold, d.cashSales, d.upiSales, d.cardSales, d.totalDiscount, d.totalTax, d.totalSales]),
    ['Total', s.billCount, s.itemsSold, s.cashSales, s.upiSales, s.cardSales, s.totalDiscount, s.totalTax, s.totalSales],
    [],
    ['Dishes sold'],
    ['Dish', 'Category', 'Quantity', 'Amount'],
    ...r.items.map((i) => [i.productName, i.categoryName ?? '', i.quantity, i.amount]),
  ];
  const cell = (v: string | number) => (typeof v === 'number' ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // BOM so Excel reads the file as UTF-8.
  return new Blob(['﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

/** Sales report as an A4 PDF. jsPDF is loaded only when someone exports. */
export async function salesReportPdf(r: SalesReport, shop: ShopSettings): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  // The built-in PDF fonts have no rupee sign.
  const rs = (n: number) => `Rs. ${formatAmount(n)}`;
  const s = r.summary;
  const left = 40;
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const head = { fillColor: [20, 26, 83] as [number, number, number], textColor: 255, fontStyle: 'bold' as const };

  doc.setFont('helvetica', 'bold').setFontSize(16).text(shop.shopName, left, 50);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90);
  if (shop.address) doc.text(shop.address, left, 66);
  doc.setTextColor(20).setFontSize(12).text(`Sales report: ${period(r)}`, left, 90);

  autoTable(doc, {
    startY: 102,
    theme: 'grid',
    headStyles: head,
    head: [['Total sales', 'Bills', 'Average bill', 'Items sold', 'Discounts', 'Tax']],
    body: [[rs(s.totalSales), s.billCount, rs(s.averageBill), s.itemsSold, rs(s.totalDiscount), rs(s.totalTax)]],
  });
  autoTable(doc, {
    startY: lastY() + 12,
    theme: 'grid',
    headStyles: head,
    head: [['Cash', 'UPI', 'Card']],
    body: [[rs(s.cashSales), rs(s.upiSales), rs(s.cardSales)]],
  });

  const num = { halign: 'right' as const };
  autoTable(doc, {
    startY: lastY() + 22,
    theme: 'striped',
    headStyles: head,
    head: [['Date', 'Bills', 'Cash', 'UPI', 'Card', 'Discount', 'Total']],
    body: r.daily.map((d) => [formatDate(d.date), d.billCount, formatAmount(d.cashSales), formatAmount(d.upiSales), formatAmount(d.cardSales), formatAmount(d.totalDiscount), formatAmount(d.totalSales)]),
    foot: [['Total', s.billCount, formatAmount(s.cashSales), formatAmount(s.upiSales), formatAmount(s.cardSales), formatAmount(s.totalDiscount), formatAmount(s.totalSales)]],
    footStyles: { fillColor: [238, 240, 245], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 1: num, 2: num, 3: num, 4: num, 5: num, 6: num },
  });
  autoTable(doc, {
    startY: lastY() + 22,
    theme: 'striped',
    headStyles: head,
    head: [['Dish', 'Category', 'Quantity', 'Amount']],
    body: r.items.map((i) => [i.productName, i.categoryName ?? '', i.quantity, formatAmount(i.amount)]),
    columnStyles: { 2: num, 3: num },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFontSize(8).setTextColor(120);
    doc.text(`Page ${p} of ${pages}`, doc.internal.pageSize.getWidth() - left, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  return doc.output('blob');
}

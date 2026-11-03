/**
 * The app's only data source: an in-browser implementation of the REST API, stored in
 * localStorage and seeded with sample data. Plugged in as an axios adapter, so every screen
 * works unchanged without a backend server.
 */
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { calculateBill } from '../lib/billing';
import type { Bill, BillItem, Category, DailyRow, ItemRow, PaymentMethod, Product, SalesSummary, ShopSettings } from '../types';

const KEY = 'tiffinflow.local.v1';

interface LocalDb {
  settings: ShopSettings;
  categories: Omit<Category, 'productCount'>[];
  products: Omit<Product, 'categoryName'>[];
  bills: Bill[];
  nextId: number;
  seq: { date: string; n: number };
}

const USER = { id: 1, name: 'SHM Admin', email: 'shmtech@gmail.com', role: 'admin' as const };
const PASSWORD = 'Shm@123';
const TOKEN = 'local-session';

// ---------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoDateTime = (d: Date) => `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

// ---------------------------------------------------------------- storage

function load(): LocalDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to fresh sample data */
  }
  const db = seed();
  save(db);
  return db;
}

function save(db: LocalDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full/unavailable: changes last until reload */
  }
}

function seed(): LocalDb {
  const categories = [
    { id: 1, name: 'Breakfast', sortOrder: 1, isActive: true },
    { id: 2, name: 'Dosas', sortOrder: 2, isActive: true },
    { id: 3, name: 'Meals', sortOrder: 3, isActive: true },
    { id: 4, name: 'Snacks', sortOrder: 4, isActive: true },
    { id: 5, name: 'Beverages', sortOrder: 5, isActive: true },
  ];
  const list: [number, string, number][] = [
    [1, 'Idly', 40], [1, 'Vada', 30], [1, 'Pongal', 50], [1, 'Upma', 40], [1, 'Poori', 50],
    [2, 'Masala Dosa', 60], [2, 'Plain Dosa', 50], [2, 'Onion Dosa', 65], [2, 'Rava Dosa', 70], [2, 'Pesarattu', 60],
    [3, 'Mini Meals', 90], [3, 'Full Meals', 130], [3, 'Curd Rice', 60], [3, 'Lemon Rice', 60],
    [4, 'Mysore Bonda', 40], [4, 'Mirchi Bajji', 35], [4, 'Samosa', 20],
    [5, 'Tea', 15], [5, 'Filter Coffee', 20], [5, 'Badam Milk', 35], [5, 'Fresh Lime Soda', 30],
  ];
  const products = list.map(([categoryId, name, price], i) => ({
    id: i + 1, name, price, categoryId, isActive: name !== 'Badam Milk', sortOrder: i + 1,
  }));
  const db: LocalDb = {
    settings: {
      appName: 'TiffinFlow', appTagline: 'Billing', shopName: 'SHM Tiffin Center', address: '12, Main Road, Hyderabad',
      phone: '+91 90000 00000', gstin: null, taxEnabled: false, taxRate: 5, taxInclusive: true, taxLabel: 'GST',
      splitTax: true, receiptFooter: 'Thank you! Visit again.', currency: 'INR', billPrefix: 'TF',
    },
    categories, products, bills: [], nextId: 100, seq: { date: '', n: 0 },
  };

  // A month of sample sales so the dashboard, history and reports have something to show.
  let r = 7;
  const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const customers = [
    ['Ravi Kumar', '98480 12345'], ['Priya Sharma', '99590 22331'], ['Anil Reddy', '90300 45678'],
    ['Lakshmi N', '97010 88990'], ['Suresh Babu', '96660 11223'], ['Meena K', '93910 55667'],
  ] as const;
  const available = products.filter((p) => p.isActive);
  const now = new Date();
  const today = isoDate(now);
  for (let day = 29; day >= 0; day--) {
    const date = addDays(today, -day);
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
    const count = 14 + Math.floor(rand() * 10) + (weekend ? 8 : 0);
    // Bills spread over 6:30 am – 9:30 pm; today's stop at the current time.
    const times = Array.from({ length: count }, () => 390 + Math.floor(rand() * 900)).sort((a, b) => a - b);
    for (const minutes of times) {
      const when = new Date(`${date}T00:00:00`);
      when.setMinutes(minutes);
      if (when > now) break;
      const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({
        productId: pick(available).id,
        quantity: 1 + Math.floor(rand() * 3),
      }));
      const customer = rand() < 0.3 ? pick(customers) : null;
      const discount: Pick<BillInput, 'discountType' | 'discountValue'> =
        rand() < 0.12 ? (rand() < 0.5 ? { discountType: 'PERCENT', discountValue: 10 } : { discountType: 'FLAT', discountValue: 20 }) : {};
      createBillIn(db, {
        items: lines,
        ...discount,
        paymentMethod: pick(['CASH', 'UPI', 'UPI', 'CASH', 'UPI', 'CARD'] as const),
        customerName: customer?.[0],
        customerPhone: customer?.[1],
      }, when);
    }
  }
  return db;
}

// ---------------------------------------------------------------- domain

const withCategory = (db: LocalDb, p: LocalDb['products'][number]): Product => ({
  ...p,
  categoryName: db.categories.find((c) => c.id === p.categoryId)?.name ?? '',
});

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface BillInput {
  items: { productId: number; quantity: number }[];
  discountType?: Bill['discountType'];
  discountValue?: number;
  paymentMethod: PaymentMethod;
  customerName?: string | null;
  customerPhone?: string | null;
  expectedTotal?: number;
}

function createBillIn(db: LocalDb, input: BillInput, now = new Date()): Bill {
  if (!input.items?.length) throw new ApiError(400, 'Add at least one item to the bill');
  const merged = new Map<number, number>();
  for (const it of input.items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
  const lines = [...merged].map(([productId, quantity]) => {
    const p = db.products.find((x) => x.id === productId);
    if (!p) throw new ApiError(400, 'A product in this bill no longer exists');
    if (!p.isActive) throw new ApiError(400, `"${p.name}" is currently unavailable. Remove it from the bill.`);
    return { p, quantity, unitPrice: p.price };
  });
  const discountType = input.discountType ?? 'NONE';
  const discountValue = discountType === 'NONE' ? 0 : (input.discountValue ?? 0);
  const s = db.settings;
  const calc = calculateBill({
    lines, discountType, discountValue,
    tax: { enabled: s.taxEnabled, rate: s.taxRate, inclusive: s.taxInclusive },
  });
  if (input.expectedTotal !== undefined && Math.abs(input.expectedTotal - calc.grandTotal) > 0.001) {
    throw new ApiError(409, 'Prices or tax settings have changed. Please review the bill and try again.');
  }

  const date = isoDate(now);
  db.seq = db.seq.date === date ? { date, n: db.seq.n + 1 } : { date, n: 1 };
  const id = db.nextId++;
  const items: BillItem[] = lines.map((l, i) => ({
    id: id * 100 + i, productId: l.p.id, productName: l.p.name,
    categoryName: db.categories.find((c) => c.id === l.p.categoryId)?.name ?? null,
    unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: calc.lineTotals[i],
  }));
  const bill: Bill = {
    id, billNo: `${s.billPrefix}-${date.replace(/-/g, '')}-${pad(db.seq.n).padStart(4, '0')}`, billDate: date,
    createdAt: isoDateTime(now), customerName: input.customerName || null, customerPhone: input.customerPhone || null,
    itemCount: calc.itemCount, subtotal: calc.subtotal, discountType, discountValue, discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount, taxEnabled: s.taxEnabled, taxInclusive: s.taxInclusive, taxRate: s.taxRate,
    taxAmount: calc.taxAmount, roundOff: calc.roundOff, grandTotal: calc.grandTotal, paymentMethod: input.paymentMethod,
    status: 'PAID', createdBy: USER.name, items,
  };
  db.bills.push(bill);
  return bill;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function aggregate(bills: Bill[]) {
  const sum = (f: (b: Bill) => number) => r2(bills.reduce((a, b) => a + f(b), 0));
  const byPay = (m: PaymentMethod) => sum((b) => (b.paymentMethod === m ? b.grandTotal : 0));
  return {
    billCount: bills.length, itemsSold: sum((b) => b.itemCount), totalSales: sum((b) => b.grandTotal),
    cashSales: byPay('CASH'), upiSales: byPay('UPI'), cardSales: byPay('CARD'),
    totalDiscount: sum((b) => b.discountAmount), totalTax: sum((b) => b.taxAmount),
  };
}

function summary(db: LocalDb, from: string, to: string): SalesSummary {
  const a = aggregate(db.bills.filter((b) => b.billDate >= from && b.billDate <= to));
  return { ...a, averageBill: a.billCount ? r2(a.totalSales / a.billCount) : 0 };
}

function daily(db: LocalDb, from: string, to: string): DailyRow[] {
  const out: DailyRow[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, ...aggregate(db.bills.filter((b) => b.billDate === d)) });
  return out;
}

function itemWise(db: LocalDb, from: string, to: string, limit?: number): ItemRow[] {
  const map = new Map<string, ItemRow>();
  for (const b of db.bills) {
    if (b.billDate < from || b.billDate > to) continue;
    for (const it of b.items ?? []) {
      const row = map.get(it.productName) ?? { productName: it.productName, categoryName: it.categoryName, quantity: 0, amount: 0 };
      row.quantity += it.quantity;
      row.amount = r2(row.amount + it.lineTotal);
      map.set(it.productName, row);
    }
  }
  const rows = [...map.values()].sort((a, b) => b.quantity - a.quantity || b.amount - a.amount);
  return limit ? rows.slice(0, limit) : rows;
}

const listBillRow = ({ items: _items, ...b }: Bill) => b;

// ---------------------------------------------------------------- router

type Handler = (ctx: { db: LocalDb; params: Record<string, string>; query: Record<string, any>; body: any }) => unknown;

const routes: [string, RegExp, Handler][] = [];
const route = (method: string, path: string, h: Handler) =>
  routes.push([method, new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), h]);

route('POST', '/auth/login', ({ body }) => {
  if (String(body.email ?? '').trim().toLowerCase() !== USER.email || body.password !== PASSWORD) {
    throw new ApiError(401, 'Invalid email or password');
  }
  return { token: TOKEN, user: USER };
});
route('GET', '/auth/me', () => ({ user: USER }));
route('POST', '/auth/logout', () => ({ message: 'Logged out' }));

route('GET', '/branding', ({ db }) => ({ appName: db.settings.appName, appTagline: db.settings.appTagline, shopName: db.settings.shopName }));
route('GET', '/settings', ({ db }) => db.settings);
route('PUT', '/settings', ({ db, body }) => {
  if (!body.shopName?.trim()) throw new ApiError(400, 'Shop name is required');
  if (!body.appName?.trim()) throw new ApiError(400, 'App name is required');
  db.settings = { ...db.settings, ...body };
  return db.settings;
});

route('GET', '/categories', ({ db }) =>
  [...db.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ ...c, productCount: db.products.filter((p) => p.categoryId === c.id).length })),
);
route('POST', '/categories', ({ db, body }) => {
  if (!body.name?.trim()) throw new ApiError(400, 'Category name is required');
  if (db.categories.some((c) => c.name.toLowerCase() === body.name.trim().toLowerCase())) throw new ApiError(409, `Category "${body.name}" already exists`);
  const c = { id: db.nextId++, name: body.name.trim(), sortOrder: body.sortOrder ?? 0, isActive: body.isActive ?? true };
  db.categories.push(c);
  return { ...c, productCount: 0 };
});
route('PUT', '/categories/:id', ({ db, params, body }) => {
  const c = db.categories.find((x) => x.id === +params.id);
  if (!c) throw new ApiError(404, 'Category not found');
  Object.assign(c, { name: body.name.trim(), sortOrder: body.sortOrder, isActive: body.isActive });
  return c;
});
route('DELETE', '/categories/:id', ({ db, params }) => {
  const n = db.products.filter((p) => p.categoryId === +params.id).length;
  if (n) throw new ApiError(409, `This category has ${n} product(s). Move or delete them first.`);
  db.categories = db.categories.filter((c) => c.id !== +params.id);
});

route('GET', '/products', ({ db, query }) => {
  const q = String(query.q ?? '').toLowerCase();
  return db.products
    .filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!query.categoryId || p.categoryId === +query.categoryId))
    .filter((p) => !query.active || query.active === 'all' || p.isActive === (query.active === 'true'))
    .map((p) => withCategory(db, p))
    .sort((a, b) => a.categoryId - b.categoryId || a.sortOrder - b.sortOrder);
});
const validateProduct = (db: LocalDb, body: any, id?: number) => {
  if (!body.name?.trim()) throw new ApiError(400, 'Product name is required');
  if (!(body.price >= 0)) throw new ApiError(400, 'Enter a valid price');
  if (!db.categories.some((c) => c.id === body.categoryId)) throw new ApiError(400, 'Selected category does not exist');
  if (db.products.some((p) => p.id !== id && p.name.toLowerCase() === body.name.trim().toLowerCase())) {
    throw new ApiError(409, `A product named "${body.name}" already exists`);
  }
};
route('POST', '/products', ({ db, body }) => {
  validateProduct(db, body);
  const p = { id: db.nextId++, name: body.name.trim(), price: body.price, categoryId: body.categoryId, isActive: body.isActive ?? true, sortOrder: body.sortOrder ?? 0 };
  db.products.push(p);
  return withCategory(db, p);
});
route('PUT', '/products/:id', ({ db, params, body }) => {
  const p = db.products.find((x) => x.id === +params.id);
  if (!p) throw new ApiError(404, 'Product not found');
  validateProduct(db, body, p.id);
  Object.assign(p, { name: body.name.trim(), price: body.price, categoryId: body.categoryId, isActive: body.isActive, sortOrder: body.sortOrder });
  return withCategory(db, p);
});
route('PATCH', '/products/:id/status', ({ db, params, body }) => {
  const p = db.products.find((x) => x.id === +params.id);
  if (!p) throw new ApiError(404, 'Product not found');
  p.isActive = !!body.isActive;
  return withCategory(db, p);
});
route('DELETE', '/products/:id', ({ db, params }) => {
  db.products = db.products.filter((p) => p.id !== +params.id);
});

route('POST', '/bills', ({ db, body }) => createBillIn(db, body));
route('GET', '/bills', ({ db, query }) => {
  const q = String(query.q ?? '').toLowerCase();
  const rows = db.bills
    .filter((b) => !q || [b.billNo, b.customerName ?? '', b.customerPhone ?? ''].some((v) => v.toLowerCase().includes(q)))
    .filter((b) => (!query.from || b.billDate >= query.from) && (!query.to || b.billDate <= query.to))
    .filter((b) => !query.paymentMethod || b.paymentMethod === query.paymentMethod)
    .sort((a, b) => b.id - a.id);
  const page = +query.page || 1;
  const pageSize = +query.pageSize || 20;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize).map(listBillRow),
    page, pageSize, total: rows.length, totalAmount: r2(rows.reduce((a, b) => a + b.grandTotal, 0)),
  };
});
route('GET', '/bills/:id', ({ db, params }) => {
  const b = db.bills.find((x) => x.id === +params.id);
  if (!b) throw new ApiError(404, 'Bill not found');
  return b;
});

route('GET', '/reports/sales', ({ db, query }) => ({
  from: query.from, to: query.to,
  summary: summary(db, query.from, query.to), daily: daily(db, query.from, query.to), items: itemWise(db, query.from, query.to),
}));

route('GET', '/dashboard/summary', ({ db }) => {
  const today = isoDate(new Date());
  const yesterday = summary(db, addDays(today, -1), addDays(today, -1));
  return {
    date: today,
    today: summary(db, today, today),
    yesterday: { totalSales: yesterday.totalSales, billCount: yesterday.billCount },
    products: { total: db.products.length, active: db.products.filter((p) => p.isActive).length },
    dailySales: daily(db, addDays(today, -13), today).map((d) => ({ date: d.date, totalSales: d.totalSales, billCount: d.billCount })),
    topItems: itemWise(db, today, today, 5),
    recentBills: [...db.bills].sort((a, b) => b.id - a.id).slice(0, 8).map(listBillRow),
  };
});

// ---------------------------------------------------------------- adapter

/** Routes that work before signing in. */
const PUBLIC = new Set(['/auth/login', '/auth/logout', '/branding']);

export const localAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = (config.url ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];
  const respond = (status: number, data: unknown): AxiosResponse => ({ data, status, statusText: String(status), headers: {}, config });

  for (const [m, re, handler] of routes) {
    const match = m === method ? path.match(re) : null;
    if (!match) continue;
    const db = load();
    try {
      if (!PUBLIC.has(path) && config.headers.Authorization !== `Bearer ${TOKEN}`) {
        throw new ApiError(401, 'Please sign in again');
      }
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {});
      const data = handler({ db, params: match.groups ?? {}, query: config.params ?? {}, body });
      save(db);
      return respond(method === 'POST' ? 201 : data === undefined ? 204 : 200, data ?? '');
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      const res = respond(status, { message: (err as Error).message });
      throw new AxiosError((err as Error).message, String(status), config, null, res);
    }
  }
  const msg = /pdf|export/.test(path) ? 'PDF download is not available in this app.' : `Not available: ${method} ${path}`;
  throw new AxiosError(msg, '400', config, null, respond(400, { message: msg }));
};

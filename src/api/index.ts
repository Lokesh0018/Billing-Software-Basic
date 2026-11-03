import type {
  Bill,
  Category,
  DashboardData,
  DiscountType,
  Paginated,
  PaymentMethod,
  Product,
  SalesReport,
  ShopSettings,
  User,
} from '../types';
import { api } from './client';
import { saveBlob } from '../lib/download';
import { salesReportCsv, salesReportPdf } from '../lib/reportExport';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  logout: () => api.post('/auth/logout').catch(() => undefined),
};

export const dashboardApi = {
  summary: () => api.get<DashboardData>('/dashboard/summary').then((r) => r.data),
};

export interface CategoryInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (data: CategoryInput) => api.post<Category>('/categories', data).then((r) => r.data),
  update: (id: number, data: CategoryInput) => api.put<Category>(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/categories/${id}`),
};

export interface ProductInput {
  name: string;
  categoryId: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export const productsApi = {
  list: (params: { q?: string; categoryId?: number; active?: 'true' | 'false' | 'all' } = {}) =>
    api.get<Product[]>('/products', { params }).then((r) => r.data),
  create: (data: ProductInput) => api.post<Product>('/products', data).then((r) => r.data),
  update: (id: number, data: ProductInput) => api.put<Product>(`/products/${id}`, data).then((r) => r.data),
  setStatus: (id: number, isActive: boolean) =>
    api.patch<Product>(`/products/${id}/status`, { isActive }).then((r) => r.data),
  remove: (id: number) => api.delete(`/products/${id}`),
};

export interface CreateBillInput {
  items: { productId: number; quantity: number }[];
  discountType: DiscountType;
  discountValue: number;
  paymentMethod: PaymentMethod;
  customerName?: string | null;
  customerPhone?: string | null;
  expectedTotal: number;
}

export interface BillQuery {
  q?: string;
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod;
  page?: number;
  pageSize?: number;
}

export const billsApi = {
  create: (data: CreateBillInput) => api.post<Bill>('/bills', data).then((r) => r.data),
  list: (params: BillQuery) => api.get<Paginated<Bill>>('/bills', { params }).then((r) => r.data),
  get: (id: number) => api.get<Bill>(`/bills/${id}`).then((r) => r.data),
  downloadPdf: async (bill: Pick<Bill, 'id' | 'billNo'>, size: 'a4' | 'thermal' = 'a4') => {
    const res = await api.get<Blob>(`/bills/${bill.id}/pdf`, { params: { size }, responseType: 'blob' });
    await saveBlob(res.data, `${bill.billNo}${size === 'thermal' ? '-80mm' : ''}.pdf`);
  },
};

export const reportsApi = {
  sales: (from: string, to: string) =>
    api.get<SalesReport>('/reports/sales', { params: { from, to } }).then((r) => r.data),
  /** Builds the CSV/PDF in the browser from the same report the page shows. */
  export: async (from: string, to: string, format: 'csv' | 'pdf') => {
    const [report, shop] = await Promise.all([reportsApi.sales(from, to), settingsApi.get()]);
    const blob = format === 'csv' ? salesReportCsv(report, shop) : await salesReportPdf(report, shop);
    await saveBlob(blob, `sales-report_${from}_to_${to}.${format}`);
  },
};

export const settingsApi = {
  get: () => api.get<ShopSettings>('/settings').then((r) => r.data),
  update: (data: ShopSettings) => api.put<ShopSettings>('/settings', data).then((r) => r.data),
};

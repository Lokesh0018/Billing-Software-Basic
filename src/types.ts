export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';
export type DiscountType = 'NONE' | 'FLAT' | 'PERCENT';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin';
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  categoryId: number;
  categoryName: string;
}

export interface ShopSettings {
  appName: string;
  appTagline: string;
  shopName: string;
  address: string;
  phone: string;
  gstin: string | null;
  taxEnabled: boolean;
  taxRate: number;
  taxInclusive: boolean;
  taxLabel: string;
  splitTax: boolean;
  receiptFooter: string;
  currency: string;
  billPrefix: string;
}

export interface BillItem {
  id: number;
  productId: number | null;
  productName: string;
  categoryName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Bill {
  id: number;
  billNo: string;
  billDate: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  itemCount: number;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  taxEnabled: boolean;
  taxInclusive: boolean;
  taxRate: number;
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  status: string;
  createdBy: string | null;
  items?: BillItem[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalAmount: number;
}

export interface SalesSummary {
  totalSales: number;
  billCount: number;
  itemsSold: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  totalDiscount: number;
  totalTax: number;
  averageBill: number;
}

export interface DailyRow extends Omit<SalesSummary, 'averageBill'> {
  date: string;
}

export interface ItemRow {
  productName: string;
  categoryName: string | null;
  quantity: number;
  amount: number;
}

export interface SalesReport {
  from: string;
  to: string;
  summary: SalesSummary;
  daily: DailyRow[];
  items: ItemRow[];
}

export interface DashboardData {
  date: string;
  today: SalesSummary;
  yesterday: { totalSales: number; billCount: number };
  products: { total: number; active: number };
  dailySales: { date: string; totalSales: number; billCount: number }[];
  topItems: ItemRow[];
  recentBills: Bill[];
}


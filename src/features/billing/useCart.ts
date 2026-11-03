import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculateBill } from '../../lib/billing';
import type { DiscountType, PaymentMethod, Product, ShopSettings } from '../../types';

export interface CartLine {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  discountType: DiscountType;
  discountValue: string;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
}

const STORAGE_KEY = 'tiffinflow.cart';
export const MAX_QTY = 999;

const initial: CartState = {
  lines: [],
  discountType: 'NONE',
  discountValue: '',
  paymentMethod: 'CASH',
  customerName: '',
  customerPhone: '',
};

function load(): CartState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...initial, ...JSON.parse(raw) } : initial;
  } catch {
    return initial;
  }
}

/** Cart state, kept in sessionStorage so an accidental page change doesn't lose the order. */
export function useCart(settings: ShopSettings | null) {
  const [state, setState] = useState<CartState>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const add = useCallback((p: Product, qty = 1) => {
    setState((s) => {
      const existing = s.lines.find((l) => l.productId === p.id);
      const lines = existing
        ? s.lines.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
        : [...s.lines, { productId: p.id, name: p.name, unitPrice: p.price, quantity: qty }];
      return { ...s, lines };
    });
  }, []);

  const setQty = useCallback((productId: number, quantity: number) => {
    setState((s) => ({
      ...s,
      lines:
        quantity <= 0
          ? s.lines.filter((l) => l.productId !== productId)
          : s.lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(MAX_QTY, Math.floor(quantity)) } : l)),
    }));
  }, []);

  const remove = useCallback((productId: number) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.productId !== productId) }));
  }, []);

  const update = useCallback(<K extends keyof CartState>(key: K, value: CartState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const clear = useCallback(() => setState({ ...initial, paymentMethod: 'CASH' }), []);

  /** Keep cart prices/names in sync with the latest product list; drop products that disappeared. */
  const syncWithProducts = useCallback((products: Product[]) => {
    const byId = new Map(products.map((p) => [p.id, p]));
    setState((s) => {
      const lines = s.lines
        .filter((l) => byId.has(l.productId))
        .map((l) => {
          const p = byId.get(l.productId)!;
          return { ...l, name: p.name, unitPrice: p.price };
        });
      const changed = lines.length !== s.lines.length || lines.some((l, i) => l.unitPrice !== s.lines[i].unitPrice || l.name !== s.lines[i].name);
      return changed ? { ...s, lines } : s;
    });
  }, []);

  const discountNumber = Number(state.discountValue) || 0;

  const totals = useMemo(
    () =>
      calculateBill({
        lines: state.lines,
        discountType: state.discountType,
        discountValue: state.discountType === 'NONE' ? 0 : discountNumber,
        tax: {
          enabled: !!settings?.taxEnabled,
          rate: settings?.taxRate ?? 0,
          inclusive: settings?.taxInclusive ?? true,
        },
      }),
    [state.lines, state.discountType, discountNumber, settings],
  );

  return { state, totals, discountNumber, add, setQty, remove, update, clear, syncWithProducts };
}

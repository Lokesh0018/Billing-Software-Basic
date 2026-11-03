import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { productsApi, type ProductInput } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { Button, Field, Modal, Toggle } from '../../components/ui';
import type { Category, Product } from '../../types';

interface Props {
  open: boolean;
  product: Product | null; // null = create
  categories: Category[];
  onClose: () => void;
  onSaved: (p: Product) => void;
}

interface FormState {
  name: string;
  categoryId: string;
  price: string;
  isActive: boolean;
  sortOrder: string;
}

const empty = (categories: Category[]): FormState => ({
  name: '',
  categoryId: categories[0] ? String(categories[0].id) : '',
  price: '',
  isActive: true,
  sortOrder: '0',
});

export function ProductFormModal({ open, product, categories, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(empty(categories));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      product
        ? {
            name: product.name,
            categoryId: String(product.categoryId),
            price: String(product.price),
            isActive: product.isActive,
            sortOrder: String(product.sortOrder),
          }
        : empty(categories),
    );
  }, [open, product, categories]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): ProductInput | null => {
    const e: Record<string, string> = {};
    const price = Number(form.price);
    if (!form.name.trim()) e.name = 'Product name is required';
    if (!form.categoryId) e.categoryId = 'Choose a category';
    if (form.price.trim() === '' || !Number.isFinite(price)) e.price = 'Enter a valid price';
    else if (price < 0) e.price = 'Price cannot be negative';
    else if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim())) e.price = 'Use at most 2 decimals';
    setErrors(e);
    if (Object.keys(e).length) return null;
    return {
      name: form.name.trim(),
      categoryId: Number(form.categoryId),
      price,
      isActive: form.isActive,
      sortOrder: Math.max(0, Math.floor(Number(form.sortOrder) || 0)),
    };
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const data = validate();
    if (!data) return;
    setSaving(true);
    try {
      const saved = product ? await productsApi.update(product.id, data) : await productsApi.create(data);
      toast.success(product ? 'Product updated' : 'Product added');
      onSaved(saved);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      toast.error(errorMessage(err, 'Could not save product'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Edit product' : 'Add product'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Product name" error={errors.name} htmlFor="p-name">
          <input id="p-name" className="input" autoFocus maxLength={100} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ghee Roast Dosa" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" error={errors.categoryId} htmlFor="p-cat">
            <select id="p-cat" className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.length === 0 && <option value="">No categories. Add one first.</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price (₹)" error={errors.price} htmlFor="p-price">
            <input
              id="p-price"
              className="input tabular"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display order" hint="Lower numbers show first on the billing screen" htmlFor="p-sort">
            <input id="p-sort" className="input" inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div>
            <span className="label">Status</span>
            <div className="flex h-10 items-center gap-3">
              <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" />
              <span className="text-sm text-slate-600">{form.isActive ? 'Active: shown on billing screen' : 'Inactive: hidden from billing'}</span>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownUp, FolderCog, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { categoriesApi, productsApi } from '../../api';
import { errorMessage } from '../../api/client';
import { Badge, Button, ConfirmDialog, cx, EmptyState, ErrorState, PageHeader, Segmented, Skeleton, Toggle } from '../../components/ui';
import { formatINR } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import type { Category, Product } from '../../types';
import { CategoryManager } from './CategoryManager';
import { ProductFormModal } from './ProductFormModal';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortKey = 'menu' | 'name' | 'price-asc' | 'price-desc';

export function ProductsPage() {
  const products = useAsync(() => productsApi.list(), []);
  const categories = useAsync(categoriesApi.list, []);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const cats: Category[] = categories.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (categoryId === 'all' || p.categoryId === categoryId) &&
        (status === 'all' || (status === 'active') === p.isActive),
    );
  }, [products.data, search, categoryId, status]);

  const replaceProduct = (p: Product) =>
    products.setData((list) => {
      if (!list) return [p];
      return list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p];
    });

  const toggleStatus = async (p: Product) => {
    setToggling(p.id);
    try {
      replaceProduct(await productsApi.setStatus(p.id, !p.isActive));
      toast.success(`${p.name} ${p.isActive ? 'deactivated' : 'activated'}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await productsApi.remove(toDelete.id);
      products.setData((list) => list?.filter((x) => x.id !== toDelete.id) ?? null);
      categories.reload();
      toast.success('Product deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    if (!cats.length) {
      toast.error('Add a category first');
      setCatOpen(true);
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };


  // ---- presentation only: sorting, counts
  const [sort, setSort] = useState<SortKey>('menu');
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'price-asc') list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    return list;
  }, [filtered, sort]);

  const all = products.data ?? [];
  const activeCount = all.filter((p) => p.isActive).length;
  const countFor = (id: number | 'all') => (id === 'all' ? all.length : all.filter((p) => p.categoryId === id).length);

  const rowActions = (p: Product) => (
    <div className="flex justify-end gap-0.5">
      <button
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-900"
        onClick={() => {
          setEditing(p);
          setFormOpen(true);
        }}
        aria-label={`Edit ${p.name}`}
        title="Edit"
      >
        <Pencil className="size-4" />
      </button>
      <button className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`} title="Delete">
        <Trash2 className="size-4" />
      </button>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={
          products.data ? (
            <>
              {activeCount} on the billing screen · {all.length - activeCount} hidden · {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
            </>
          ) : (
            'Menu items, prices and availability'
          )
        }
        actions={
          <>
            <Button variant="secondary" icon={<FolderCog className="size-4" />} onClick={() => setCatOpen(true)}>
              Categories
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={openCreate}>
              Add product
            </Button>
          </>
        }
      />

      {/* Category count cards: the type filter */}
      <div className="scroll-thin -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:overflow-visible">
        {[{ id: 'all' as const, name: 'All products' }, ...cats.map((c) => ({ id: c.id, name: c.name }))].map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              aria-pressed={active}
              className={cx(
                'flex h-[62px] min-w-32 shrink-0 flex-col justify-center rounded-[22px] border px-3.5 text-left transition-colors',
                active ? 'border-brand-900 bg-brand-50 shadow-[inset_0_0_0_0.5px_var(--color-brand-900)]' : 'border-line bg-white hover:border-slate-300',
              )}
            >
              <span className="truncate text-[13px] text-slate-600">{c.name}</span>
              <span className="tabular text-base font-semibold text-brand-900">{products.data ? countFor(c.id) : '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <input className="input h-9 pl-9" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={status}
              onChange={setStatus}
              ariaLabel="Status"
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Hidden' },
              ]}
            />
            <label className="flex items-center gap-2 text-[13px] text-slate-600">
              <ArrowDownUp className="size-3.5" />
              <select className="input h-9 w-auto py-0 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort products">
                <option value="menu">Menu order</option>
                <option value="name">Name A–Z</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
          </div>
        </div>

        {products.loading && !products.data ? (
          <div className="divide-y divide-rule" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-14 items-center gap-6 px-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="hidden h-4 w-24 md:block" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : products.error ? (
          <div className="p-4">
            <ErrorState message={products.error} onRetry={products.reload} />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={all.length ? 'No products match these filters' : 'No products yet'}
            hint={all.length ? 'Try another search, category or status.' : 'Add your first dish to start billing.'}
            action={
              !all.length && (
                <Button size="sm" icon={<Plus className="size-4" />} onClick={openCreate}>
                  Add product
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Phones: two-line rows */}
            <ul className="divide-y divide-rule md:hidden">
              {sorted.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={cx('truncate font-medium', p.isActive ? 'text-brand-900' : 'text-slate-500')}>{p.name}</p>
                    <p className="text-[13px] text-slate-600">
                      <span className="tabular font-semibold text-brand-900">{formatINR(p.price)}</span> · {p.categoryName}
                      {!p.isActive && ' · Hidden'}
                    </p>
                  </div>
                  <Toggle checked={p.isActive} onChange={() => toggling !== p.id && toggleStatus(p)} label={`${p.name} on the billing screen`} />
                  {rowActions(p)}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-[40%] pl-5">Product</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    <th>On billing screen</th>
                    <th className="pr-5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id}>
                      <td className={cx('pl-5 font-medium', p.isActive ? 'text-brand-900' : 'text-slate-500')}>{p.name}</td>
                      <td className="text-slate-600">{p.categoryName}</td>
                      <td className="num font-semibold text-brand-900">{formatINR(p.price)}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Toggle checked={p.isActive} onChange={() => toggling !== p.id && toggleStatus(p)} label={`${p.name} on the billing screen`} />
                          <Badge color={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Hidden'}</Badge>
                        </div>
                      </td>
                      <td className="pr-4">{rowActions(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {sorted.length > 0 && (
          <p className="tabular border-t border-line px-5 py-3 text-xs text-slate-600">
            Showing {sorted.length} of {all.length} products
          </p>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        product={editing}
        categories={cats}
        onClose={() => setFormOpen(false)}
        onSaved={(p) => {
          replaceProduct(p);
          categories.reload();
          setFormOpen(false);
        }}
      />
      <CategoryManager
        open={catOpen}
        categories={cats}
        onClose={() => setCatOpen(false)}
        onChanged={() => {
          categories.reload();
          products.reload();
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete product"
        danger
        confirmLabel="Delete"
        loading={deleting}
        message={
          <>
            Delete <b className="font-semibold text-brand-900">{toDelete?.name}</b>? Past bills keep their original item names and prices. To just hide it from billing, switch it off instead.
          </>
        }
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

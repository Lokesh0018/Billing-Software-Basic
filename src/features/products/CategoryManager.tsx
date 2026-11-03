import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { categoriesApi } from '../../api';
import { errorMessage } from '../../api/client';
import { Badge, Button, ConfirmDialog, Modal, Toggle } from '../../components/ui';
import type { Category } from '../../types';

interface Props {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}

export function CategoryManager({ open, categories, onClose, onChanged }: Props) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      onChanged();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const sortOrder = Math.max(0, ...categories.map((c) => c.sortOrder)) + 1;
    if (await run(() => categoriesApi.create({ name, sortOrder, isActive: true }), 'Category added')) setNewName('');
  };

  const saveEdit = async (c: Category) => {
    if (!editing?.name.trim()) return;
    if (await run(() => categoriesApi.update(c.id, { name: editing.name.trim(), sortOrder: c.sortOrder, isActive: c.isActive }), 'Category renamed'))
      setEditing(null);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Manage categories" size="md">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input className="input" placeholder="New category name" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" icon={<Plus className="size-4" />} disabled={!newName.trim()} loading={busy && !editing}>
            Add
          </Button>
        </form>

        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              {editing?.id === c.id ? (
                <>
                  <input
                    className="input h-9"
                    autoFocus
                    maxLength={60}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(c);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <button className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" onClick={() => saveEdit(c)} aria-label="Save">
                    <Check className="size-4" />
                  </button>
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setEditing(null)} aria-label="Cancel">
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.productCount} product(s)</p>
                  </div>
                  {!c.isActive && <Badge>Hidden</Badge>}
                  <Toggle
                    checked={c.isActive}
                    label={`${c.name} visible on billing`}
                    onChange={(v) => run(() => categoriesApi.update(c.id, { name: c.name, sortOrder: c.sortOrder, isActive: v }), v ? 'Category shown' : 'Category hidden')}
                  />
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`Rename ${c.name}`}>
                    <Pencil className="size-4" />
                  </button>
                  <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </li>
          ))}
          {categories.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No categories yet.</li>}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Hidden categories don't appear on the New Bill screen. A category can only be deleted when it has no products.</p>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete category"
        danger
        confirmLabel="Delete"
        loading={busy}
        message={
          <>
            Delete category <b>{toDelete?.name}</b>?
          </>
        }
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await run(() => categoriesApi.remove(toDelete.id), 'Category deleted'))) setToDelete(null);
        }}
      />
    </>
  );
}

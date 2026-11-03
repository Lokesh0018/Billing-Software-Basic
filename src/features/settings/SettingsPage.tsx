import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Percent, ReceiptText, Save, Store, Type } from 'lucide-react';
import { settingsApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { Button, ErrorState, Field, LoadingBlock, PageHeader, Toggle, cx } from '../../components/ui';
import { useBranding } from '../../context/BrandingContext';
import { useShopSettings } from '../../context/SettingsContext';
import { formatINR, pct } from '../../lib/format';
import { calculateBill } from '../../lib/billing';
import type { ShopSettings } from '../../types';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_RATES = [5, 12, 18];

/** One settings row: what it is on the left, its fields on a pale panel on the right. */
export function Section({ icon, title, description, children }: { icon?: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-8 first:pt-2 last:border-0 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
      <div className="lg:pt-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-900">
          {icon && <span className="text-slate-500 [&>svg]:size-[18px]">{icon}</span>}
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      <div className="space-y-4 rounded-[28px] bg-white p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { settings, refresh, setSettings } = useShopSettings();
  const { setBranding } = useBranding();
  const [form, setForm] = useState<ShopSettings | null>(settings);
  const [taxRateText, setTaxRateText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setTaxRateText(String(settings.taxRate));
    }
  }, [settings]);

  if (!settings && !form) return <LoadingBlock label="Loading settings…" />;
  if (!form) return <ErrorState message="Settings could not be loaded" onRetry={refresh} />;

  const set = <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(settings) || taxRateText !== String(settings?.taxRate);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.appName.trim()) e.appName = 'App name is required';
    if (!form.shopName.trim()) e.shopName = 'Shop name is required';
    if (form.gstin && !GSTIN_REGEX.test(form.gstin)) e.gstin = 'Enter a valid 15-character GSTIN';
    const rate = Number(taxRateText);
    if (!Number.isFinite(rate) || rate < 0 || rate > 28) e.taxRate = 'Tax rate must be between 0 and 28';
    else if (!/^\d+(\.\d{1,2})?$/.test(taxRateText)) e.taxRate = 'Use at most 2 decimals';
    else if (form.taxEnabled && rate <= 0) e.taxRate = 'Enter a tax rate above 0%';
    if (!/^[A-Z0-9]{1,6}$/.test(form.billPrefix)) e.billPrefix = '1–6 letters or digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await settingsApi.update({ ...form, taxRate: Number(taxRateText), gstin: form.gstin || null });
      setSettings(saved);
      setBranding({ appName: saved.appName, appTagline: saved.appTagline, shopName: saved.shopName });
      toast.success('Settings saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  // Worked example so the owner can see exactly what the tax setting does.
  const exampleRate = Number(taxRateText) || 0;
  const example = calculateBill({
    lines: [{ unitPrice: 100, quantity: 1 }],
    discountType: 'NONE',
    discountValue: 0,
    tax: { enabled: form.taxEnabled, rate: exampleRate, inclusive: form.taxInclusive },
  });

  return (
    <>
      <PageHeader title="Settings" subtitle="Shop details, tax and receipt preferences" />

      <form onSubmit={onSubmit} noValidate>
        <Section icon={<Type className="size-5" />} title="App name" description="Shown in the sidebar, login page, window title and phone home-screen icon.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="App name" error={errors.appName} htmlFor="s-appname">
              <input id="s-appname" className="input" maxLength={40} value={form.appName} onChange={(e) => set('appName', e.target.value)} placeholder="TiffinFlow" />
            </Field>
            <Field label="Subtitle" error={errors.appTagline} hint="Optional, e.g. Billing, POS" htmlFor="s-tagline">
              <input id="s-tagline" className="input" maxLength={40} value={form.appTagline} onChange={(e) => set('appTagline', e.target.value)} placeholder="Billing" />
            </Field>
          </div>
          <div>
            <span className="label">Preview</span>
            <div className="flex items-center gap-2.5 rounded-lg bg-brand-950 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
                  <ellipse cx="16" cy="18" rx="11" ry="6.5" fill="#fff" />
                  <ellipse cx="16" cy="16" rx="7.5" ry="3.5" fill="#bfd3fe" />
                </svg>
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-base font-bold text-white">{form.appName || 'TiffinFlow'}</p>
                {form.appTagline && <p className="truncate text-[11px] font-medium text-brand-200">{form.appTagline}</p>}
              </div>
            </div>
          </div>
        </Section>

        <Section icon={<Store className="size-5" />} title="Shop details" description="Printed at the top of every receipt.">
          <Field label="Shop name" error={errors.shopName} htmlFor="s-name">
            <input id="s-name" className="input" maxLength={120} value={form.shopName} onChange={(e) => set('shopName', e.target.value)} />
          </Field>
          <Field label="Address" error={errors.address} htmlFor="s-address">
            <textarea id="s-address" className="input min-h-20" maxLength={255} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact number" error={errors.phone} htmlFor="s-phone">
              <input id="s-phone" className="input" maxLength={30} inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Currency" hint="Indian Rupee is used for all bills" htmlFor="s-cur">
              <input id="s-cur" className="input" value="INR (₹)" disabled />
            </Field>
          </div>
        </Section>

        <Section
          icon={<Percent className="size-5" />}
          title="Tax / GST"
          description="Turn on only if your shop is GST registered. Old bills keep the tax they were created with."
        >
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Charge GST on bills</p>
              <p className="text-xs text-slate-500">{form.taxEnabled ? 'Tax is calculated on every new bill' : 'No tax is applied to bills'}</p>
            </div>
            <Toggle checked={form.taxEnabled} onChange={(v) => set('taxEnabled', v)} label="Charge GST" />
          </div>

          <div className={cx('space-y-4', !form.taxEnabled && 'pointer-events-none opacity-50')} aria-disabled={!form.taxEnabled}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GSTIN" error={errors.gstin} hint="Optional. Shown on receipts; makes the receipt a Tax Invoice." htmlFor="s-gstin">
                <input
                  id="s-gstin"
                  className="input uppercase"
                  maxLength={15}
                  placeholder="e.g. 36ABCDE1234F1Z5"
                  value={form.gstin ?? ''}
                  onChange={(e) => set('gstin', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || null)}
                />
              </Field>
              <Field label="GST rate (%)" error={errors.taxRate} htmlFor="s-rate">
                <div className="flex gap-2">
                  <input id="s-rate" className="input tabular" inputMode="decimal" value={taxRateText} onChange={(e) => setTaxRateText(e.target.value.replace(/[^\d.]/g, ''))} />
                  {GST_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTaxRateText(String(r))}
                      className={cx('rounded-lg border px-3 text-sm font-medium', Number(taxRateText) === r ? 'border-brand-900 bg-brand-50 text-brand-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50')}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div>
              <span className="label">Menu prices are</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { v: true, t: 'Inclusive of GST', d: 'Customer pays the menu price; GST is included in it.' },
                  { v: false, t: 'Exclusive of GST', d: 'GST is added on top of the menu price.' },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => set('taxInclusive', o.v)}
                    className={cx('rounded-lg border p-3 text-left', form.taxInclusive === o.v ? 'border-brand-900 bg-brand-50 ring-1 ring-brand-900' : 'border-slate-300 hover:bg-slate-50')}
                  >
                    <p className="text-sm font-semibold text-slate-900">{o.t}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{o.d}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Show CGST + SGST separately</p>
                <p className="text-xs text-slate-500">Splits the tax into two equal halves on receipts</p>
              </div>
              <Toggle checked={form.splitTax} onChange={(v) => set('splitTax', v)} label="Split tax" />
            </div>

            {form.taxEnabled && exampleRate > 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                Example: an item priced <b>₹100</b> → customer pays <b>{formatINR(example.grandTotal)}</b>, of which GST @ {pct(exampleRate)} is{' '}
                <b>{formatINR(example.taxAmount)}</b>.
              </p>
            )}
          </div>
        </Section>

        <Section icon={<ReceiptText className="size-5" />} title="Receipt" description="Footer text and bill numbering.">
          <Field label="Receipt footer message" error={errors.receiptFooter} htmlFor="s-footer">
            <input id="s-footer" className="input" maxLength={255} value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} placeholder="Thank you! Visit again." />
          </Field>
          <Field label="Bill number prefix" error={errors.billPrefix} hint={`Bills will be numbered like ${form.billPrefix || 'TF'}-YYYYMMDD-0001`} htmlFor="s-prefix">
            <input id="s-prefix" className="input w-40 uppercase" maxLength={6} value={form.billPrefix} onChange={(e) => set('billPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </Field>
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-4 py-3 sm:mx-0 sm:rounded-[22px] sm:border sm:shadow-[0_8px_24px_-12px_rgba(12,21,41,0.25)]">
          <p className={cx('mr-auto text-sm', dirty ? 'font-medium text-saffron-700' : 'text-slate-500')}>{dirty ? 'You have unsaved changes' : 'All changes saved'}</p>
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(settings);
              setTaxRateText(String(settings?.taxRate ?? ''));
              setErrors({});
            }}
          >
            Discard changes
          </Button>
          <Button type="submit" icon={<Save className="size-4" />} loading={saving} disabled={!dirty}>
            Save settings
          </Button>
        </div>
      </form>

    </>
  );
}

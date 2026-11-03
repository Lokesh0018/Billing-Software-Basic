import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Download, FileText, Plus, Printer } from 'lucide-react';
import { billsApi } from '../../api';
import { errorMessage } from '../../api/client';
import { Button, Modal, Segmented } from '../../components/ui';
import { useShopSettings } from '../../context/SettingsContext';
import { formatINR } from '../../lib/format';
import { can, isNative } from '../../lib/platform';
import { readPaperPreference, receiptHtml, savePaperPreference, type PaperSize } from '../../lib/receipt';
import type { Bill } from '../../types';
import { PaymentSuccess } from './PaymentSuccess';

interface Props {
  bill: Bill | null;
  onClose: () => void;
  /** Shown after a fresh sale: success banner + "Create New Bill" button. */
  justCreated?: boolean;
  onNewBill?: () => void;
}

export function ReceiptModal({ bill, onClose, justCreated, onNewBill }: Props) {
  const { settings } = useShopSettings();
  const [paper, setPaperState] = useState<PaperSize>(readPaperPreference);
  const [downloading, setDownloading] = useState<'a4' | 'thermal' | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const setPaper = (p: PaperSize) => {
    setPaperState(p);
    savePaperPreference(p);
  };

  const download = async (size: 'a4' | 'thermal') => {
    if (!bill) return;
    setDownloading(size);
    try {
      await billsApi.downloadPdf(bill, size);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download PDF'));
    } finally {
      setDownloading(null);
    }
  };

  if (!bill) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={justCreated ? 'Bill saved' : `Bill ${bill.billNo}`}
      footer={
        <>
          {can.pdf() && (
            <>
              <Button variant="secondary" icon={<Download className="size-4" />} loading={downloading === 'a4'} onClick={() => download('a4')}>
                {isNative ? 'Share PDF' : 'Download PDF'}
              </Button>
              <Button variant="secondary" icon={<FileText className="size-4" />} loading={downloading === 'thermal'} onClick={() => download('thermal')}>
                80mm PDF
              </Button>
            </>
          )}
          <Button icon={<Printer className="size-4" />} onClick={() => setCelebrating(true)}>
            Print Receipt
          </Button>
          {justCreated && onNewBill && (
            <Button variant="success" icon={<Plus className="size-4" />} onClick={onNewBill}>
              New bill
            </Button>
          )}
        </>
      }
    >
      {justCreated && (
        <div className="rise-in mb-5 flex items-center gap-4 rounded-[22px] bg-emerald-50 px-4 py-3.5 ring-1 ring-emerald-200 ring-inset">
          <CheckCircle2 className="size-7 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-emerald-900">Bill {bill.billNo} saved</p>
            <p className="text-emerald-800">Received by {bill.paymentMethod === 'CASH' ? 'cash' : bill.paymentMethod === 'UPI' ? 'UPI' : 'card'}</p>
          </div>
          <p className="tabular text-2xl font-semibold tracking-[-0.01em] text-emerald-900">{formatINR(bill.grandTotal)}</p>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-brand-900">Receipt preview</span>
        <Segmented
          size="sm"
          ariaLabel="Paper size"
          value={paper}
          onChange={setPaper}
          options={[
            { value: '80mm', label: '80 mm' },
            { value: '58mm', label: '58 mm' },
            { value: 'a4', label: 'A4' },
          ]}
        />
      </div>

      <div className="flex justify-center rounded-[22px] bg-frame p-4 ring-1 ring-rule">
        {settings ? (
          <iframe
            title="Receipt preview"
            srcDoc={receiptHtml(bill, settings, paper)}
            className="h-[58vh] bg-white shadow-[0_12px_32px_-16px_rgba(12,21,41,0.4)]"
            style={{ width: paper === 'a4' ? '100%' : paper === '58mm' ? '240px' : '320px' }}
          />
        ) : (
          <p className="py-10 text-sm text-slate-600">Loading shop details…</p>
        )}
      </div>
      <PaymentSuccess bill={celebrating ? bill : null} onClose={() => setCelebrating(false)} />
    </Modal>
  );
}

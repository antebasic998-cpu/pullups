import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { invalidate } from '../lib/store';
import { UploadIcon } from './Icons';
import type { UserSummary } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  user: UserSummary;
  onImported?: () => void;
}

const TEMPLATE = `date,reps,weight
${isoDaysAgo(14)},10,${72}
${isoDaysAgo(7)},12,${72}
${isoDaysAgo(2)},13,${71.5}`;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Bulk-load a history: pasted spreadsheet rows or a .csv file. */
export function ImportModal({ open, onClose, user, onImported }: Props) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setCsv('');
    setErrors([]);
    setFileName(null);
    setBusy(false);
  }, [open]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setErrors([]);
  }

  async function submit() {
    if (!csv.trim()) {
      setErrors(['Paste some rows or choose a CSV file first.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const res = await api.importCsv(user.id, csv);
      invalidate();
      setErrors(res.errors ?? []);
      if (res.imported > 0) {
        toast.success(`Imported ${res.imported} result${res.imported === 1 ? '' : 's'} for ${user.name}.`);
        onImported?.();
        if ((res.errors ?? []).length === 0) onClose();
      } else {
        toast.error('Nothing could be imported — check the column layout.');
      }
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : 'Import failed.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Import history — ${user.name}`}
      subtitle="One row per attempt. Headers are optional and any column order works."
      width={600}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCsv(TEMPLATE)}
            title="Fill the box with a ready-to-edit example"
          >
            Use example
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Importing…' : 'Import results'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <UploadIcon size={15} />
            Choose CSV file
          </button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {fileName ?? '…or paste rows from Excel / Google Sheets below'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="imp-csv">
            Rows
          </label>
          <textarea
            id="imp-csv"
            className="textarea"
            value={csv}
            spellCheck={false}
            placeholder={TEMPLATE}
            onChange={(e) => setCsv(e.target.value)}
          />
        </div>

        <p className="m-0 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          Accepted columns: <code>date</code> (any of <code>YYYY-MM-DD</code>, <code>02.05.2026</code>,{' '}
          <code>2/5/2026</code>), <code>reps</code> / <code>pullups</code>, and optionally{' '}
          <code>weight</code> in kg. Columns may be in any order; missing weights fall back to the athlete's current
          bodyweight, missing dates to today.
        </p>

        {errors.length > 0 ? (
          <div
            className="rounded-xl border px-4 py-3 text-xs"
            style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            <strong>{errors.length} row{errors.length === 1 ? '' : 's'} skipped</strong>
            <ul className="mt-1.5 mb-0 list-disc pl-4 leading-relaxed">
              {errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 8 ? <li>…and {errors.length - 8} more</li> : null}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

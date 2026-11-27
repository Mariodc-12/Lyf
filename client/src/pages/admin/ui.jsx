import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';

export const when = (v) =>
  v ? new Date(v).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '–';
export const day = (v) =>
  v ? new Date(v).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }) : '–';

const TONES = {
  good: 'bg-leaf-tint text-leaf-deep',
  warn: 'bg-gold-tint text-gold-deep',
  bad: 'bg-hibiscus-tint text-hibiscus-deep',
  plain: 'bg-ink/10 text-ink',
};
export const Badge = ({ tone = 'plain', children }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
);

export const STATUS_TONE = {
  requested: 'warn', confirmed: 'plain', deposit_paid: 'good', completed: 'good', declined: 'bad', cancelled: 'bad',
  success: 'good', pending: 'warn', failed: 'bad', sent: 'good', logged: 'plain', active: 'good', suspended: 'bad',
};

export function Panel({ title, action, children }) {
  return (
    <section className="card p-5">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-ink/60">
            {head.map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-ink/60">{empty}</p>}
    </div>
  );
}

export const Td = ({ children, className = '' }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;

// Two-step button so a stray click can't suspend a user or delete a review.
export function ConfirmButton({ label, confirmLabel = 'Yes, do it', onConfirm, danger }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ask) {
    return (
      <button onClick={() => setAsk(true)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${danger ? 'bg-hibiscus-tint text-hibiscus-deep' : 'bg-ink/10 text-ink'}`}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await onConfirm(); } finally { setBusy(false); setAsk(false); }
        }}
        className="rounded-full bg-hibiscus px-3 py-1.5 text-sm font-semibold text-white"
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button onClick={() => setAsk(false)} className="rounded-full bg-ink/10 px-3 py-1.5 text-sm font-semibold">Cancel</button>
    </span>
  );
}

export const SmallButton = ({ children, ...p }) => (
  <button {...p} className="rounded-full bg-ink/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">{children}</button>
);

export function Pager({ page, setPage, total, size }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-ink/70">
      <span>{total} {total === 1 ? 'result' : 'results'}</span>
      <span className="flex items-center gap-2">
        <SmallButton disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</SmallButton>
        <span>Page {page + 1} of {pages}</span>
        <SmallButton disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</SmallButton>
      </span>
    </div>
  );
}

export function ErrorNote({ error }) {
  return error ? <p role="alert" className="rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">{error}</p> : null;
}

// Loads a list from the admin API and reloads when filters change.
export function useAdminList(path, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  const load = useCallback(() => {
    api(`${path}${qs ? `?${qs}` : ''}`).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [path, qs]);
  useEffect(load, [load]);
  return { data, error, reload: load, setError };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const SearchBox = ({ value, onChange, placeholder }) => (
  <input
    type="search"
    aria-label={placeholder}
    className="field !max-w-xs !py-2.5"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
);

export const Select = ({ label, value, onChange, options }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="field !w-auto !py-2.5">
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);

import { useState } from 'react';
import { api, getToken, naira } from '../../api.js';
import { Badge, ErrorNote, Pager, Select, SmallButton, STATUS_TONE, Table, Td, useAdminList, when } from './ui.jsx';

export default function Payments() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [err, setErr] = useState('');
  const { data, error } = useAdminList('/admin/transactions', { status, page });

  // The CSV needs the sign-in token, so it is fetched here and saved as a file instead of opened as a link.
  async function download() {
    setErr('');
    try {
      const res = await fetch('/api/admin/transactions.csv', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Could not export payments. Try again.');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: 'lyf-payments.csv' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[['', 'All payments'], ['success', 'Successful'], ['pending', 'Pending (not paid)']]} />
        <SmallButton onClick={download}>Download CSV</SmallButton>
      </div>
      <ErrorNote error={error || err} />
      <Table head={['Date', 'Amount', 'Status', 'Planner', 'Vendor', 'Event', 'Points', 'Reference']} empty={data && data.rows.length === 0 ? 'No payments yet.' : null}>
        {data?.rows.map((t) => (
          <tr key={t.id}>
            <Td className="whitespace-nowrap">{when(t.created_at)}</Td>
            <Td className="whitespace-nowrap font-semibold">{naira(t.amount)}</Td>
            <Td><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></Td>
            <Td><p>{t.planner_name || 'No name'}</p><p className="text-ink/55">{t.planner_email}</p></Td>
            <Td>{t.business_name || '–'}</Td>
            <Td>{t.event_title || '–'}</Td>
            <Td>{t.points_earned}</Td>
            <Td className="max-w-[11rem] break-all font-mono text-xs text-ink/60">{t.reference}</Td>
          </tr>
        ))}
      </Table>
      {data && <Pager page={page} setPage={setPage} total={data.total} size={data.page_size} />}
    </div>
  );
}

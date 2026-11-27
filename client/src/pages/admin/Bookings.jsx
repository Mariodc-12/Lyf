import { useEffect, useState } from 'react';
import { naira } from '../../api.js';
import { Badge, ErrorNote, Pager, SearchBox, Select, STATUS_TONE, Table, Td, day, useAdminList, useDebounced, when } from './ui.jsx';

export default function Bookings() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const dq = useDebounced(q);
  useEffect(() => setPage(0), [dq, status]);
  const { data, error } = useAdminList('/admin/bookings', { q: dq, status, page });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search event, vendor or planner" />
        <Select label="Status" value={status} onChange={setStatus} options={[
          ['', 'Any status'], ['requested', 'Requested'], ['confirmed', 'Accepted'], ['deposit_paid', 'Deposit paid'],
          ['completed', 'Completed'], ['declined', 'Declined'], ['cancelled', 'Cancelled'],
        ]} />
      </div>
      <ErrorNote error={error} />
      <Table head={['Event', 'Planner', 'Vendor', 'Total', 'Deposit', 'Status', 'Requested']} empty={data && data.rows.length === 0 ? 'No bookings match.' : null}>
        {data?.rows.map((b) => (
          <tr key={b.id}>
            <Td><p className="font-semibold">{b.event_title}</p><p className="text-ink/55">{b.event_date ? day(b.event_date) : 'Date not set'}</p></Td>
            <Td><p>{b.planner_name || 'No name'}</p><p className="text-ink/55">{b.planner_email || b.planner_phone}</p></Td>
            <Td>{b.business_name}</Td>
            <Td className="whitespace-nowrap">{naira(b.total_amount)}</Td>
            <Td className="whitespace-nowrap">{naira(b.deposit_amount)}</Td>
            <Td><Badge tone={STATUS_TONE[b.status]}>{b.status.replace('_', ' ')}</Badge></Td>
            <Td className="whitespace-nowrap">{when(b.created_at)}</Td>
          </tr>
        ))}
      </Table>
      {data && <Pager page={page} setPage={setPage} total={data.total} size={data.page_size} />}
    </div>
  );
}

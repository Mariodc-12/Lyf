import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, naira } from '../../api.js';
import { catLabel } from '../../lib/ui.js';
import { Badge, ErrorNote, Pager, SearchBox, Select, SmallButton, Table, Td, useAdminList, useDebounced } from './ui.jsx';

export default function Vendors() {
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(sp.get('filter') || '');
  const [page, setPage] = useState(0);
  const dq = useDebounced(q);
  useEffect(() => setPage(0), [dq, filter]);
  const { data, error, reload, setError } = useAdminList('/admin/vendors', { q: dq, filter, page });

  async function flag(id, what, value) {
    try {
      await api(`/admin/vendors/${id}/${what}`, { method: 'POST', body: { value } });
      reload();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search business or owner" />
        <Select label="Filter" value={filter} onChange={setFilter} options={[['', 'All vendors'], ['unverified', 'Waiting to be verified'], ['hidden', 'Hidden from planners']]} />
      </div>
      <ErrorNote error={error} />
      <Table head={['Business', 'Owner', 'From', 'Rating', 'Work', 'Bookings', 'State', '']} empty={data && data.rows.length === 0 ? 'No vendors match.' : null}>
        {data?.rows.map((v) => (
          <tr key={v.id}>
            <Td><p className="font-semibold">{v.business_name}</p><p className="text-ink/55">{catLabel(v.category)} in {v.city}</p></Td>
            <Td>{v.owner_user_id ? <><p>{v.owner_name || 'No name'}</p><p className="text-ink/55">{v.owner_email || v.owner_phone}</p></> : <span className="text-ink/45">Sample vendor</span>}</Td>
            <Td className="whitespace-nowrap">{naira(v.price_from)}</Td>
            <Td className="whitespace-nowrap">{v.review_count > 0 || Number(v.rating) > 0 ? `${Number(v.rating).toFixed(1)} (${v.review_count})` : 'New'}</Td>
            <Td>{v.media_count}</Td>
            <Td>{v.bookings}</Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <Badge tone={v.verified ? 'good' : 'warn'}>{v.verified ? 'Verified' : 'Not verified'}</Badge>
                {!v.active && <Badge tone="bad">Hidden</Badge>}
              </div>
            </Td>
            <Td>
              <div className="flex flex-wrap justify-end gap-1.5">
                <SmallButton onClick={() => flag(v.id, 'verified', !v.verified)}>{v.verified ? 'Remove badge' : 'Verify'}</SmallButton>
                <SmallButton onClick={() => flag(v.id, 'active', !v.active)}>{v.active ? 'Hide' : 'Show'}</SmallButton>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      {data && <Pager page={page} setPage={setPage} total={data.total} size={data.page_size} />}
    </div>
  );
}

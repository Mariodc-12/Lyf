import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Badge, ConfirmButton, ErrorNote, Pager, SearchBox, Select, STATUS_TONE, Table, Td, day, useAdminList, useDebounced, when } from './ui.jsx';

export default function Users() {
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState(sp.get('status') || '');
  const [page, setPage] = useState(0);
  const dq = useDebounced(q);
  useEffect(() => setPage(0), [dq, role, status]);
  const { data, error, reload, setError } = useAdminList('/admin/users', { q: dq, role, status, page });

  const setUserStatus = (id, next) => async () => {
    try {
      await api(`/admin/users/${id}/status`, { method: 'POST', body: { status: next } });
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, email or phone" />
        <Select label="Role" value={role} onChange={setRole} options={[['', 'All roles'], ['planner', 'Planners'], ['vendor', 'Vendors'], ['admin', 'Admins']]} />
        <Select label="Status" value={status} onChange={setStatus} options={[['', 'Any status'], ['suspended', 'Suspended only']]} />
      </div>
      <ErrorNote error={error} />
      <Table head={['User', 'Contact', 'Role', 'Joined', 'Last sign-in', 'Status', '']} empty={data && data.rows.length === 0 ? 'No users match.' : null}>
        {data?.rows.map((u) => (
          <tr key={u.id}>
            <Td><p className="font-semibold">{u.name || 'No name'}</p><p className="text-ink/55">{u.events} {u.events === 1 ? 'event' : 'events'}</p></Td>
            <Td><p>{u.email || <span className="text-ink/45">No email</span>}</p><p className="text-ink/55">{u.phone}</p></Td>
            <Td><Badge tone={u.role === 'admin' ? 'warn' : 'plain'}>{u.role}</Badge></Td>
            <Td className="whitespace-nowrap">{day(u.created_at)}</Td>
            <Td className="whitespace-nowrap">{when(u.last_login_at)}</Td>
            <Td><Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge></Td>
            <Td className="text-right">
              {u.role !== 'admin' && (u.status === 'active'
                ? <ConfirmButton danger label="Suspend" confirmLabel="Yes, suspend" onConfirm={setUserStatus(u.id, 'suspended')} />
                : <ConfirmButton label="Reactivate" confirmLabel="Yes, reactivate" onConfirm={setUserStatus(u.id, 'active')} />)}
            </Td>
          </tr>
        ))}
      </Table>
      {data && <Pager page={page} setPage={setPage} total={data.total} size={data.page_size} />}
    </div>
  );
}

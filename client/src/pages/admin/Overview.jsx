import { Link } from 'react-router-dom';
import { naira } from '../../api.js';
import { Badge, ErrorNote, Panel, STATUS_TONE, useAdminList, when } from './ui.jsx';

const Tile = ({ label, value, sub, to }) => {
  const body = (
    <div className="h-full card p-5">
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-sm text-ink/60">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
};

const KIND = { signup: 'New user', booking: 'Booking', payment: 'Payment', review: 'Review', admin: 'Admin' };
const KIND_TONE = { signup: 'plain', booking: 'warn', payment: 'good', review: 'plain', admin: 'bad' };

function Signups({ data }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div>
      <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`New users per day, last 14 days. Total ${data.reduce((s, d) => s + d.n, 0)}.`}>
        {data.map((d) => (
          <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.n}`}>
            <span className="mb-1 text-center text-xs text-ink/60">{d.n || ''}</span>
            <div className="rounded-t-md bg-ink" style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / max) * 100)}%`, opacity: d.n ? 1 : 0.15 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink/55">
        <span>{data[0].day.slice(5)}</span>
        <span>{data[data.length - 1].day.slice(5)}</span>
      </div>
    </div>
  );
}

export default function Overview() {
  const stats = useAdminList('/admin/stats', {});
  const activity = useAdminList('/admin/activity', {});
  const emails = useAdminList('/admin/emails', {});

  if (stats.error) return <ErrorNote error={stats.error} />;
  const s = stats.data;
  if (!s) return <div className="h-64 animate-pulse rounded-2xl bg-ink/10" aria-busy="true" />;
  const order = ['requested', 'confirmed', 'deposit_paid', 'completed', 'declined', 'cancelled'];

  return (
    <div className="space-y-6">
      {(s.unverified_vendors > 0 || s.failed_emails_7d > 0) && (
        <div className="space-y-2">
          {s.unverified_vendors > 0 && (
            <Link to="/admin/vendors?filter=unverified" className="block rounded-2xl bg-gold-tint px-4 py-3 text-sm font-medium text-gold-deep">
              {s.unverified_vendors} {s.unverified_vendors === 1 ? 'vendor is' : 'vendors are'} waiting to be verified. Review them.
            </Link>
          )}
          {s.failed_emails_7d > 0 && (
            <p className="rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">
              {s.failed_emails_7d} {s.failed_emails_7d === 1 ? 'email' : 'emails'} failed to send in the last 7 days. See the email log below.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Planners" value={s.planners} sub={`${s.new_users_7d} sign-ups this week`} to="/admin/users" />
        <Tile label="Vendors" value={s.live_vendors} sub={`${s.vendor_accounts} vendor accounts`} to="/admin/vendors" />
        <Tile label="Events" value={s.events} />
        <Tile label="Bookings" value={s.bookings} to="/admin/bookings" />
        <Tile label="Deposits collected" value={naira(s.deposits_total)} sub={`${s.payments} ${s.payments === 1 ? 'payment' : 'payments'}`} to="/admin/payments" />
        <Tile label="Reviews" value={s.reviews} to="/admin/moderation" />
        <Tile label="Portfolio items" value={s.media} to="/admin/moderation" />
        <Tile label="Suspended users" value={s.suspended} to="/admin/users?status=suspended" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="New users, last 14 days"><Signups data={s.signups} /></Panel>
        <Panel title="Bookings by status">
          <ul className="space-y-2.5">
            {order.map((k) => (
              <li key={k} className="flex items-center justify-between">
                <Badge tone={STATUS_TONE[k]}>{k.replace('_', ' ')}</Badge>
                <span className="font-semibold">{s.bookings_by_status[k] || 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recent activity">
        {activity.data?.length === 0 && <p className="text-ink/60">Nothing has happened yet.</p>}
        <ul className="divide-y divide-line">
          {activity.data?.map((a, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <span className="w-24 shrink-0 pt-0.5"><Badge tone={KIND_TONE[a.kind]}>{KIND[a.kind]}</Badge></span>
              <span className="min-w-0 flex-1 break-words">{a.text}</span>
              <span className="shrink-0 text-sm text-ink/55">{when(a.created_at)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Email log">
        {emails.data?.length === 0 && <p className="text-ink/60">No emails sent yet.</p>}
        <ul className="divide-y divide-line">
          {emails.data?.slice(0, 15).map((m) => (
            <li key={m.id} className="py-2.5">
              <div className="flex items-start gap-3">
                <span className="w-20 shrink-0 pt-0.5"><Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge></span>
                <span className="min-w-0 flex-1 break-words">{m.subject} <span className="text-ink/55">to {m.to_email}</span></span>
                <span className="shrink-0 text-sm text-ink/55">{when(m.created_at)}</span>
              </div>
              {m.error && <p className="mt-1 pl-[5.75rem] text-sm text-hibiscus-deep">{m.error}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink/55">"logged" means no email key is set, so the message was only printed in the server terminal.</p>
      </Panel>
    </div>
  );
}

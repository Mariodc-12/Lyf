import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, naira, whatsappLink } from '../api.js';
import Icon from '../components/Icon.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ReviewList from '../components/ReviewList.jsx';
import { Stars } from '../components/Stars.jsx';
import { EVENT_TYPES, catLabel, tint, toneFor, initials } from '../lib/ui.js';

const STATUS = {
  confirmed: ['Waiting for deposit', 'bg-gold-tint text-gold-deep'],
  deposit_paid: ['Deposit paid', 'bg-leaf-tint text-leaf-deep'],
  completed: ['Done', 'bg-ink/10 text-ink'],
  declined: ['Declined', 'bg-hibiscus-tint text-hibiscus-deep'],
  cancelled: ['Cancelled by planner', 'bg-hibiscus-tint text-hibiscus-deep'],
};

function formatDate(value) {
  if (!value) return 'Date not set';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RequestCard({ b, onDone }) {
  const [price, setPrice] = useState(String(b.total_amount));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const meta = EVENT_TYPES[b.event_type] || EVENT_TYPES.party;
  const deposit = Math.round((Number(price) || 0) * 0.3);

  async function respond(action) {
    setError('');
    if (action === 'accept' && !Number(price)) return setError('Enter your price to accept.');
    setBusy(action);
    try {
      await api(`/vendor/bookings/${b.id}/respond`, {
        method: 'POST',
        body: { action, total_amount: Number(price), note },
      });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  }

  return (
    <li className="rounded-2xl border-2 border-gold bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: meta.tint, color: meta.tone }}>
          <Icon name={meta.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{b.event_title}</p>
          <p className="text-sm text-ink/60">
            {b.event_date ? `${meta.label} on ${formatDate(b.event_date)}` : `${meta.label}, date not set yet`}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink/60">Requested by {b.planner_name || 'a planner'}</p>

      <label htmlFor={`p-${b.id}`} className="mt-4 block text-sm font-medium">Your price for this event (₦)</label>
      <input id={`p-${b.id}`} className="field mt-1.5" inputMode="numeric"
        value={price ? Number(price).toLocaleString('en-NG') : ''}
        onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
      <p className="mt-1.5 text-sm text-ink/55">The planner pays {naira(deposit)} (30%) to lock it in.</p>

      <label htmlFor={`n-${b.id}`} className="mt-3 block text-sm font-medium">Note to planner (optional)</label>
      <input id={`n-${b.id}`} className="field mt-1.5" placeholder="Includes two shooters" maxLength={300}
        value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p role="alert" className="mt-3 text-sm font-medium text-hibiscus-deep">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-quiet !py-3" disabled={!!busy} onClick={() => respond('decline')}>
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
        <button className="btn !py-3" disabled={!!busy} onClick={() => respond('accept')}>
          {busy === 'accept' ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </li>
  );
}

function BookingRow({ b, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [label, cls] = STATUS[b.status] || STATUS.confirmed;
  const tone = toneFor(b.planner_name || b.event_title);

  async function complete() {
    setBusy(true);
    setError('');
    try {
      await api(`/vendor/bookings/${b.id}/complete`, { method: 'POST' });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold" style={{ background: tint(tone), color: tone }}>
          {initials(b.planner_name || b.event_title)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{b.event_title}</p>
          <p className="text-sm text-ink/60">{formatDate(b.event_date)} · {naira(b.total_amount)}</p>
          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>
        </div>
      </div>

      {b.planner_phone && (b.status === 'confirmed' || b.status === 'deposit_paid') && (
        <a
          href={whatsappLink(b.planner_phone, `Hello, this is about "${b.event_title}" on Lyf.`)}
          target="_blank"
          rel="noreferrer"
          className="btn-quiet mt-3 !py-3"
        >
          <Icon name="phone" size={18} />
          Message {b.planner_name || 'planner'} on WhatsApp
        </a>
      )}

      {b.status === 'deposit_paid' && (
        <button className="btn mt-2 !py-3" disabled={busy} onClick={complete}>
          {busy ? 'Saving…' : 'Mark as done'}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-medium text-hibiscus-deep">{error}</p>}
    </li>
  );
}

export default function VendorDashboard() {
  const nav = useNavigate();
  const [vendor, setVendor] = useState(undefined);
  const [bookings, setBookings] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api('/vendor/me'), api('/vendor/bookings')])
      .then(([v, b]) => {
        if (!v) return nav('/vendor/setup', { replace: true });
        setVendor(v);
        setBookings(b);
        api(`/vendors/${v.id}/reviews`).then(setReviews).catch(() => setReviews([]));
      })
      .catch((e) => setError(e.message));
  }, [nav]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="px-5 pt-8">
        <p role="alert" className="rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">{error}</p>
      </div>
    );
  }
  if (!vendor || !bookings) return <Skeleton />;

  const pending = bookings.filter((b) => b.status === 'requested');
  const active = bookings.filter((b) => ['confirmed', 'deposit_paid'].includes(b.status));
  const past = bookings.filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status));
  const earned = bookings
    .filter((b) => ['deposit_paid', 'completed'].includes(b.status))
    .reduce((s, b) => s + Number(b.deposit_amount), 0);

  return (
    <div>
      <header className="px-5 pt-8 md:pt-12">
        <p className="text-ink/60">{catLabel(vendor.category)} in {vendor.city}</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="display text-3xl sm:text-4xl">{vendor.business_name}</h1>
          <Link to="/vendor/setup" className="shrink-0 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold hover:border-ink/40">Edit</Link>
        </div>
        {vendor.verified && (
          <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-leaf-deep"><Icon name="check" size={15} />Verified by Lyf</p>
        )}
        {vendor.review_count > 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink/70">
            <Stars value={vendor.rating} size={16} />
            <span className="font-semibold text-ink">{Number(vendor.rating).toFixed(1)}</span>
            ({vendor.review_count} {vendor.review_count === 1 ? 'review' : 'reviews'})
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink/60">No reviews yet. They appear after your first finished event.</p>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <dt className="text-sm text-ink/60">Waiting for you</dt>
            <dd className="display mt-1 text-3xl">{pending.length}</dd>
          </div>
          <div className="card p-4">
            <dt className="text-sm text-ink/60">Deposits received</dt>
            <dd className="display mt-1 text-3xl">{naira(earned)}</dd>
          </div>
        </dl>
      </header>

      <div className="space-y-8 px-5 pt-8">
        {vendor.media_count === 0 && (
          <div className="rounded-2xl bg-gold-tint p-5 text-gold-deep">
            <p className="font-semibold">Show planners your work</p>
            <p className="mt-1 text-sm">Vendors with photos and videos get more requests. It takes a minute.</p>
            <Link to="/vendor/portfolio" className="btn mt-4 !py-3">Add photos and videos</Link>
          </div>
        )}

        {bookings.length === 0 && (
          <div className="card p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-tint text-gold-deep">
              <Icon name="inbox" />
            </span>
            <p className="mt-3 font-semibold">No requests yet</p>
            <p className="mt-1 text-sm text-ink/65">
              Your business is live. When a planner requests you, it shows up here and you choose to accept or decline.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="display text-2xl">New requests</h2>
            <ul className="mt-3 space-y-3">
              {pending.map((b) => <RequestCard key={b.id} b={b} onDone={load} />)}
            </ul>
          </section>
        )}

        {active.length > 0 && (
          <section>
            <h2 className="display text-2xl">Booked</h2>
            <ul className="mt-3 space-y-3">
              {active.map((b) => <BookingRow key={b.id} b={b} onDone={load} />)}
            </ul>
          </section>
        )}

        {reviews.length > 0 && (
          <section>
            <h2 className="display text-2xl">Reviews</h2>
            <div className="mt-3"><ReviewList reviews={reviews} /></div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="display text-2xl">History</h2>
            <ul className="mt-3 space-y-3">
              {past.map((b) => <BookingRow key={b.id} b={b} onDone={load} />)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

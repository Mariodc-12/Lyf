import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, naira, whatsappLink } from '../api.js';
import Icon from '../components/Icon.jsx';
import EventSummary from '../components/EventSummary.jsx';
import RateForm from '../components/RateForm.jsx';
import { Stars } from '../components/Stars.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { EVENT_TYPES, catMeta, catLabel, tint, toneFor, initials } from '../lib/ui.js';

const STATUS = {
  requested: ['Waiting for vendor', 'bg-gold-tint text-gold-deep'],
  confirmed: ['Accepted', 'bg-ink/10 text-ink'],
  declined: ['Declined', 'bg-hibiscus-tint text-hibiscus-deep'],
  deposit_paid: ['Deposit paid', 'bg-leaf-tint text-leaf-deep'],
  completed: ['Completed', 'bg-leaf-tint text-leaf-deep'],
  cancelled: ['Cancelled', 'bg-hibiscus-tint text-hibiscus-deep'],
};

export default function EventDetail() {
  const { id } = useParams();
  const [ev, setEv] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => api(`/events/${id}`).then(setEv).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [id]);

  async function cancelBooking(bookingId) {
    setBusyId(bookingId);
    setError('');
    try {
      await api(`/bookings/${bookingId}/cancel`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  }

  async function payDeposit(bookingId) {
    setBusyId(bookingId);
    setError('');
    try {
      const { authorization_url } = await api(`/bookings/${bookingId}/pay-deposit`, { method: 'POST' });
      window.location.href = authorization_url;
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  }

  if (!ev) {
    return error ? (
      <div className="px-5 pt-8">
        <p role="alert" className="rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">{error}</p>
        <Link to="/" className="btn-quiet mt-4">Back to home</Link>
      </div>
    ) : (
      <Skeleton />
    );
  }

  const meta = EVENT_TYPES[ev.type] || EVENT_TYPES.party;
  const spent = ev.categories.reduce((s, c) => s + Number(c.spent_amount), 0);

  return (
    <div>
      <div className="px-5 pt-6 md:pt-10">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70 hover:text-ink">
            <Icon name="back" size={18} />
            All events
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium">
            <Icon name={meta.icon} size={15} />
            {meta.label}
          </span>
        </div>
        <section className="rounded-2xl bg-ink p-6 text-white">
          <EventSummary title={ev.title} eventDate={ev.event_date} budgetTotal={ev.budget_total} spent={spent} />
        </section>
      </div>

      <div className="space-y-8 px-5 pt-8">
        {ev.tips.length > 0 && (
          <div className="space-y-2">
            {ev.tips.map((t, i) => (
              <p key={i} className="flex items-start gap-2 rounded-2xl bg-gold-tint px-4 py-3 text-sm font-medium text-gold-deep">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                {t.message}
              </p>
            ))}
          </div>
        )}

        <section>
          <h2 className="display text-2xl">Where your money goes</h2>
          <ul className="mt-3 divide-y divide-line card px-4">
            {ev.categories.map((c) => {
              const m = catMeta(c.category);
              const alloc = Number(c.allocated_amount);
              const sp = Number(c.spent_amount);
              const over = sp > alloc;
              const pct = Math.min(100, Math.round((sp / (alloc || 1)) * 100));
              return (
                <li key={c.id} className="py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: tint(m.tone), color: m.tone }}>
                      <Icon name={m.icon} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{catLabel(c.category)}</span>
                        <span className="shrink-0 text-sm text-ink/60">{naira(sp)} of {naira(alloc)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? '#D93A64' : m.tone }} />
                      </div>
                      {over && <p className="mt-1.5 text-sm font-medium text-hibiscus-deep">{naira(sp - alloc)} over</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="display text-2xl">Vendors</h2>
          {ev.bookings.length === 0 ? (
            <div className="mt-3 card p-5">
              <p className="font-semibold">No vendors yet</p>
              <p className="mt-1 text-sm text-ink/65">Browse photographers, caterers, venues and more, then request a booking.</p>
              <Link to={`/events/${id}/vendors`} className="btn mt-4">Find vendors</Link>
            </div>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {ev.bookings.map((b) => {
                  const [label, cls] = STATUS[b.status] || STATUS.requested;
                  const tone = toneFor(b.business_name);
                  return (
                    <li key={b.id} className="card p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold" style={{ background: tint(tone), color: tone }}>
                          {initials(b.business_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{b.business_name}</p>
                          <p className="text-sm text-ink/60">
                            {b.status === 'requested' ? `Asking from ${naira(b.total_amount)}` : `Total ${naira(b.total_amount)}, deposit ${naira(b.deposit_amount)}`}
                          </p>
                          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>
                        </div>
                      </div>

                      {b.vendor_note && (
                        <p className="mt-3 rounded-2xl bg-paper px-3.5 py-2.5 text-sm text-ink/80">
                          <span className="font-semibold">{b.business_name}:</span> {b.vendor_note}
                        </p>
                      )}

                      {b.status === 'requested' && (
                        <>
                          <p className="mt-3 flex items-center gap-2 text-sm text-ink/65">
                            <Icon name="clock" size={16} />
                            You can pay the deposit once they accept.
                          </p>
                          <button className="btn-quiet mt-3 !py-3" disabled={busyId === b.id} onClick={() => cancelBooking(b.id)}>
                            Cancel request
                          </button>
                        </>
                      )}

                      {b.status === 'confirmed' && (
                        <>
                          <button className="btn mt-3 !py-3" disabled={busyId === b.id} onClick={() => payDeposit(b.id)}>
                            {busyId === b.id ? 'Opening Paystack…' : `Pay ${naira(b.deposit_amount)} deposit`}
                          </button>
                          <button className="mt-2 w-full text-sm font-medium text-ink/60 underline" disabled={busyId === b.id} onClick={() => cancelBooking(b.id)}>
                            Cancel booking
                          </button>
                        </>
                      )}

                      {b.status === 'declined' && (
                        <Link to={`/events/${id}/vendors`} className="btn-quiet mt-3 !py-3">Find another vendor</Link>
                      )}

                      {b.vendor_phone && ['confirmed', 'deposit_paid', 'completed'].includes(b.status) && (
                        <a
                          href={whatsappLink(b.vendor_phone, `Hello ${b.business_name}, this is about "${ev.title}" on Lyf.`)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-quiet mt-2 !py-3"
                        >
                          <Icon name="phone" size={18} />
                          Chat on WhatsApp
                        </a>
                      )}

                      {b.can_review && <RateForm booking={b} onDone={load} />}

                      {b.review_rating && (
                        <div className="mt-3 rounded-2xl bg-paper px-3.5 py-3">
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            Your rating <Stars value={b.review_rating} />
                          </p>
                          {b.review_comment && <p className="mt-1 text-sm text-ink/75">{b.review_comment}</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Link to={`/events/${id}/vendors`} className="btn-quiet mt-3">Find more vendors</Link>
            </>
          )}
        </section>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

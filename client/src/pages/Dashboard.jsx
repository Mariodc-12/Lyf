import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, naira } from '../api.js';
import Icon from '../components/Icon.jsx';
import EventSummary from '../components/EventSummary.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { EVENT_TYPES, greeting } from '../lib/ui.js';

const STEPS = [
  ['Set a budget', 'Tell Lyf what you can spend in total.'],
  ['Get your split', 'See a suggested amount for every cost, and change any of them.'],
  ['Book vendors', 'Request a booking and pay a deposit to lock it in.'],
];

export default function Dashboard() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    Promise.all([api('/me'), api('/events')])
      .then(([m, e]) => {
        setMe(m);
        setEvents(e);
      })
      .catch(() => nav('/login'));
  }, [nav]);

  if (!me || !events) return <Skeleton />;

  const first = events[0];
  const others = events.slice(1);
  const firstName = (me.name || '').split(' ')[0] || 'there';

  return (
    <div>
      <header className="px-5 pt-8 md:pt-12">
        <p className="text-ink/60">{greeting()}, {firstName}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="display text-3xl sm:text-4xl">{first ? 'Your events' : 'Plan your first event'}</h1>
          {first && <Link to="/events/new" className="btn-gold shrink-0 !py-2.5 !text-sm">New event</Link>}
        </div>
        {Number(me.points) > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-tint px-3 py-1.5 text-sm font-semibold text-gold-deep">
            <Icon name="star" size={14} filled />
            {Number(me.points).toLocaleString()} reward points
          </p>
        )}
      </header>

      {first ? (
        <section className="mt-6 px-5">
          <div className="rounded-2xl bg-ink p-6 text-white">
            <EventSummary
              title={first.title}
              eventDate={first.event_date}
              budgetTotal={first.budget_total}
              spent={Number(first.spent_total)}
            />
            <Link to={`/events/${first.id}`} className="btn-gold mt-6 w-full sm:w-auto">Open plan</Link>
          </div>
        </section>
      ) : (
        <section className="mt-6 px-5">
          <div className="card p-6">
            <p className="max-w-[40ch] text-ink/70">
              Weddings, birthdays, graduations. Start with a budget and Lyf splits it across every cost for you.
            </p>
            <Link to="/events/new" className="btn-gold mt-5">Create an event</Link>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="px-5 pt-10">
          <h2 className="display text-2xl">Other events</h2>
          <ul className="mt-3 divide-y divide-line card px-4">
            {others.map((ev) => {
              const meta = EVENT_TYPES[ev.type] || EVENT_TYPES.party;
              const total = Number(ev.budget_total);
              const spent = Number(ev.spent_total);
              const over = spent > total;
              const pct = Math.min(100, Math.round((spent / (total || 1)) * 100));
              return (
                <li key={ev.id}>
                  <Link to={`/events/${ev.id}`} className="flex items-center gap-3 py-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: meta.tint, color: meta.tone }}>
                      <Icon name={meta.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{ev.title}</span>
                      <span className="block text-sm text-ink/60">{naira(spent)} of {naira(total)}</span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink/10">
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: over ? '#D93A64' : meta.tone }} />
                      </span>
                    </span>
                    <Icon name="chevron" className="shrink-0 text-ink/40" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {events.length === 0 && (
        <section className="px-5 pt-10">
          <h2 className="display text-2xl">How it works</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4 card p-4">
                <span className="display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-base text-white">{i + 1}</span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-ink/65">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

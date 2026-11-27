import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, naira } from '../api.js';
import Icon from '../components/Icon.jsx';
import { EVENT_TYPES, TYPE_LIST, catMeta, catLabel, tint } from '../lib/ui.js';

const PRESETS = [
  [150000, '₦150k'],
  [350000, '₦350k'],
  [1000000, '₦1m'],
  [3000000, '₦3m'],
];

export default function CreateEvent() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [type, setType] = useState('wedding');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('350000');
  const [plan, setPlan] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = EVENT_TYPES[type];

  useEffect(() => {
    const t = Number(total);
    if (!t || t <= 0) {
      setPlan([]);
      return;
    }
    let live = true;
    api('/budget/preview', { method: 'POST', body: { type, total: t } })
      .then((p) => live && setPlan(p))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [type, total]);

  function back() {
    setError('');
    if (step > 1) setStep(step - 1);
    else nav('/');
  }

  function next() {
    setError('');
    if (step === 2 && !Number(total)) {
      setError('Enter a budget to continue.');
      return;
    }
    setStep(step + 1);
  }

  function editAmount(i, value) {
    const amount = Math.max(0, Math.round(Number(value) || 0));
    setPlan((p) => p.map((c, idx) => (idx === i ? { ...c, amount } : c)));
  }

  const budget = Number(total) || 0;
  const allocated = plan.reduce((s, c) => s + Number(c.amount), 0);
  const diff = budget - allocated;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const ev = await api('/events', {
        method: 'POST',
        body: {
          title: title.trim() || `My ${meta.label.toLowerCase()}`,
          type,
          event_date: date || null,
          budget_total: budget,
          categories: plan,
        },
      });
      nav(`/events/${ev.id}`);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="pb-12">
      <header className="flex items-center gap-3 px-5 pt-6">
        <button onClick={back} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white">
          <Icon name="back" />
        </button>
        <div>
          <h1 className="display text-2xl leading-tight">New event</h1>
          <p className="text-sm text-ink/60">Step {step} of 3</p>
        </div>
      </header>
      <div className="mx-5 mt-4 flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-ink' : 'bg-ink/15'}`} />
        ))}
      </div>

      <div className="px-5 pt-7">
        {step === 1 && (
          <section>
            <h2 className="display text-3xl">What are you planning?</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {TYPE_LIST.map((t) => {
                const m = EVENT_TYPES[t];
                const on = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    aria-pressed={on}
                    className={`relative rounded-2xl border-2 p-4 text-left transition ${on ? 'border-ink bg-white' : 'border-line bg-white hover:border-ink/40'}`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: m.tint, color: m.tone }}>
                      <Icon name={m.icon} size={24} />
                    </span>
                    <span className="mt-3 block text-lg font-semibold">{m.label}</span>
                    <span className="mt-0.5 block text-sm text-ink/60">{m.blurb}</span>
                    {on && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                        <Icon name="check" size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h2 className="display text-3xl">Name it and set a budget</h2>
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium">Event name</label>
              <input id="title" className="field" placeholder={meta.example} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label htmlFor="date" className="mb-1.5 block text-sm font-medium">Date</label>
              <input id="date" className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="budget" className="mb-1.5 block text-sm font-medium">Total budget</label>
              <div className="flex items-center rounded-2xl border border-line bg-white px-4 focus-within:border-ink">
                <span className="text-3xl font-bold text-ink/45">₦</span>
                <input
                  id="budget"
                  inputMode="numeric"
                  placeholder="350,000"
                  className="w-full bg-transparent px-2 py-4 text-3xl font-bold outline-none"
                  value={total ? Number(total).toLocaleString('en-NG') : ''}
                  onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTotal(String(value))}
                    className={`chip ${Number(total) === value ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="display text-3xl">Your budget split</h2>
            <p className="mt-1 text-ink/65">Here's a suggested split of {naira(budget)}. Change any amount.</p>

            <div className="mt-5 flex h-3.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
              {plan.map((c) => (
                <span
                  key={c.category}
                  style={{ width: `${(Number(c.amount) / Math.max(budget, allocated, 1)) * 100}%`, background: catMeta(c.category).tone }}
                />
              ))}
            </div>

            <ul className="mt-3 divide-y divide-line card px-4">
              {plan.map((c, i) => {
                const m = catMeta(c.category);
                return (
                  <li key={c.category} className="flex items-center gap-3 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: tint(m.tone), color: m.tone }}>
                      <Icon name={m.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{catLabel(c.category)}</span>
                      <span className="text-sm text-ink/55">{budget ? Math.round((Number(c.amount) / budget) * 100) : 0}% of budget</span>
                    </span>
                    <label htmlFor={`amt-${i}`} className="sr-only">Amount for {catLabel(c.category)}</label>
                    <input
                      id={`amt-${i}`}
                      inputMode="numeric"
                      className="w-28 rounded-xl border border-line bg-white px-3 py-2 text-right font-semibold outline-none focus:border-ink"
                      value={Number(c.amount).toLocaleString('en-NG')}
                      onChange={(e) => editAmount(i, e.target.value.replace(/\D/g, ''))}
                    />
                  </li>
                );
              })}
            </ul>

            <p
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
                diff === 0 ? 'bg-leaf-tint text-leaf-deep' : diff > 0 ? 'bg-gold-tint text-gold-deep' : 'bg-hibiscus-tint text-hibiscus-deep'
              }`}
            >
              {diff === 0 && 'Every naira is planned.'}
              {diff > 0 && `${naira(diff)} isn't assigned yet. Add it to a cost or keep it as a buffer.`}
              {diff < 0 && `${naira(-diff)} over your total. Lower a cost to fit.`}
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-7">
          {step < 3 ? (
            <button className="btn" onClick={next}>Continue</button>
          ) : (
            <button className="btn" onClick={save} disabled={busy || !plan.length}>
              {busy ? 'Creating…' : 'Create event'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

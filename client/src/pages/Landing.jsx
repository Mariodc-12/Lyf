import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ExampleBudget from '../components/ExampleBudget.jsx';
import { catMeta, catLabel, tint } from '../lib/ui.js';

const STEPS = [
  ['Set your budget', 'Pick the event, add a date and the total you can spend. Lyf suggests an amount for venue, food, aso-ebi and every other cost. Change any of them.'],
  ['Choose vendors by their work', 'Browse photos and videos from real jobs, read reviews from past clients, and send a request to the ones you like.'],
  ['Lock it in', 'When a vendor accepts and confirms their price, pay a 30% deposit with Paystack. Your budget updates by itself.'],
];

const CATS = ['venue', 'aso-ebi', 'food', 'photography', 'makeup', 'decoration', 'dj', 'miscellaneous'];

const TRUST = [
  ['Deposits only after a vendor says yes', 'You are never asked to pay for a request. Payment opens once the vendor accepts and sets their price.'],
  ['Contacts stay private until then', 'Phone numbers are shared only after a booking is accepted, then each side gets a WhatsApp link.'],
  ['Reviews come from real bookings', 'Only planners who booked a vendor can rate them, once the job is done or the date has passed.'],
];

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="display text-3xl" aria-label="Lyf home">Lyf</Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper">Sign in</Link>
          <Link to="/register" className="btn-gold !px-4 !py-2.5 !text-sm">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-16">
        <div>
          <h1 className="display max-w-[16ch] text-[2.6rem] leading-[1.02] sm:text-6xl">
            Plan your event around a budget you can keep.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg text-ink/70">
            Tell Lyf what you can spend. It splits the money across every cost, then helps you book vendors whose past work you can see first.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register" className="btn-gold !px-6 !py-3.5">Plan an event</Link>
            <Link to="/register?role=vendor" className="rounded-xl border border-line px-6 py-3.5 font-semibold hover:border-ink/40">I am a vendor</Link>
          </div>
          <p className="mt-5 text-sm text-ink/55">Free for planners. Weddings, birthdays, graduations and parties.</p>
        </div>
        <div className="relative pb-6 lg:pb-0">
          <ExampleBudget />
          <div className="absolute -bottom-9 left-6 hidden items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-[0_12px_30px_-12px_rgba(27,34,80,0.35)] sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-tint text-leaf-deep"><Icon name="check" size={18} /></span>
            <span className="text-sm"><span className="block font-semibold">Kaya Studios accepted</span><span className="text-ink/60">Deposit ₦24,000 due</span></span>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="display max-w-[22ch] text-3xl sm:text-4xl">From budget to booked in three steps</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title}>
                <span className="display text-5xl text-gold">{i + 1}</span>
                <h3 className="mt-3 text-xl font-semibold">{title}</h3>
                <p className="mt-2 max-w-[38ch] text-ink/70">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="display max-w-[24ch] text-3xl sm:text-4xl">Every cost on your list, in one place</h2>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATS.map((c) => {
            const m = catMeta(c);
            return (
              <li key={c} className="card flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(m.tone), color: m.tone }}>
                  <Icon name={m.icon} size={20} />
                </span>
                <span className="font-semibold leading-tight">{catLabel(c)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <h2 className="display max-w-[22ch] text-3xl sm:text-4xl">Built so nobody gets a surprise</h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {TRUST.map(([title, body]) => (
            <li key={title} className="border-t-2 border-ink pt-4">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-ink/70">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="adire">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-20 text-white sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="display max-w-[20ch] text-3xl sm:text-4xl">Run an events business?</h2>
            <p className="mt-3 max-w-[48ch] text-white/75">
              Show your best work, get requests from people who already have a budget, and receive a deposit before the date.
            </p>
          </div>
          <Link to="/register?role=vendor" className="btn-gold shrink-0 !px-7 !py-4">List your business</Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink/60 sm:px-8">
        <span className="display text-2xl text-ink">Lyf</span>
        <nav aria-label="Footer" className="flex gap-5 font-medium">
          <Link to="/login" className="hover:text-ink">Sign in</Link>
          <Link to="/register" className="hover:text-ink">Create account</Link>
          <Link to="/register?role=vendor" className="hover:text-ink">For vendors</Link>
        </nav>
      </footer>
    </div>
  );
}

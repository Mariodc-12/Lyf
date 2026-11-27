import EventSummary from './EventSummary.jsx';
import { naira } from '../api.js';
import { catMeta, catLabel } from '../lib/ui.js';

// A made-up plan that shows what Lyf produces. Used on the landing and sign-in pages.
const ROWS = [
  ['venue', 700000, 700000],
  ['aso-ebi', 805000, 310000],
  ['food', 630000, 0],
  ['photography', 420000, 120000],
];

export default function ExampleBudget({ className = '' }) {
  const date = new Date(Date.now() + 96 * 86400000).toISOString().slice(0, 10);
  const spent = ROWS.reduce((s, r) => s + r[2], 0);
  return (
    <figure className={`rounded-2xl bg-ink p-6 text-white shadow-[0_24px_60px_-24px_rgba(27,34,80,0.55)] ${className}`}>
      <figcaption className="mb-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
        Example plan
      </figcaption>
      <EventSummary title="Tola and Seun's wedding" eventDate={date} budgetTotal={3500000} spent={spent} />
      <ul className="mt-6 space-y-3.5 border-t border-white/15 pt-5">
        {ROWS.map(([cat, alloc, sp]) => {
          const m = catMeta(cat);
          return (
            <li key={cat}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{catLabel(cat)}</span>
                <span className="text-white/65">{naira(sp)} of {naira(alloc)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full" style={{ width: `${Math.round((sp / alloc) * 100)}%`, background: m.tone === '#4F5BD5' ? '#8D97FF' : m.tone }} />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

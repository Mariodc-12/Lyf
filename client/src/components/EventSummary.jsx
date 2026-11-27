import BudgetRing from './BudgetRing.jsx';
import { naira } from '../api.js';
import { countdownText } from '../lib/ui.js';

export default function EventSummary({ title, eventDate, budgetTotal, spent }) {
  const total = Number(budgetTotal);
  const left = total - spent;
  const over = left < 0;

  return (
    <div>
      <p className="text-sm text-white/70">{countdownText(eventDate)}</p>
      <h1 className="display mt-1 text-3xl leading-tight">{title}</h1>
      <div className="mt-5 flex items-center gap-5">
        <BudgetRing spent={spent} total={total} />
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-white/65">Spent</dt>
            <dd className="text-xl font-semibold">{naira(spent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/65">{over ? 'Over budget by' : 'Left to spend'}</dt>
            <dd className={`text-xl font-semibold ${over ? 'text-[#FF9DB5]' : ''}`}>{naira(Math.abs(left))}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

import { Stars } from './Stars.jsx';

const when = (value) => new Date(value).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });

export default function ReviewList({ reviews }) {
  return (
    <ul className="space-y-2">
      {reviews.map((r) => (
        <li key={r.id} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <Stars value={r.rating} />
            <span className="text-xs text-ink/50">{when(r.created_at)}</span>
          </div>
          {r.comment && <p className="mt-2 text-sm text-ink/80">{r.comment}</p>}
          <p className="mt-2 text-sm font-medium">{r.planner_name}</p>
        </li>
      ))}
    </ul>
  );
}

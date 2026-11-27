import Icon from './Icon.jsx';

// Read-only row of five stars.
export function Stars({ value, size = 16 }) {
  const n = Math.round(Number(value) || 0);
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} filled={i <= n} className={i <= n ? 'text-gold' : 'text-ink/20'} />
      ))}
    </span>
  );
}

// Tap-to-choose row of five stars.
export function StarInput({ value, onChange, label = 'Rating' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} ${i === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(i)}
          className="flex h-11 w-11 items-center justify-center rounded-xl"
        >
          <Icon name="star" size={32} filled={i <= value} className={i <= value ? 'text-gold' : 'text-ink/25'} />
        </button>
      ))}
    </div>
  );
}

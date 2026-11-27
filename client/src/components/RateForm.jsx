import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { StarInput } from './Stars.jsx';

export default function RateForm({ booking, onDone }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="btn mt-3 !py-3" onClick={() => setOpen(true)}>
        <Icon name="star" size={18} />
        Rate {booking.business_name}
      </button>
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setError('Choose a star rating first.');
    setError('');
    setBusy(true);
    try {
      await api(`/bookings/${booking.id}/review`, { method: 'POST', body: { rating, comment } });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const fieldId = `review-${booking.id}`;

  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl bg-paper p-4">
      <p className="font-semibold">How was {booking.business_name}?</p>
      <div className="-ml-1 mt-1">
        <StarInput value={rating} onChange={(n) => { setRating(n); setError(''); }} label={`Rate ${booking.business_name}`} />
      </div>
      <label htmlFor={fieldId} className="mt-3 block text-sm font-medium">Tell other planners what it was like (optional)</label>
      <textarea
        id={fieldId}
        rows={3}
        maxLength={500}
        className="field mt-1.5"
        placeholder="They arrived early and the photos were ready in a week."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p role="alert" className="mt-2 text-sm font-medium text-hibiscus-deep">{error}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn-quiet !py-3" onClick={() => setOpen(false)}>Not now</button>
        <button className="btn !py-3" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button>
      </div>
    </form>
  );
}

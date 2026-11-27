import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { catLabel } from '../lib/ui.js';
import { Stars } from './Stars.jsx';
import ReviewList from './ReviewList.jsx';

// One square picture. Videos show their first frame with a play badge.
export function MediaTile({ item, className = '' }) {
  return (
    <span className={`relative block h-full w-full overflow-hidden bg-ink/10 ${className}`}>
      {item.kind === 'video' ? (
        <>
          <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white">
              <Icon name="play" size={16} />
            </span>
          </span>
        </>
      ) : (
        <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </span>
  );
}

// Full-screen viewer with next and previous.
export function Lightbox({ items, index, onIndex, onClose, label = 'Portfolio' }) {
  const closeRef = useRef(null);
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onIndex(index - 1);
      if (e.key === 'ArrowRight' && hasNext) onIndex(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, hasPrev, hasNext, onClose, onIndex]);

  if (!item) return null;

  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white';

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 pt-4 text-white">
        <span className="text-sm text-white/70">{index + 1} of {items.length}</span>
        <button ref={closeRef} onClick={onClose} aria-label="Close" className={btn}>
          <Icon name="close" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        {item.kind === 'video' ? (
          <video key={item.id} src={item.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" />
        ) : (
          <img key={item.id} src={item.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-6 pt-3">
        <button onClick={() => onIndex(index - 1)} disabled={!hasPrev} aria-label="Previous" className={`${btn} disabled:opacity-30`}>
          <Icon name="back" />
        </button>
        <button onClick={() => onIndex(index + 1)} disabled={!hasNext} aria-label="Next" className={`${btn} disabled:opacity-30`}>
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

// Bottom sheet a planner opens from a vendor card to see all of that vendor's work.
export default function PortfolioSheet({ vendor, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    api(`/vendors/${vendor.id}/media`)
      .then(setItems)
      .catch((e) => setError(e.message));
    api(`/vendors/${vendor.id}/reviews`)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [vendor.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
    <div className="fixed inset-0 z-40 flex items-end bg-ink/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${vendor.business_name} portfolio`}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-8 pt-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{vendor.business_name}</h2>
            <p className="text-sm text-ink/60">{catLabel(vendor.category)} in {vendor.city}</p>
            {vendor.review_count > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                <Stars value={vendor.rating} size={15} />
                <span className="font-semibold">{Number(vendor.rating).toFixed(1)}</span>
                <span className="text-ink/60">({vendor.review_count} {vendor.review_count === 1 ? 'review' : 'reviews'})</span>
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close portfolio" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
            <Icon name="close" />
          </button>
        </div>

        {items === null && !error && (
          <div className="mt-5 grid animate-pulse grid-cols-3 gap-2" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((n) => <div key={n} className="aspect-square rounded-xl bg-ink/10" />)}
          </div>
        )}

        {error && <p role="alert" className="mt-5 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">{error}</p>}

        {items && items.length === 0 && (
          <p className="mt-5 card p-5 text-sm text-ink/65">
            This vendor hasn't added photos or videos yet. You can still send a request and ask them for examples.
          </p>
        )}

        {items && items.length > 0 && (
          <ul className="mt-5 grid grid-cols-3 gap-2">
            {items.map((m, i) => (
              <li key={m.id} className="aspect-square">
                <button onClick={() => setOpen(i)} aria-label={`Open ${m.kind} ${i + 1} of ${items.length}`} className="block h-full w-full overflow-hidden rounded-xl">
                  <MediaTile item={m} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-7 text-lg font-semibold">Reviews</h3>
        {reviews === null && <div className="mt-3 h-20 animate-pulse rounded-2xl bg-ink/10" aria-busy="true" />}
        {reviews && reviews.length === 0 && (
          <p className="mt-3 card p-5 text-sm text-ink/65">
            No reviews yet. Planners can leave one after their event with this vendor.
          </p>
        )}
        {reviews && reviews.length > 0 && <div className="mt-3"><ReviewList reviews={reviews} /></div>}
      </div>
    </div>

    {open !== null && items && (
      <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} label={`${vendor.business_name} portfolio`} />
    )}
    </>
  );
}

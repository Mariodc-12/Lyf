import { useState } from 'react';
import { api } from '../../api.js';
import { MediaTile } from '../../components/PortfolioSheet.jsx';
import { Stars } from '../../components/Stars.jsx';
import { ConfirmButton, ErrorNote, Panel, useAdminList, when } from './ui.jsx';

export default function Moderation() {
  const [tab, setTab] = useState('reviews');
  const reviews = useAdminList('/admin/reviews', {});
  const media = useAdminList('/admin/media', {});
  const [err, setErr] = useState('');

  const remove = (path, reload) => async () => {
    setErr('');
    try {
      await api(path, { method: 'DELETE' });
      reload();
    } catch (e) {
      setErr(e.message);
      reload();
    }
  };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="What to moderate" className="inline-flex rounded-2xl bg-ink/[0.07] p-1">
        {[['reviews', 'Reviews'], ['media', 'Photos and videos']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-white shadow-sm' : 'text-ink/60'}`}>{l}</button>
        ))}
      </div>
      <ErrorNote error={err || reviews.error || media.error} />

      {tab === 'reviews' && (
        <Panel title="Latest reviews">
          {reviews.data?.length === 0 && <p className="text-ink/60">No reviews yet.</p>}
          <ul className="divide-y divide-line">
            {reviews.data?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2"><Stars value={r.rating} size={15} /> <span className="font-semibold">{r.business_name}</span></p>
                  {r.comment ? <p className="mt-1 break-words">{r.comment}</p> : <p className="mt-1 text-ink/50">No comment</p>}
                  <p className="mt-1 text-sm text-ink/55">{r.planner_name || 'A planner'} ({r.planner_email || 'no email'}) · {when(r.created_at)}</p>
                </div>
                <ConfirmButton danger label="Remove" confirmLabel="Yes, remove" onConfirm={remove(`/admin/reviews/${r.id}`, reviews.reload)} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === 'media' && (
        <Panel title="Latest portfolio uploads">
          {media.data?.length === 0 && <p className="text-ink/60">Nothing uploaded yet.</p>}
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {media.data?.map((m) => (
              <li key={m.id}>
                <div className="aspect-square overflow-hidden rounded-2xl"><MediaTile item={m} /></div>
                <p className="mt-1.5 truncate text-sm font-semibold">{m.business_name}</p>
                <p className="text-xs text-ink/55">{when(m.created_at)}</p>
                <div className="mt-1.5"><ConfirmButton danger label="Remove" confirmLabel="Yes, remove" onConfirm={remove(`/admin/media/${m.id}`, media.reload)} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

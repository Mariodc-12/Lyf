import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiUpload } from '../api.js';
import Icon from '../components/Icon.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { MediaTile, Lightbox } from '../components/PortfolioSheet.jsx';

const MAX_ITEMS = 30;
const MAX_VIDEO = 50 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm';

// Phone photos are often 4 to 8 MB. Shrinking them first saves the vendor's data and uploads much faster.
async function shrinkPhoto(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    return new File([blob], `${file.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function VendorPortfolio() {
  const [items, setItems] = useState(null);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);

  const load = useCallback(() => {
    api('/vendor/media').then(setItems).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const patch = (key, changes) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...changes } : x)));

  async function onPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || busy.current) return;
    setError('');
    busy.current = true;

    let count = items.length;
    for (const original of files) {
      const key = `${Date.now()}-${Math.random()}`;
      setQueue((q) => [...q, { key, name: original.name, progress: 0, error: '' }]);

      if (count >= MAX_ITEMS) {
        patch(key, { error: `You can show up to ${MAX_ITEMS} items. Delete one to add more.` });
        continue;
      }
      const isVideo = original.type.startsWith('video/');
      if (!isVideo && !original.type.startsWith('image/')) {
        patch(key, { error: 'Choose a photo or a video.' });
        continue;
      }
      if (isVideo && original.size > MAX_VIDEO) {
        patch(key, { error: 'Videos can be up to 50 MB. Trim or compress it first.' });
        continue;
      }

      try {
        const file = await shrinkPhoto(original);
        const created = await apiUpload('/vendor/media', file, (p) => patch(key, { progress: p }));
        setItems((prev) => [created, ...(prev || [])]);
        count += 1;
        setQueue((q) => q.filter((x) => x.key !== key));
      } catch (err) {
        patch(key, { error: err.message });
      }
    }
    busy.current = false;
  }

  async function remove(id) {
    setDeleting(true);
    setError('');
    try {
      await api(`/vendor/media/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((m) => m.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(err.message);
    }
    setDeleting(false);
  }

  if (!items) return error ? <p role="alert" className="px-5 pt-8 text-hibiscus-deep">{error}</p> : <Skeleton />;

  const uploading = queue.some((q) => !q.error);

  return (
    <div>
      <header className="px-5 pt-8 md:pt-12">
        <div className="flex items-start justify-between gap-3">
          <h1 className="display text-3xl sm:text-4xl">Show your best work</h1>
          <span className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink/70">{items.length} of {MAX_ITEMS}</span>
        </div>
        <p className="mt-2 max-w-[46ch] text-ink/65">
          Planners look at your photos and videos before they send a request. Add your strongest events first.
        </p>
        <label className="btn-gold mt-5 cursor-pointer focus-within:ring-4 focus-within:ring-gold/40">
          <Icon name="upload" size={20} />
          {uploading ? 'Uploading…' : 'Add photos and videos'}
          <input type="file" multiple accept={ACCEPT} onChange={onPick} className="sr-only" />
        </label>
        <p className="mt-3 text-sm text-ink/55">Photos are shrunk to save your data. Videos can be up to 50 MB.</p>
      </header>

      <div className="space-y-5 px-5 pt-6">
        {queue.length > 0 && (
          <ul className="space-y-2" aria-live="polite">
            {queue.map((q) => (
              <li key={q.key} className="card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{q.name}</span>
                  {q.error ? (
                    <button onClick={() => setQueue((x) => x.filter((i) => i.key !== q.key))} className="shrink-0 text-sm font-medium text-ink/60 underline">
                      Dismiss
                    </button>
                  ) : (
                    <span className="shrink-0 text-sm text-ink/60">{Math.round(q.progress * 100)}%</span>
                  )}
                </div>
                {q.error ? (
                  <p role="alert" className="mt-1 text-sm font-medium text-hibiscus-deep">{q.error}</p>
                ) : (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.round(q.progress * 100)}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {items.length === 0 && queue.length === 0 && (
          <div className="card p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-tint text-gold-deep">
              <Icon name="image" />
            </span>
            <p className="mt-3 font-semibold">No work added yet</p>
            <p className="mt-1 text-sm text-ink/65">Vendors with photos and videos get more requests. Add a few from your best events.</p>
          </div>
        )}

        {items.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {items.map((m, i) => (
              <li key={m.id} className="relative aspect-square">
                <button onClick={() => setViewing(i)} aria-label={`View ${m.kind} ${i + 1}`} className="block h-full w-full overflow-hidden rounded-xl">
                  <MediaTile item={m} />
                </button>

                {confirmId === m.id ? (
                  <div className="absolute inset-0 flex flex-col items-stretch justify-center gap-1.5 rounded-xl bg-ink/85 p-2">
                    <button onClick={() => remove(m.id)} disabled={deleting} className="rounded-lg bg-hibiscus px-2 py-2 text-xs font-semibold text-white">
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                    <button onClick={() => setConfirmId(null)} className="rounded-lg bg-white/20 px-2 py-2 text-xs font-semibold text-white">Keep</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(m.id)}
                    aria-label={`Delete ${m.kind} ${i + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <Link to="/vendor" className="btn-quiet">Back to requests</Link>
      </div>

      {viewing !== null && (
        <Lightbox items={items} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} label="Your portfolio" />
      )}
    </div>
  );
}

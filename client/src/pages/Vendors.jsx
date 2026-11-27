import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, naira } from '../api.js';
import Icon from '../components/Icon.jsx';
import PortfolioSheet, { MediaTile } from '../components/PortfolioSheet.jsx';
import { VENDOR_CATEGORIES, catMeta, catLabel, tint, toneFor, initials } from '../lib/ui.js';

export default function Vendors() {
  const { id } = useParams();
  const nav = useNavigate();
  const [category, setCategory] = useState('');
  const [vendors, setVendors] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [gallery, setGallery] = useState(null);

  useEffect(() => {
    setVendors(null);
    api(`/vendors${category ? `?category=${category}` : ''}`)
      .then(setVendors)
      .catch((e) => {
        setError(e.message);
        setVendors([]);
      });
  }, [category]);

  async function book(v) {
    setBusyId(v.id);
    setError('');
    try {
      await api('/bookings', {
        method: 'POST',
        body: { event_id: id, vendor_id: v.id, total_amount: Number(v.price_from) },
      });
      nav(`/events/${id}`);
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  }

  return (
    <div>
      <header className="flex items-center gap-3 px-5 pt-6 md:pt-10">
        <Link to={`/events/${id}`} aria-label="Back to event" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white">
          <Icon name="back" />
        </Link>
        <h1 className="display text-2xl">Find vendors</h1>
      </header>

      {gallery && <PortfolioSheet vendor={gallery} onClose={() => setGallery(null)} />}

      <div className="mt-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Vendor category">
        <button
          onClick={() => setCategory('')}
          aria-pressed={category === ''}
          className={`chip ${category === '' ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
        >
          <Icon name="grid" size={15} />
          All
        </button>
        {VENDOR_CATEGORIES.map((c) => {
          const on = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={on}
              className={`chip ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
            >
              <Icon name={catMeta(c).icon} size={15} />
              {catLabel(c)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2">
        {vendors === null && (
          <div className="animate-pulse space-y-3 sm:col-span-2" aria-busy="true">
            <div className="h-40 rounded-2xl bg-ink/10" />
            <div className="h-40 rounded-2xl bg-ink/10" />
          </div>
        )}

        {vendors && vendors.length === 0 && !error && (
          <div className="card p-5 sm:col-span-2">
            <p className="font-semibold">No vendors here yet</p>
            <p className="mt-1 text-sm text-ink/65">Try another category. New vendors are joining all the time.</p>
          </div>
        )}

        {vendors?.map((v) => {
          const tone = toneFor(v.business_name);
          return (
            <article key={v.id} className="card flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold" style={{ background: tint(tone), color: tone }}>
                  {initials(v.business_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{v.business_name}</h2>
                  {v.verified && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-leaf-deep">
                      <Icon name="check" size={13} />
                      Verified by Lyf
                    </p>
                  )}
                  <p className="text-sm text-ink/60">{catLabel(v.category)} in {v.city}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-tint px-2.5 py-1 text-sm font-semibold text-gold-deep">
                  <Icon name="star" size={13} filled />
                  {Number(v.rating) > 0 ? Number(v.rating).toFixed(1) : 'New'}
                  {v.review_count > 0 && <span className="font-normal">({v.review_count})</span>}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink/70">{v.description}</p>

              {v.media_count > 0 && (
                <button
                  onClick={() => setGallery(v)}
                  aria-label={`See ${v.media_count} photos and videos from ${v.business_name}`}
                  className="mt-3 block w-full text-left"
                >
                  <span className="grid grid-cols-4 gap-1.5">
                    {v.preview.slice(0, 4).map((m, i) => (
                      <span key={m.id} className="relative block aspect-square overflow-hidden rounded-xl">
                        <MediaTile item={m} />
                        {i === 3 && v.media_count > 4 && (
                          <span className="absolute inset-0 flex items-center justify-center bg-ink/65 text-lg font-bold text-white">
                            +{v.media_count - 3}
                          </span>
                        )}
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold">
                    See their work
                    <Icon name="chevron" size={16} />
                  </span>
                </button>
              )}
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <p>
                  <span className="text-sm text-ink/60">From </span>
                  <span className="text-lg font-bold">{naira(v.price_from)}</span>
                </p>
                <button className="btn-quiet !w-auto !border-ink !px-4 !py-2.5 !text-sm" disabled={busyId === v.id} onClick={() => book(v)}>
                  {busyId === v.id ? 'Requesting…' : 'Request booking'}
                </button>
              </div>
            </article>
          );
        })}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep sm:col-span-2">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { VENDOR_CATEGORIES, catMeta, catLabel } from '../lib/ui.js';

const num = (v) => String(v ?? '').replace(/\D/g, '');

export default function VendorSetup() {
  const nav = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    business_name: '', category: '', city: 'Lagos', price_from: '', price_to: '', description: '', contact_phone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/vendor/me')
      .then((v) => {
        if (v) {
          setEditing(true);
          setF({
            business_name: v.business_name || '',
            category: v.category || '',
            city: v.city || 'Lagos',
            price_from: String(v.price_from ?? ''),
            price_to: v.price_to ? String(v.price_to) : '',
            description: v.description || '',
            contact_phone: v.contact_phone || '',
          });
        }
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
  }, []);

  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!f.business_name.trim()) return setError('Enter your business name.');
    if (!f.category) return setError('Pick what you offer.');
    if (!Number(f.price_from)) return setError('Enter the lowest price you charge.');
    setBusy(true);
    try {
      await api('/vendor/profile', {
        method: 'POST',
        body: { ...f, price_from: Number(f.price_from), price_to: f.price_to ? Number(f.price_to) : null },
      });
      nav(editing ? '/vendor' : '/vendor/portfolio');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (!loaded) return <p className="px-5 pt-10 text-ink/60">Loading…</p>;

  return (
    <div className="pb-12">
      <header className="px-5 pt-8 md:pt-12">
        <h1 className="display text-3xl sm:text-4xl">{editing ? 'Edit your business' : 'Set up your business'}</h1>
        <p className="mt-2 max-w-[46ch] text-ink/65">
          Planners see this when they look for vendors. You decide the final price on every request.
        </p>
      </header>

      <form onSubmit={save} className="space-y-5 px-5 pt-7">
        <div>
          <label htmlFor="biz" className="mb-1.5 block text-sm font-medium">Business name</label>
          <input id="biz" className="field" placeholder="Kemi Lens Studio" value={f.business_name} onChange={set('business_name')} />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">What do you offer?</legend>
          <div className="flex flex-wrap gap-2">
            {VENDOR_CATEGORIES.map((c) => {
              const on = f.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setF((p) => ({ ...p, category: c }))}
                  className={`chip ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
                >
                  <Icon name={catMeta(c).icon} size={15} />
                  {catLabel(c)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-medium">City</label>
          <input id="city" className="field" value={f.city} onChange={set('city')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="from" className="mb-1.5 block text-sm font-medium">Lowest price (₦)</label>
            <input id="from" className="field" inputMode="numeric" placeholder="50,000"
              value={f.price_from ? Number(f.price_from).toLocaleString('en-NG') : ''}
              onChange={(e) => setF((p) => ({ ...p, price_from: num(e.target.value) }))} />
          </div>
          <div>
            <label htmlFor="to" className="mb-1.5 block text-sm font-medium">Highest price (₦)</label>
            <input id="to" className="field" inputMode="numeric" placeholder="200,000"
              value={f.price_to ? Number(f.price_to).toLocaleString('en-NG') : ''}
              onChange={(e) => setF((p) => ({ ...p, price_to: num(e.target.value) }))} />
          </div>
        </div>

        <div>
          <label htmlFor="desc" className="mb-1.5 block text-sm font-medium">What should planners know?</label>
          <textarea id="desc" rows={3} className="field" placeholder="Weddings and engagements. Two shooters, edited photos in 7 days."
            value={f.description} onChange={set('description')} />
        </div>

        <div>
          <label htmlFor="cphone" className="mb-1.5 block text-sm font-medium">WhatsApp number</label>
          <input id="cphone" className="field" inputMode="tel" placeholder="08012345678"
            value={f.contact_phone} onChange={set('contact_phone')} />
          <p className="mt-1.5 text-sm text-ink/55">Planners only see this after you accept their request.</p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish my business'}</button>
        {editing && <button type="button" className="btn-quiet" onClick={() => nav('/vendor')}>Cancel</button>}
      </form>
    </div>
  );
}

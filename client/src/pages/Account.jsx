import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api.js';
import Icon from '../components/Icon.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function Account() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [f, setF] = useState({ name: '', email: '', phone: '', current_password: '', password: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/me').then((u) => {
      setMe(u);
      setF((p) => ({ ...p, name: u.name || '', email: u.email || '', phone: (u.phone || '').replace('+234', '0') }));
    }).catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const body = { name: f.name, email: f.email, phone: f.phone };
      if (f.password) {
        body.password = f.password;
        body.current_password = f.current_password;
      }
      const u = await api('/me/credentials', { method: 'POST', body });
      setMe(u);
      setF((p) => ({ ...p, current_password: '', password: '' }));
      setMsg('Saved.');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (!me) return error ? <p role="alert" className="m-5 rounded-2xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">{error}</p> : <Skeleton />;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="px-5 pt-8">
      <h1 className="display text-3xl">Account</h1>
      <p className="mt-1 text-ink/65">{me.email || 'Add an email so you can sign in again.'}</p>

      <form onSubmit={save} className="mt-6 space-y-4 card p-5">
        <div>
          <label htmlFor="a-name" className="mb-1.5 block text-sm font-medium">Name</label>
          <input id="a-name" className="field" value={f.name} onChange={set('name')} />
        </div>
        <div>
          <label htmlFor="a-email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="a-email" type="email" className="field" placeholder="you@example.com" value={f.email} onChange={set('email')} />
          <p className="mt-1.5 text-sm text-ink/55">We send booking updates and password resets here.</p>
        </div>
        <div>
          <label htmlFor="a-phone" className="mb-1.5 block text-sm font-medium">WhatsApp number <span className="font-normal text-ink/50">(optional)</span></label>
          <input id="a-phone" inputMode="tel" className="field" placeholder="08012345678" value={f.phone} onChange={set('phone')} />
          <p className="mt-1.5 text-sm text-ink/55">Shared only after a booking is accepted.</p>
        </div>
        {me.has_password && (
          <div>
            <label htmlFor="a-cur" className="mb-1.5 block text-sm font-medium">Current password</label>
            <input id="a-cur" type="password" autoComplete="current-password" className="field" value={f.current_password} onChange={set('current_password')} />
          </div>
        )}
        <div>
          <label htmlFor="a-pass" className="mb-1.5 block text-sm font-medium">{me.has_password ? 'New password' : 'Add a password'}</label>
          <input id="a-pass" type="password" autoComplete="new-password" className="field" value={f.password} onChange={set('password')} />
          <p className="mt-1.5 text-sm text-ink/55">
            {me.has_password ? 'Leave blank to keep your current password.' : 'Optional. You can always sign in with a code emailed to you.'}
          </p>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-hibiscus-deep">{error}</p>}
        {msg && <p role="status" className="text-sm font-medium text-leaf-deep">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

      <button
        onClick={() => { clearToken(); nav('/login'); }}
        className="btn-quiet mt-4"
      >
        <Icon name="logout" size={18} />
        Sign out
      </button>
    </div>
  );
}

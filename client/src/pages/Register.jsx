import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, signIn } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

const ROLES = [
  ['planner', 'I am planning an event'],
  ['vendor', 'I am a vendor'],
];

export default function Register() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'vendor' ? 'vendor' : 'planner');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      nav(signIn(await api('/auth/register', { method: 'POST', body: { ...f, role } })));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <AuthShell
      title="Create your account"
      sub={role === 'vendor' ? 'List your business and get booking requests from planners.' : 'Set a budget, find vendors and book in one place.'}
      error={error}
    >
      <form onSubmit={submit} className="space-y-4">
        <div role="group" aria-label="Account type" className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
          {ROLES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={role === value}
              onClick={() => setRole(value)}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${role === value ? 'bg-white text-ink shadow-sm ring-1 ring-line' : 'text-ink/60'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="r-name" className="mb-1.5 block text-sm font-medium">Your name</label>
          <input id="r-name" autoComplete="name" className="field" placeholder="Victor Okoh" value={f.name} onChange={set('name')} />
        </div>
        <div>
          <label htmlFor="r-email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="r-email" type="email" autoComplete="email" className="field" placeholder="you@example.com" value={f.email} onChange={set('email')} />
        </div>
        <div>
          <label htmlFor="r-pass" className="mb-1.5 block text-sm font-medium">Password</label>
          <input id="r-pass" type="password" autoComplete="new-password" className="field" value={f.password} onChange={set('password')} />
          <p className="mt-1.5 text-sm text-ink/55">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="r-phone" className="mb-1.5 block text-sm font-medium">WhatsApp number <span className="font-normal text-ink/50">(optional)</span></label>
          <input id="r-phone" inputMode="tel" autoComplete="tel" className="field" placeholder="08012345678" value={f.phone} onChange={set('phone')} />
          <p className="mt-1.5 text-sm text-ink/55">Shared only after a vendor accepts a booking.</p>
        </div>
        <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="pt-2 text-center text-ink/70">
          Already have an account? <Link to="/login" className="font-semibold text-ink underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, signIn } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ResetPassword() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      nav(signIn(await api('/auth/reset', { method: 'POST', body: { token, password } })));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <AuthShell title="Choose a new password" error={error}>
      {!token ? (
        <div className="space-y-4">
          <p className="text-ink/70">This reset link is incomplete. Request a new one.</p>
          <Link to="/forgot-password" className="btn">Request a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="n-pass" className="mb-1.5 block text-sm font-medium">New password</label>
            <input id="n-pass" type="password" autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1.5 text-sm text-ink/55">At least 8 characters.</p>
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save and sign in'}</button>
        </form>
      )}
    </AuthShell>
  );
}

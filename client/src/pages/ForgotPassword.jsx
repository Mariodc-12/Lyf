import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <AuthShell title="Forgot your password?" sub="We email you a link to choose a new one." error={error}>
      {sent ? (
        <div className="space-y-4">
          <h2 className="display text-2xl">Check your email</h2>
          <p className="text-ink/70">
            If {email} has a Lyf account, a reset link is on its way. It works for 60 minutes. Check your spam folder if you don't see it.
          </p>
          <Link to="/login" className="btn">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="f-email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input id="f-email" type="email" autoComplete="email" className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <Link to="/login" className="btn-quiet">Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  );
}

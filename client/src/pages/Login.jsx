import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, signIn } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState('password'); // password | code | verify
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  const loginWithPassword = (e) => {
    e.preventDefault();
    run(async () => nav(signIn(await api('/auth/login', { method: 'POST', body: { email, password } }))));
  };
  const requestCode = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/auth/request-code', { method: 'POST', body: { email } });
      setCode('');
      setMode('verify');
    });
  };
  const verify = (e) => {
    e.preventDefault();
    run(async () => nav(signIn(await api('/auth/verify-code', { method: 'POST', body: { email, code } }))));
  };
  const go = (m) => { setMode(m); setError(''); };

  const emailField = (
    <div>
      <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
      <input id="email" type="email" autoComplete="email" className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
    </div>
  );

  return (
    <AuthShell
      title={mode === 'verify' ? 'Check your email' : 'Welcome back'}
      sub={mode === 'verify' ? `If ${email} has a Lyf account, we sent it a 6-digit code. It works for 10 minutes.` : mode === 'code' ? 'We email you a 6-digit code. No password needed.' : 'Sign in to pick up your plan where you left it.'}
      error={error}
    >
      {mode === 'password' && (
        <form onSubmit={loginWithPassword} className="space-y-4">
          {emailField}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Link to="/forgot-password" className="text-sm font-medium text-ink/70 underline">Forgot password?</Link>
            </div>
            <input id="password" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="relative py-1 text-center text-sm text-ink/50">
            <span className="relative z-10 bg-white px-3">or</span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden="true" />
          </div>
          <button type="button" className="btn-quiet" onClick={() => go('code')}>Email me a sign-in code</button>
          <p className="pt-3 text-center text-ink/70">
            New to Lyf? <Link to="/register" className="font-semibold text-ink underline">Create an account</Link>
          </p>
        </form>
      )}

      {mode === 'code' && (
        <form onSubmit={requestCode} className="space-y-4">
          {emailField}
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          <button type="button" className="btn-quiet" onClick={() => go('password')}>Use my password instead</button>
        </form>
      )}

      {mode === 'verify' && (
        <form onSubmit={verify} className="space-y-4">
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">6-digit code</label>
          <input
            id="code"
            className="field text-center text-2xl font-semibold tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <button type="button" className="btn-quiet" disabled={busy} onClick={requestCode}>Send a new code</button>
          <button type="button" className="w-full text-sm font-medium text-ink/65 underline" onClick={() => go('password')}>Use my password instead</button>
        </form>
      )}
    </AuthShell>
  );
}

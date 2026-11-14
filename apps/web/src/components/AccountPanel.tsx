import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary } from '../context/LibraryContext';

const inputClass = 'w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50';
const buttonClass = 'px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

export function SessionStatus() {
  const { mode, user, error, pending, authPending, realtimeState } = useLibrary();
  return <div className="px-4 lg:px-8 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 text-xs space-y-1" aria-label="Data mode">
    <div className="flex flex-wrap justify-between gap-2">
      <span className="font-semibold">{mode === 'demo' ? 'Offline demo — changes stay in this browser' : `Connected mode — ${user ? `${user.name} (${user.role})` : 'public catalog; sign in for your account'}`}</span>
      <span className="flex gap-3 items-center">
        {pending || authPending ? <span role="status">{authPending ? 'Signing in…' : 'Saving…'}</span> : null}
        {mode === 'connected' && user && <span>Realtime: {realtimeState === 'live' ? 'live' : realtimeState === 'connecting' ? 'connecting' : 'disconnected — manual sync available'}</span>}
        <Link to="/settings" className="text-indigo-600 dark:text-indigo-400 underline">{user ? 'Account & data mode' : 'Sign in / data mode'}</Link>
      </span>
    </div>
    {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
  </div>;
}

export function AccountPanel() {
  const { mode, user, authPending, pending, isChecking, login, register, logout, enterDemo, enterConnected, realtimeState } = useLibrary();
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const busy = authPending || pending || switching;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setError(null);
    try {
      if (registering) await register({ email, password, name }); else await login({ email, password });
      setPassword('');
    } catch (failure) { setPassword(''); setError(failure instanceof Error ? failure.message : 'Sign-in failed'); }
  };
  const connect = async () => {
    setError(null); setSwitching(true);
    try { await enterConnected(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection failed'); }
    finally { setSwitching(false); }
  };
  return <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4" aria-labelledby="account-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="account-heading" className="font-bold text-lg">Account & Data Mode</h2>
      <div className="flex gap-2 flex-wrap" aria-label="Choose data mode">
        <button className={buttonClass} disabled={busy || mode === 'demo'} onClick={() => { enterDemo(); setPassword(''); setError(null); }} aria-pressed={mode === 'demo'}>Offline demo</button>
        <button className={buttonClass} disabled={busy || isChecking || mode === 'connected'} onClick={() => { void connect(); }} aria-pressed={mode === 'connected'}>Connected catalog</button>
      </div>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">Demo is a separate local sandbox and is never uploaded. Connected mode uses server records only; a reachable server alone does not enable management. Changing servers signs you out.</p>
    {user ? <div className="space-y-3">
      <p className="text-sm">Signed in as <strong>{user.name}</strong> · {user.email} · <strong>{user.role}</strong></p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{user.role === 'patron' ? 'Patron account: browse the public catalog. Member records and circulation are staff-only.' : 'Staff account: catalog, member records, circulation, activities and statistics are synchronized from the server.'} Realtime: {realtimeState}.</p>
      <button className={buttonClass} onClick={() => { logout(); setPassword(''); setError(null); }}>Sign out</button>
    </div> : <form onSubmit={submit} className="space-y-3 max-w-2xl">
      <h3 className="text-sm font-semibold">{registering ? 'Create a patron account' : 'Sign in to the library server'}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {registering && <label className="text-xs space-y-1">Name<input className={inputClass} value={name} onChange={e => setName(e.target.value)} autoComplete="name" required disabled={busy} /></label>}
        <label className="text-xs space-y-1">Email<input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required disabled={busy} /></label>
        <label className="text-xs space-y-1">Password<input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 8 : undefined} required disabled={busy} /></label>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Signing in switches to connected mode. Public registration creates a patron, not a librarian. Staff access is assigned by an administrator.</p>
      <div className="flex flex-wrap gap-3 items-center">
        <button className={buttonClass} type="submit" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="text-xs underline text-indigo-600 dark:text-indigo-400" disabled={busy} onClick={() => { setRegistering(!registering); setError(null); setPassword(''); }}>{registering ? 'Already have an account? Sign in' : 'New here? Create a patron account'}</button>
      </div>
    </form>}
    {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
  </section>;
}

export function StaffAccessNotice() {
  return <div className="p-6 space-y-3"><h1 className="text-xl font-bold">Staff access required</h1><p className="text-sm text-slate-500 dark:text-slate-400">Member records, circulation and operational analytics are available to librarians and administrators.</p><Link to="/settings" className="text-indigo-600 dark:text-indigo-400 underline">Open Settings to sign in or choose the offline demo</Link></div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseEnv } from '@/lib/env-public';
import { completePasswordRecovery, INVALID_RECOVERY, parseRecoveryCallback, recoveryErrorMessage, validateNewPassword } from '@/lib/password-recovery';
import { RecoveryShell, recoveryInputClass, recoveryButtonClass } from './RecoveryShell';

export function ResetPasswordForm() {
  const [phase, setPhase] = useState<'checking' | 'ready' | 'invalid' | 'success'>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  const initialization = useRef<Promise<void> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    if (!initialization.current) {
      initialization.current = (async () => {
        const callback = parseRecoveryCallback(window.location.href);
        // Remove the fragment and code before any network operation or rendering.
        window.history.replaceState(window.history.state, '', window.location.pathname);
        const { url, anonKey } = publicSupabaseEnv();
        // Handle both PKCE and dashboard-issued implicit links explicitly.
        // No competing automatic URL consumer; use the SDK cookie storage.
        client.current = createBrowserClient(url, anonKey, {
          isSingleton: false,
          auth: { detectSessionInUrl: false },
        });
        await completePasswordRecovery(client.current.auth, callback);
      })();
    }
    void initialization.current.then(() => {
      if (active) setPhase('ready');
    }).catch(() => {
      if (active) { setError(INVALID_RECOVERY); setPhase('invalid'); }
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || phase !== 'ready' || !client.current) return;
    const validation = validateNewPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      // Revalidate server-side identity, never authorize from local session data.
      const { data, error: userError } = await client.current.auth.getUser();
      if (userError || !data.user) { setError(INVALID_RECOVERY); setPhase('invalid'); return; }
      const { error: updateError } = await client.current.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(''); setConfirmation('');
      // Keep account/medidor IDs intact. Clear only this browser's session.
      try { await client.current.auth.signOut({ scope: 'local' }); } catch { /* Password was already saved; never report a failed update here. */ }
      setPhase('success');
    } catch (failure) {
      setError(recoveryErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <RecoveryShell title="Elegí una nueva contraseña">
    {phase === 'checking' && <p role="status" className="text-sm text-muted">Verificando el enlace de recuperación…</p>}
    {phase === 'invalid' && <div className="space-y-4"><p role="alert" className="text-sm leading-relaxed text-danger">{error}</p><Link className="inline-flex min-h-12 items-center text-sm font-semibold text-accent underline" href="/recuperar-clave">Solicitar un enlace nuevo</Link></div>}
    {phase === 'success' && <div role="status" className="space-y-3 text-sm leading-relaxed"><h2 className="font-semibold text-ok">Contraseña actualizada</h2><p>Ya podés volver a ingresar con tu nueva contraseña.</p></div>}
    {phase === 'ready' && <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      <p id="password-rules" className="text-sm text-muted">Usá al menos 8 caracteres. Tu cuenta y sus datos se conservarán.</p>
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <label htmlFor="new-password" className="block text-sm font-medium">Nueva contraseña
        <input id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={256} aria-describedby="password-rules" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className={recoveryInputClass} />
      </label>
      <label htmlFor="confirm-password" className="block text-sm font-medium">Repetí la nueva contraseña
        <input id="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={256} disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} className={recoveryInputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} />Mostrar contraseñas</label>
      <button type="submit" disabled={busy} className={recoveryButtonClass}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
    </form>}
  </RecoveryShell>;
}

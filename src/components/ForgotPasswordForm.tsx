'use client';

import { useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { recoveryErrorMessage } from '@/lib/password-recovery';
import { RecoveryShell, recoveryInputClass, recoveryButtonClass } from './RecoveryShell';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || sent) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer-clave`,
      });
      if (error) throw error;
      setSent(true);
    } catch (failure) {
      setError(recoveryErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <RecoveryShell title="Recuperá tu acceso">
    {sent ? <div role="status" className="space-y-3 text-sm leading-relaxed">
      <h2 className="font-semibold text-ok">Revisá tu correo</h2>
      <p>Si existe una cuenta con ese email, recibirás un enlace para elegir una nueva contraseña. Revisá también la carpeta de spam.</p>
      <p className="text-muted">Abrí el enlace en este mismo navegador. Si no llega, esperá unos minutos antes de volver a solicitarlo.</p>
    </div> : <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      <p className="text-sm leading-relaxed text-muted">Te enviaremos un enlace para restablecer la contraseña de tu cuenta.</p>
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <label className="block text-sm font-medium" htmlFor="recovery-email">Email
        <input id="recovery-email" type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className={recoveryInputClass} />
      </label>
      <button disabled={busy} type="submit" className={recoveryButtonClass}>{busy ? 'Enviando…' : 'Enviar enlace de recuperación'}</button>
    </form>}
  </RecoveryShell>;
}

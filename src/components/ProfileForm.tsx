'use client';

import { useCallback, useState } from 'react';
import { Check, Save, UserRound } from 'lucide-react';
import { EMPTY_PROFILE, PROFILE_MAX_LENGTH, type Profile } from '@/lib/profile-types';
import { usePolling } from '@/lib/use-polling';

/** Los datos personales no cambian solos: alcanza con cargarlos al entrar. */
const POLL_INTERVAL_MS = 600000;

const FIELDS: { key: keyof Profile; label: string; type: string; autoComplete: string; placeholder: string }[] = [
  { key: 'firstName', label: 'Nombre', type: 'text', autoComplete: 'given-name', placeholder: 'Cristian' },
  { key: 'lastName', label: 'Apellido', type: 'text', autoComplete: 'family-name', placeholder: 'Sombra' },
  { key: 'phone', label: 'Teléfono', type: 'tel', autoComplete: 'tel', placeholder: '+54 9 11 5555-5555' },
  { key: 'address', label: 'Domicilio', type: 'text', autoComplete: 'street-address', placeholder: 'Calle 123, Ciudad' },
];

export function ProfileForm() {
  const [saved, setSaved] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'No se pudo cargar el perfil.');
        return;
      }

      setEmail(payload.email ?? null);
      setSaved(payload.profile as Profile);
      // Solo se completa el formulario la primera vez: recargar no debe
      // pisar lo que el usuario está escribiendo.
      setDraft((current) => (current === EMPTY_PROFILE ? (payload.profile as Profile) : current));
      setError(null);
    } catch {
      setError('No se pudo contactar al servidor.');
    }
  }, []);

  usePolling(fetchProfile, POLL_INTERVAL_MS);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setJustSaved(false);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'No se pudo guardar.');
        return;
      }

      setSaved(payload.profile as Profile);
      setDraft(payload.profile as Profile);
      setJustSaved(true);
      setError(null);
    } catch {
      setError('No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  const dirty = saved !== null && FIELDS.some(({ key }) => draft[key] !== saved[key]);

  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <UserRound className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Mis datos</h2>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-5">
        {email
          ? `Cuenta: ${email}. Estos datos identifican al titular del servicio.`
          : 'Datos del titular del servicio.'}
      </p>

      {error && (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 mb-5">
          {FIELDS.map(({ key, label, type, autoComplete, placeholder }) => (
            <label key={key} className={`block ${key === 'address' ? 'sm:col-span-2' : ''}`}>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
              </span>
              <input
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                maxLength={PROFILE_MAX_LENGTH}
                value={draft[key]}
                onChange={(e) => setDraft((current) => ({ ...current, [key]: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border-soft">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando…' : 'Guardar datos'}
          </button>

          {justSaved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ok">
              <Check className="h-4 w-4" />
              Datos guardados.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

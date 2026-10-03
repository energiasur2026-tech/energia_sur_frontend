'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LogIn, UserPlus, Zap } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';

type Mode = 'login' | 'register';

const COPY: Record<Mode, { title: string; cta: string; icon: typeof LogIn; switchHref: string; switchLabel: string }> = {
  login: {
    title: 'Ingresá a tu cuenta',
    cta: 'Ingresar',
    icon: LogIn,
    switchHref: '/register',
    switchLabel: '¿No tenés cuenta? Creá una',
  },
  register: {
    title: 'Creá tu cuenta',
    cta: 'Crear cuenta',
    icon: UserPlus,
    switchHref: '/login',
    switchLabel: '¿Ya tenés cuenta? Ingresá',
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const copy = COPY[mode];
  const Icon = copy.icon;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push('/dashboard');
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      if (!data.session) {
        // El proyecto tiene confirmación por email activada: no hay sesión
        // todavía hasta que se confirme la cuenta.
        setNotice('Cuenta creada. Revisá tu email para confirmarla antes de ingresar.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <section className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <span className="h-12 w-12 rounded-xl bg-accent-soft border border-accent/30 flex items-center justify-center">
            <Zap className="h-6 w-6 text-accent" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">EnergIA Sur</h1>
            <p className="text-sm text-muted">{copy.title}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-border-soft bg-surface p-6 space-y-4">
          {error && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
              {notice}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contraseña</span>
            <span className="relative mt-1.5 block">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // Espacio a la derecha para que el texto no pase por debajo del ojo.
                className="w-full rounded-xl border border-border-soft bg-surface-raised py-2.5 pl-3 pr-11 text-sm text-foreground outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-60"
          >
            <Icon className="h-4 w-4" />
            {loading ? 'Un momento…' : copy.cta}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link href={copy.switchHref} className="text-accent hover:underline">
            {copy.switchLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}

function mapAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (message.includes('User already registered')) return 'Ya existe una cuenta con ese email.';
  if (message.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';

  return 'No se pudo completar la operación. Intentá de nuevo.';
}

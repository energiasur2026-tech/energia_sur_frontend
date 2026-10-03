import { AlertTriangle } from 'lucide-react';

/**
 * Pantalla que se muestra cuando el servidor arranca sin credenciales.
 * Nombra las variables faltantes, sin revelar el valor de ninguna.
 */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-warn/40 bg-surface p-6">
        <header className="flex items-center gap-3 mb-4">
          <span className="h-10 w-10 rounded-xl bg-warn/10 border border-warn/30 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warn" />
          </span>
          <h1 className="text-lg font-bold">Falta configurar el servidor</h1>
        </header>

        <p className="text-sm text-muted mb-4">
          Estas variables de entorno no están definidas. Cargalas en{' '}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs">.env.local</code> y
          reiniciá el servidor de desarrollo.
        </p>

        <ul className="space-y-1.5">
          {missing.map((key) => (
            <li
              key={key}
              className="rounded-lg bg-surface-raised px-3 py-2 font-mono text-xs text-foreground"
            >
              {key}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

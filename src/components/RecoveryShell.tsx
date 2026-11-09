import Link from 'next/link';
import { Zap } from 'lucide-react';

export const recoveryInputClass = 'mt-1.5 w-full rounded-xl border border-border-soft bg-surface-raised px-3 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent';
export const recoveryButtonClass = 'w-full min-h-12 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-60 disabled:cursor-not-allowed';

export function RecoveryShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="flex flex-1 items-center justify-center p-5 sm:p-6">
    <section className="w-full max-w-md" aria-labelledby="recovery-title">
      <div className="mb-7 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent-soft"><Zap aria-hidden="true" className="h-6 w-6 text-accent" /></span>
        <div><p className="text-2xl font-bold tracking-tight">EnergIA Sur</p><h1 id="recovery-title" className="text-sm text-muted">{title}</h1></div>
      </div>
      <div className="space-y-5 rounded-2xl border border-border-soft bg-surface p-6">{children}</div>
      <p className="mt-5 text-center text-sm"><Link href="/login" className="inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Volver a ingresar</Link></p>
    </section>
  </main>;
}

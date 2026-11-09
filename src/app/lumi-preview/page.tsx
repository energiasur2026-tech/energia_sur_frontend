import { notFound } from 'next/navigation';
import { LumiAvatar } from '@/components/lumi/LumiAvatar';
import { LUMI_LABELS, LUMI_STATES } from '@/components/lumi/lumi-state';

export const metadata = { title: 'Lumi · Vista previa de diseño', robots: { index: false, follow: false } };

/** Development-only gallery. No mock events or state selector enter production. */
export default function LumiPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main className="mx-auto max-w-5xl px-5 py-10">
    <p className="text-xs font-semibold uppercase tracking-widest text-accent">EnergIA Sur · Forza Tech</p>
    <h1 className="mt-3 text-3xl font-bold">Lumi, tu asistente energético</h1>
    <p className="mt-3 text-sm text-muted">Vista previa de diseño · Los estados de esta galería son demostraciones, no avisos reales.</p>
    <div className="my-8 grid grid-cols-2 gap-4 md:grid-cols-3">
      {LUMI_STATES.map(state => <figure key={state} className="rounded-2xl border border-border-soft bg-surface p-5 text-center">
        <LumiAvatar state={state} />
        <figcaption className="mt-3 text-sm font-semibold">{LUMI_LABELS[state]}<code className="mt-1 block text-xs font-normal text-muted">{state}</code></figcaption>
      </figure>)}
    </div>
    <section className="rounded-2xl border border-border-soft bg-surface p-6">
      <h2 className="font-semibold">Botón compacto · Cabeza y rayo</h2>
      <div className="mt-5 flex flex-wrap gap-6">{LUMI_STATES.map(state => <div key={state} className="text-center"><LumiAvatar state={state} compact /><p className="mt-2 text-xs text-muted">{state}</p></div>)}</div>
      <p className="mt-5 text-xs text-muted">72 px · Los indicadores se renderizan desde la interfaz. Movimiento reducido según la preferencia del sistema.</p>
    </section>
  </main>;
}

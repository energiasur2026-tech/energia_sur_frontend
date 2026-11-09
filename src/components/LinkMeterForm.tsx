'use client';

import { useState } from 'react';
import { Link2, Plus, RotateCw, X } from 'lucide-react';
import { PHASE_LABEL, type MeterPhases } from '@/domain/installation-types';
import { InfoTooltip } from './InfoTooltip';

/**
 * Alta de un medidor en la cuenta.
 *
 * El identificador es lo que más fricción genera: no es algo que la gente
 * sepa de memoria ni pueda deducir. Por eso la pantalla dice **dónde
 * encontrarlo** en vez de limitarse a pedirlo.
 *
 * Los mensajes de error se muestran **tal como los devuelve el backend**:
 * están escritos en castellano y pensados para quien los va a leer.
 * Reescribirlos acá solo agregaría una segunda versión que se desactualiza.
 *
 * La única distinción que hace esta pantalla es entre "revisá lo que
 * escribiste" y "no es tu culpa": un 502 es Tuya sin responder, y ahí lo
 * único sensato es ofrecer reintentar. Tratarlo igual que un identificador
 * equivocado mandaría a buscar un error que no existe.
 *
 * El aviso de éxito **no se muestra acá**: se informa hacia arriba y lo
 * dibuja la pantalla. Vincular el primer medidor cambia la lista, y eso
 * vuelve a montar este componente: un mensaje guardado en su estado se
 * perdía a los dos segundos, justo el que dice cuántas mediciones
 * anteriores se recuperaron. Arriba sobrevive, y además los dos avisos
 * —alta y baja— quedan en el mismo lugar.
 */

export type LinkResult = {
  name: string;
  existingReadings: number;
};

export function LinkMeterForm({ onLinked }: { onLinked: (result: LinkResult) => void }) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [phases, setPhases] = useState<MeterPhases>(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** `true` cuando el error es de Tuya y reintentar tiene sentido. */
  const [retryable, setRetryable] = useState(false);

  async function submit() {
    // El backend también limpia, pero si alguien pega algo con un salto de
    // línea conviene que lo vea limpio acá antes de mandarlo.
    const id = deviceId.trim();
    if (id === '') {
      setError('Escribí el identificador del medidor.');
      setRetryable(false);
      return;
    }

    setSaving(true);
    setError(null);
    setRetryable(false);

    try {
      const response = await fetch('/api/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: id,
          name: name.trim() === '' ? undefined : name.trim(),
          phases,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'No se pudo vincular el medidor.');
        // Solo Tuya sin responder se reintenta. Un identificador equivocado
        // no mejora por insistir.
        setRetryable(response.status === 502);
        return;
      }

      setDeviceId('');
      setName('');
      setPhases(1);
      setOpen(false);
      onLinked({
        name: payload.meter.name as string,
        existingReadings: Number(payload.existingReadings ?? 0),
      });
    } catch {
      setError('No se pudo contactar al servidor.');
      setRetryable(true);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-soft px-4 py-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" />
        Vincular un medidor
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-accent/40 bg-surface p-4 md:p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Vincular un medidor</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          aria-label="Cancelar"
          className="ml-auto text-muted transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">
        Sumá a tu cuenta un medidor que ya esté instalado y funcionando.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-sm text-danger leading-relaxed">{error}</p>
          {retryable && (
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Probar de nuevo
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            Identificador del medidor
            <InfoTooltip
              title="Dónde encontrarlo"
              text="Es un código largo de letras y números que identifica al equipo. Está impreso en una etiqueta del medidor y también en la caja en la que vino. No es el número de medidor de la factura de luz."
            />
          </span>
          <input
            type="text"
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            placeholder="Ej: eb5095128f6c50f96akbbq"
            autoComplete="off"
            spellCheck={false}
            className="mt-1.5 h-11 w-full rounded-xl border border-border-soft bg-surface-raised px-3 font-mono text-sm text-foreground outline-none focus:border-accent"
          />
          <span className="mt-1.5 block text-[11px] text-muted leading-relaxed">
            Está impreso en una etiqueta del equipo y en su caja.
          </span>
        </label>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Nombre (opcional)
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej: Tablero principal"
            maxLength={60}
            className="mt-1.5 h-11 w-full rounded-xl border border-border-soft bg-surface-raised px-3 text-sm text-foreground outline-none focus:border-accent"
          />
          <span className="mt-1.5 block text-[11px] text-muted leading-relaxed">
            Para distinguirlo de los demás. Si lo dejás vacío se llama &quot;Medidor&quot;.
          </span>
        </label>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Tipo de equipo
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {([1, 3] as MeterPhases[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPhases(option)}
                aria-pressed={phases === option}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  phases === option
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-soft bg-surface-raised text-foreground hover:border-muted/40'
                }`}
              >
                {PHASE_LABEL[option]}
              </button>
            ))}
          </div>
          <span className="mt-1.5 block text-[11px] text-muted leading-relaxed">
            Si no sabés cuál es, dejá monofásico. Se puede cambiar después.
          </span>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-60"
        >
          {saving ? 'Vinculando…' : 'Vincular medidor'}
        </button>
      </form>
    </section>
  );
}

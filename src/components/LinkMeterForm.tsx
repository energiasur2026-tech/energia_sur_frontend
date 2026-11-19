'use client';

import { useState } from 'react';
import { Link2, RotateCw, X } from 'lucide-react';
import { PHASE_LABEL, type MeterPhases } from '@/domain/installation-types';
import { DeviceArt, deviceKinds, type DeviceKind } from './DeviceArt';
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
  deviceId: string;
  supply: string;
  existingReadings: number;
};

export function LinkMeterForm({ onLinked, onClose, supplies }: {
  onLinked: (result: LinkResult) => void;
  onClose: () => void;
  supplies: string[];
}) {
  const [step,setStep]=useState(1);
  const [kind,setKind]=useState<DeviceKind>('general');
  const [supply,setSupply]=useState(supplies.length===1?supplies[0]:'');
  const [area,setArea]=useState('');
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
    if (saving||kind==='plug') return;
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
          ...(kind==='circuit'?{role:'area',areaLabel:area.trim()}:{}),
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
      onLinked({
        name: payload.meter.name as string,
        deviceId:payload.meter.deviceId as string,
        supply:supply.trim(),
        existingReadings: Number(payload.existingReadings ?? 0),
      });
    } catch {
      setError('No se pudo contactar al servidor.');
      setRetryable(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Vincular dispositivo" className="mb-6 rounded-2xl border border-border-soft bg-surface p-4 md:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-accent" />
        <h2 className="font-semibold">Vincular dispositivo</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Cancelar"
          className="ml-auto text-muted transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-4 text-xs text-muted" aria-live="polite">Paso {step} de 5 · {['Tipo de dispositivo','Suministro','Identificador','Personalización','Confirmación'][step-1]}</p>

      {step===1&&<div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(deviceKinds) as DeviceKind[]).map(option=><button key={option} type="button" aria-pressed={kind===option}
          onClick={()=>setKind(option)} className={'rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-accent '+(kind===option?'border-accent bg-accent-soft':'border-border-soft')}>
          <DeviceArt kind={option} className="mx-auto h-20 w-full" decorative/>
          <span className="block text-sm font-semibold">{deviceKinds[option].label}</span>
          <span className="mt-1 block text-xs text-muted">{deviceKinds[option].description}</span>
        </button>)}
      </div>}
      {step===1&&kind==='plug'&&<p role="status" className="mt-3 text-sm text-muted">El flujo actual valida medidores Tuya. La compatibilidad de enchufes inteligentes con las lecturas todavía está pendiente.</p>}
      {step===2&&<label className="block text-sm">Suministro o lugar
        <input value={supply} onChange={event=>setSupply(event.target.value)} list="link-supplies" maxLength={60} className="mt-2 block w-full max-w-md rounded-xl border border-border-soft bg-surface-raised p-3" placeholder="Ej.: Casa o local"/>
        <datalist id="link-supplies">{supplies.map(value=><option key={value} value={value}/>)}</datalist>
        <span className="mt-2 block text-xs text-muted">Elegí un lugar existente, escribí uno nuevo o dejalo sin asignar. Se usa para organizar tus dispositivos en este navegador.</span>
      </label>}

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
          if(step===5)void submit();
        }}
        className="space-y-4"
      >
        {step===3&&<label className="block">
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
            placeholder="Identificador impreso en el equipo"
            autoComplete="off"
            spellCheck={false}
            className="mt-1.5 h-11 w-full rounded-xl border border-border-soft bg-surface-raised px-3 font-mono text-sm text-foreground outline-none focus:border-accent"
          />
          <span className="mt-1.5 block text-[11px] text-muted leading-relaxed">
            Está impreso en una etiqueta del equipo y en su caja.
          </span>
        </label>}

        {step===4&&<>
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

        {kind==='circuit'&&<label className="block text-sm">Circuito o ambiente
          <input value={area} onChange={event=>setArea(event.target.value)} maxLength={40} className="mt-2 block w-full rounded-xl border border-border-soft bg-surface-raised p-3" placeholder="Ej.: Cocina"/>
        </label>}
        </>}
        {step===5&&<div className="rounded-xl bg-surface-raised p-4 text-sm">
          <p className="font-semibold">{name.trim()||'Medidor'} · {deviceKinds[kind].label}</p>
          <p className="mt-1 text-muted">{supply.trim()||'Sin suministro asignado'}{area.trim()?' · '+area.trim():''} · {PHASE_LABEL[phases]}</p>
          <p className="mt-2 text-muted">Se verificará el identificador en Tuya antes de vincular el equipo.</p>
        </div>}
        <div className="flex flex-wrap justify-end gap-3">
          {step>1&&<button type="button" disabled={saving} className="rounded-xl border border-border-soft px-4 py-2 text-sm" onClick={()=>{setError(null);setStep(step-1);}}>Atrás</button>}
          {step<5?<button type="button" disabled={kind==='plug'||step===3&&!deviceId.trim()||step===4&&kind==='circuit'&&!area.trim()}
            onClick={()=>setStep(step+1)} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Continuar</button>:
            <button type="submit" disabled={saving} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving?'Verificando…':'Confirmar y vincular'}
            </button>}
        </div>
      </form>
    </section>
  );
}

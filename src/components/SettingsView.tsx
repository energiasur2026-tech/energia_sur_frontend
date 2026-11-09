'use client';

import { useCallback, useState } from 'react';
import { Bell, Check, Database, Gauge, MapPin, Palette, Save, SlidersHorizontal } from 'lucide-react';
import {
  COLLECTION_INTERVALS,
  intervalLabel,
  rowsPerDay,
} from '@/lib/collection-intervals';
import { PHASE_LABEL, type MeterPhases } from '@/domain/installation-types';
import { MAX_AREA_LABEL_LENGTH, ROLE_LABEL, type MeterRole } from '@/domain/meter-role';
import {
  THRESHOLD_LIMITS,
  SELECTABLE_SENSITIVITIES,
  SENSITIVITY_DESCRIPTION,
  SENSITIVITY_LABEL,
  SENSITIVITY_RANGES,
  type Sensitivity,
} from '@/domain/sensitivity';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { ApiErrorPayload } from '@/lib/types';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { ProfileForm } from './ProfileForm';
import { ReplaceThresholdsDialog } from './ReplaceThresholdsDialog';
import { ThemeToggle } from './ThemeToggle';
import { SetupNotice } from './SetupNotice';

type Settings = {
  deviceId: string;
  name: string;
  collectionIntervalMinutes: number;
  alertsEnabled: boolean;
  thresholds: MeterThresholds;
  sensitivity: Sensitivity;
  role: MeterRole;
  areaLabel: string | null;
  phases: MeterPhases;
};

/** Solo se recarga si algo cambió por fuera; no es una pantalla en vivo. */
const POLL_INTERVAL_MS = 300000;

export function SettingsView() {
  // De qué medidor habla esta pantalla. Lo dice la dirección del navegador.
  const deviceId = useMeterId();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // La ubicación se edita con un formulario propio: el nombre del área es
  // texto libre y guardar en cada tecla no tiene sentido.
  const [placement, setPlacement] = useState<{ role: MeterRole; areaLabel: string } | null>(null);
  const [savingPlacement, setSavingPlacement] = useState(false);
  /** Grado elegido que todavía espera confirmación, por pisar umbrales a mano. */
  const [pendingSensitivity, setPendingSensitivity] = useState<Sensitivity | null>(null);
  /** Formulario de umbrales propios: `null` mientras está cerrado. */
  const [ownRange, setOwnRange] = useState<{ low: string; high: string } | null>(null);
  const [savingRange, setSavingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      const next = payload as Settings;
      setSettings(next);
      // No pisa una selección que el usuario todavía no guardó.
      setSelected((current) => current ?? next.collectionIntervalMinutes);
      setPlacement(
        (current) => current ?? { role: next.role, areaLabel: next.areaLabel ?? '' }
      );
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, [deviceId]);

  usePolling(fetchSettings, POLL_INTERVAL_MS);

  /** El interruptor guarda al instante: no tiene sentido pedir confirmación. */
  async function onToggleAlerts(enabled: boolean) {
    setSettings((current) => (current ? { ...current, alertsEnabled: enabled } : current));

    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertsEnabled: enabled }),
      });

      if (!response.ok) throw new Error('rechazado');
    } catch {
      // Revierte el interruptor para no mostrar un estado que no se guardó.
      setSettings((current) => (current ? { ...current, alertsEnabled: !enabled } : current));
      setError({ error: 'No se pudo guardar la preferencia de avisos.' });
    }
  }

  /**
   * Dónde está instalado el medidor.
   *
   * Cambiar el rol puede invalidar el contexto ya cargado —los tipos de un
   * central no son los de un área— así que el backend rechaza la combinación
   * cruzada y el aviso de abajo manda al asistente a rehacerlo.
   */
  async function onSavePlacement() {
    if (!placement) return;
    setSavingPlacement(true);

    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: placement.role,
          areaLabel: placement.role === 'area' ? placement.areaLabel.trim() : undefined,
        }),
      });

      if (!response.ok) {
        setError((await response.json()) as ApiErrorPayload);
        return;
      }

      setSettings((current) =>
        current
          ? {
              ...current,
              role: placement.role,
              areaLabel: placement.role === 'area' ? placement.areaLabel.trim() : null,
            }
          : current
      );
      setError(null);
    } catch {
      setError({ error: 'No se pudo guardar la ubicación del medidor.' });
    } finally {
      setSavingPlacement(false);
    }
  }

  /** Una sola opción entre dos: guardar al tocar es lo esperable. */
  async function onPhases(phases: MeterPhases) {
    const previous = settings?.phases;
    setSettings((current) => (current ? { ...current, phases } : current));

    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phases }),
      });
      if (!response.ok) throw new Error('rechazado');
      setError(null);
    } catch {
      setSettings((current) =>
        current && previous !== undefined ? { ...current, phases: previous } : current
      );
      setError({ error: 'No se pudo guardar el tipo de equipo.' });
    }
  }

  /**
   * El grado reescribe también los umbrales, del lado del servidor. Se
   * refresca con lo que devuelve la respuesta en vez de calcularlo acá, así
   * la pantalla no puede quedar diciendo un rango distinto del que usa la
   * detección.
   */
  /**
   * Unos umbrales a mano son una decisión, y el backend no ofrece camino de
   * vuelta: elegir un grado los reemplaza y recuperarlos exige tocar la base.
   * Por eso se pregunta una vez, y solo cuando hay algo que perder.
   */
  function onSensitivity(sensitivity: Sensitivity) {
    if (settings?.sensitivity === 'personalizada') {
      setPendingSensitivity(sensitivity);
      return;
    }
    applySensitivity(sensitivity);
  }

  async function applySensitivity(sensitivity: Sensitivity) {
    const previous = settings;
    setSettings((current) => (current ? { ...current, sensitivity } : current));

    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitivity }),
      });

      if (!response.ok) throw new Error('rechazado');

      const payload = (await response.json()) as {
        sensitivity: Sensitivity;
        thresholds: { lowVoltageV: number; highVoltageV: number } | null;
      };

      setSettings((current) =>
        current
          ? {
              ...current,
              sensitivity: payload.sensitivity,
              thresholds: payload.thresholds
                ? { ...current.thresholds, ...payload.thresholds }
                : current.thresholds,
            }
          : current
      );
      setError(null);
    } catch {
      setSettings(previous);
      setError({ error: 'No se pudo guardar la sensibilidad de las alertas.' });
    }
  }

  /**
   * Umbrales escritos a mano.
   *
   * Existe porque elegir un grado era una puerta de ida: el medidor real tenía
   * la tolerancia de ±8% del ENRE —202,4 a 237,6 V, que no coincide con
   * ningún grado— y recuperarla después de un toque exploratorio exigió
   * tocar la base a mano, tres veces. El backend ya acepta valores
   * explícitos; esto es la pantalla que faltaba.
   *
   * La validación se repite acá para responder sin ida y vuelta, pero el
   * servidor es el que manda: sus mensajes se muestran tal cual.
   */
  async function onSaveOwnRange() {
    if (!ownRange) return;

    const low = Number(ownRange.low.replace(',', '.'));
    const high = Number(ownRange.high.replace(',', '.'));
    const { voltage, minSpanV } = THRESHOLD_LIMITS;

    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      setRangeError('Escribí los dos valores en volts.');
      return;
    }
    if (low < voltage.min || high > voltage.max) {
      setRangeError(`Los valores deben estar entre ${voltage.min} y ${voltage.max} V.`);
      return;
    }
    if (low >= high) {
      setRangeError('El valor de abajo tiene que ser menor que el de arriba.');
      return;
    }
    if (high - low < minSpanV) {
      setRangeError(
        `Entre un valor y otro tiene que haber al menos ${minSpanV} V, o una anomalía nunca podría darse por terminada.`
      );
      return;
    }

    setSavingRange(true);
    setRangeError(null);

    try {
      const response = await fetch('/api/meter/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds: { lowVoltageV: low, highVoltageV: high } }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setRangeError(payload.error ?? 'No se pudo guardar.');
        return;
      }

      // El grado lo deduce el servidor de los números: unos umbrales que
      // coinciden con un preset SON ese grado, los haya escrito el usuario o
      // elegido de la lista. Por eso se toma de la respuesta y no se asume.
      setSettings((current) =>
        current
          ? {
              ...current,
              sensitivity: payload.sensitivity as Sensitivity,
              thresholds: { ...current.thresholds, ...payload.thresholds },
            }
          : current
      );
      setOwnRange(null);
      setError(null);
    } catch {
      setRangeError('No se pudo contactar al servidor.');
    } finally {
      setSavingRange(false);
    }
  }

  async function onSave() {
    if (selected === null) return;
    setSaving(true);
    setSavedAt(null);

    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionIntervalMinutes: selected }),
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload as ApiErrorPayload);
        return;
      }

      setSettings((current) =>
        current ? { ...current, collectionIntervalMinutes: selected } : current
      );
      setSavedAt(Date.now());
      setError(null);
    } catch {
      setError({ error: 'No se pudo guardar el cambio.' });
    } finally {
      setSaving(false);
    }
  }

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  const dirty = settings !== null && selected !== null && selected !== settings.collectionIntervalMinutes;

  const placementDirty =
    settings !== null &&
    placement !== null &&
    (placement.role !== settings.role ||
      (placement.role === 'area' && placement.areaLabel.trim() !== (settings.areaLabel ?? '')));

  const placementValid =
    placement !== null && (placement.role === 'central' || placement.areaLabel.trim() !== '');

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-3xl w-full mx-auto">
      <header className="mb-7">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted mt-0.5">
          Configuración del medidor {settings ? `· ${settings.name}` : ''}
        </p>
      </header>

      {error && !error.missingEnv && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      <ProfileForm />

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Dónde está el medidor</h2>
          <InfoTooltip
            title="Dónde está el medidor"
            text="En el tablero central mide todo lo que consume el lugar, y su consumo se contrasta contra la factura del mes. En un área mide solo ese sector: ahí lo que importa es la energía, porque un área no es una factura aparte."
          />
        </div>
        <p className="text-xs text-muted leading-relaxed mb-4">
          De esto depende cómo se presentan el consumo, la proyección y el
          objetivo de este medidor.
        </p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 mb-4">
          {(['central', 'area'] as MeterRole[]).map((option) => {
            const isSelected = placement?.role === option;
            return (
              <button
                key={option}
                type="button"
                disabled={!placement}
                onClick={() =>
                  setPlacement((current) => (current ? { ...current, role: option } : current))
                }
                aria-pressed={isSelected}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-soft'
                    : 'border-border-soft bg-surface-raised hover:border-muted/40'
                }`}
              >
                <span className="block text-sm font-semibold">{ROLE_LABEL[option]}</span>
                <span className="block text-xs text-muted mt-0.5">
                  {option === 'central'
                    ? 'Mide todo lo que consume el lugar.'
                    : 'Mide solo lo que se usa en un sector.'}
                </span>
              </button>
            );
          })}
        </div>

        {placement?.role === 'area' && (
          <label className="block mb-4 animate-fade-in">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Nombre del área
            </span>
            <input
              type="text"
              value={placement.areaLabel}
              maxLength={MAX_AREA_LABEL_LENGTH}
              onChange={(event) =>
                setPlacement((current) =>
                  current ? { ...current, areaLabel: event.target.value } : current
                )
              }
              placeholder="Ej: Terapia intensiva"
              className="mt-1.5 h-11 w-full rounded-xl border border-border-soft bg-surface-raised px-3 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border-soft">
          <button
            type="button"
            onClick={onSavePlacement}
            disabled={!placementDirty || !placementValid || savingPlacement}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {savingPlacement ? 'Guardando…' : 'Guardar ubicación'}
          </button>

          {placementDirty && placement?.role !== settings?.role && (
            <span className="text-xs text-warn leading-relaxed">
              Al cambiarlo vas a tener que volver a elegir el tipo de lugar en
              el asistente: los tipos de un tablero central no son los de un
              área.
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Gauge className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Tipo de equipo</h2>
          <InfoTooltip
            title="Tipo de equipo"
            text="Monofásico es lo habitual en instalaciones chicas; trifásico aparece donde hay maquinaria o equipos grandes. Por ahora el dato queda registrado: las pantallas muestran una sola medición, no una por fase."
          />
        </div>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Si no sabés cuál es, dejá monofásico. Se guarda al tocar.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          {([1, 3] as MeterPhases[]).map((option) => {
            const isSelected = settings?.phases === option;
            return (
              <button
                key={option}
                type="button"
                disabled={!settings}
                onClick={() => onPhases(option)}
                aria-pressed={isSelected}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-soft bg-surface-raised text-foreground hover:border-muted/40'
                }`}
              >
                {PHASE_LABEL[option]}
              </button>
            );
          })}
        </div>

        {settings?.phases === 3 && (
          <p className="mt-3 text-xs text-muted leading-relaxed">
            Queda registrado para no rehacer el alta más adelante. Las lecturas
            por fase todavía no están implementadas.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Sensibilidad de las alertas</h2>
          <InfoTooltip
            title="Sensibilidad de las alertas"
            text="Define cuán lejos de los 220 V tiene que irse la tensión para que se registre una anomalía. Es un umbral de aviso del producto, no un límite normativo: salir del rango elegido no significa que haya peligro, significa que pediste enterarte."
          />
        </div>
        {/* El mismo texto que el asistente, palabra por palabra. Si acá
            dijera otra cosa, serían dos explicaciones distintas de lo mismo
            para la misma persona. Los rangos no se entienden sin nombrar los
            220 V: sin esa referencia, "205–235 V" no dice si es amplio o
            estrecho. */}
        <p className="text-xs text-muted leading-relaxed mb-4">
          La electricidad llega normalmente a{' '}
          <b className="text-foreground">220 V</b>: eso es la tensión. Cuando se
          aleja de ese valor puede dañar aparatos, y te avisamos por email.
          Elegí cuánto puede alejarse antes de que te avisemos.
        </p>

        <div className="space-y-2">
          {SELECTABLE_SENSITIVITIES.map((option) => {
            const isSelected = settings?.sensitivity === option;
            const range = SENSITIVITY_RANGES[option];
            return (
              <label
                key={option}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-soft/40'
                    : 'border-border-soft bg-surface-raised hover:border-muted/40'
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="sensitivity"
                    className="mt-0.5 accent-accent"
                    checked={isSelected}
                    disabled={!settings}
                    onChange={() => onSensitivity(option)}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {SENSITIVITY_LABEL[option]}
                    </span>
                    <span className="block text-xs text-muted leading-relaxed">
                      {SENSITIVITY_DESCRIPTION[option]}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-muted shrink-0 text-right">
                  avisa fuera de
                  <br />
                  <b className="tabular-nums text-foreground">
                    {range.lowVoltageV}–{range.highVoltageV} V
                  </b>
                </span>
              </label>
            );
          })}
        </div>

        {/* `personalizada` no aparece entre los tres grados: no es algo que se
            elija, es lo que resulta de escribir valores propios. Por eso se
            informa acá, junto al formulario que la produce. */}
        {settings?.sensitivity === 'personalizada' && ownRange === null && (
          <p className="mt-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted leading-relaxed">
            <b className="text-foreground">{SENSITIVITY_LABEL.personalizada}:</b>{' '}
            {SENSITIVITY_DESCRIPTION.personalizada} Hoy avisa fuera de{' '}
            <b className="text-foreground tabular-nums">
              {settings.thresholds.lowVoltageV}–{settings.thresholds.highVoltageV} V
            </b>
            . Si elegís uno de los grados de arriba, esos valores se reemplazan.
          </p>
        )}

        {/* Elegir los propios valores.
            Va al final y sin destacarse: la inmensa mayoría elige uno de los
            tres grados, y pedir dos números en volts a quien no los tiene es
            una forma de trabar el alta. Pero quien los tiene —una tolerancia
            de distribuidora, un equipo con su hoja de datos— necesita poder
            escribirlos sin tocar la base de datos. */}
        {ownRange === null ? (
          <button
            type="button"
            disabled={!settings}
            onClick={() => {
              setRangeError(null);
              setOwnRange({
                low: String(settings?.thresholds.lowVoltageV ?? ''),
                high: String(settings?.thresholds.highVoltageV ?? ''),
              });
            }}
            className="mt-3 text-xs font-semibold text-accent transition-opacity hover:underline disabled:opacity-40"
          >
            Prefiero elegir mis propios valores
          </button>
        ) : (
          <div className="mt-3 rounded-xl border border-accent/40 bg-surface-raised px-4 py-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold">Tus propios valores</p>
              <InfoTooltip
                title="Cuándo conviene"
                text="Si tu distribuidora publica una tolerancia distinta, o un equipo tuyo tiene un rango de trabajo que querés respetar, escribilos acá. Si no, cualquiera de los tres grados de arriba sirve."
              />
            </div>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Te avisamos cuando la tensión salga de este rango. Tiene que estar
              entre {THRESHOLD_LIMITS.voltage.min} y {THRESHOLD_LIMITS.voltage.max} V,
              y haber al menos {THRESHOLD_LIMITS.minSpanV} V entre un valor y el otro.
            </p>

            {rangeError && (
              <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger leading-relaxed">
                {rangeError}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3 mb-4">
              <label className="flex-1 min-w-[8rem]">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Avisar si baja de
                </span>
                <span className="relative mt-1.5 flex items-center">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={ownRange.low}
                    onChange={(event) =>
                      setOwnRange((current) =>
                        current ? { ...current, low: event.target.value } : current
                      )
                    }
                    placeholder="202.4"
                    className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 pr-8 text-sm tabular-nums text-foreground outline-none focus:border-accent"
                  />
                  <span className="absolute right-3 text-xs text-muted">V</span>
                </span>
              </label>

              <label className="flex-1 min-w-[8rem]">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Avisar si sube de
                </span>
                <span className="relative mt-1.5 flex items-center">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={ownRange.high}
                    onChange={(event) =>
                      setOwnRange((current) =>
                        current ? { ...current, high: event.target.value } : current
                      )
                    }
                    placeholder="237.6"
                    className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 pr-8 text-sm tabular-nums text-foreground outline-none focus:border-accent"
                  />
                  <span className="absolute right-3 text-xs text-muted">V</span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSaveOwnRange}
                disabled={savingRange}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingRange ? 'Guardando…' : 'Guardar mis valores'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnRange(null);
                  setRangeError(null);
                }}
                className="text-xs font-semibold text-muted transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Avisos por email</h2>
          <InfoTooltip title="Avisos por email" text="Te llega un correo cuando se detecta una anomalía en tu instalación: tensión fuera de rango o corriente excesiva. Los huecos cortos de datos no generan aviso, para no llenarte la casilla de ruido." />
        </div>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Recibís un correo cuando aparece una anomalía nueva, a la casilla con
          la que iniciás sesión.
        </p>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 cursor-pointer">
          <span className="text-sm font-medium">
            {settings?.alertsEnabled ? 'Avisos activados' : 'Avisos desactivados'}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={settings?.alertsEnabled ?? false}
            disabled={!settings}
            onChange={(e) => onToggleAlerts(e.target.checked)}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Apariencia</h2>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Elegí cómo se ve la aplicación. Si no elegís, sigue la configuración
          de tu teléfono o computadora.
        </p>
        <ThemeToggle variant="full" />
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Frecuencia de guardado</h2>
          <InfoTooltip title="Frecuencia de guardado" text="Cada cuánto se guarda una lectura en la base. No cambia la frecuencia con la que la pantalla muestra valores en vivo: el Monitor se sigue actualizando cada 5 segundos." />
        </div>
        <p className="text-xs text-muted leading-relaxed mb-5">
          Guardar más seguido da gráficos con más detalle, pero consume más
          espacio y tráfico de la base. Guardar más espaciado cuida los límites
          del plan gratuito a costa de un histórico más grueso.
        </p>

        <div className="space-y-2 mb-5">
          {COLLECTION_INTERVALS.map((option) => {
            const isSelected = selected === option.minutes;
            return (
              <label
                key={option.minutes}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-soft/40'
                    : 'border-border-soft bg-surface-raised hover:border-muted/40'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="interval"
                    className="accent-accent"
                    checked={isSelected}
                    onChange={() => setSelected(option.minutes)}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </span>
                <span className="text-xs text-muted tabular-nums">
                  ~{rowsPerDay(option.minutes).toLocaleString('es-AR')} filas/día
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border-soft">
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>

          {savedAt !== null && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ok">
              <Check className="h-4 w-4" />
              Guardado. Aplica desde el próximo ciclo.
            </span>
          )}

          {settings && !dirty && savedAt === null && (
            <span className="text-xs text-muted">
              Actual: {intervalLabel(settings.collectionIntervalMinutes)}
            </span>
          )}
        </div>

        <p className="mt-4 text-xs text-muted leading-relaxed">
          El conteo de filas cuenta los dos orígenes que escriben: el recolector
          programado y el sondeo del dashboard mientras alguien lo tiene
          abierto. Cada uno lleva su propio ritmo.
        </p>
      </section>

      <ReplaceThresholdsDialog
        open={pendingSensitivity !== null}
        target={pendingSensitivity}
        current={settings?.thresholds ?? null}
        onCancel={() => setPendingSensitivity(null)}
        onConfirm={() => {
          const elegido = pendingSensitivity;
          setPendingSensitivity(null);
          if (elegido) applySensitivity(elegido);
        }}
      />
    </div>
  );
}

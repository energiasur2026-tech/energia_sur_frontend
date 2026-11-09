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
        <p className="text-xs text-muted leading-relaxed mb-4">
          Cuándo querés que te avisemos si la tensión se va de lo normal. A
          mayor sensibilidad, más angosto el rango que se considera normal, y
          más avisos.
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
                <span className="text-xs text-muted tabular-nums shrink-0">
                  {range.lowVoltageV}–{range.highVoltageV} V
                </span>
              </label>
            );
          })}
        </div>

        {/* `personalizada` no se elige: se hereda de unos umbrales ajustados a
            mano. Mostrarla como opción invitaría a seleccionarla, y no hay
            nada que seleccionar. */}
        {settings?.sensitivity === 'personalizada' && (
          <p className="mt-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted leading-relaxed">
            <b className="text-foreground">{SENSITIVITY_LABEL.personalizada}:</b>{' '}
            {SENSITIVITY_DESCRIPTION.personalizada} Hoy avisa fuera de{' '}
            <b className="text-foreground tabular-nums">
              {settings.thresholds.lowVoltageV}–{settings.thresholds.highVoltageV} V
            </b>
            . Si elegís uno de los grados de arriba, esos umbrales se
            reemplazan.
          </p>
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

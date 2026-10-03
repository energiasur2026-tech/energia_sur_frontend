'use client';

import { useCallback, useState } from 'react';
import { Bell, Check, Database, Palette, Save } from 'lucide-react';
import {
  COLLECTION_INTERVALS,
  intervalLabel,
  rowsPerDay,
} from '@/lib/collection-intervals';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { ApiErrorPayload } from '@/lib/types';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { ProfileForm } from './ProfileForm';
import { ThemeToggle } from './ThemeToggle';
import { SetupNotice } from './SetupNotice';

type Settings = {
  deviceId: string;
  name: string;
  collectionIntervalMinutes: number;
  alertsEnabled: boolean;
  thresholds: MeterThresholds;
};

/** Solo se recarga si algo cambió por fuera; no es una pantalla en vivo. */
const POLL_INTERVAL_MS = 300000;

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/meter/settings', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      const next = payload as Settings;
      setSettings(next);
      // No pisa una selección que el usuario todavía no guardó.
      setSelected((current) => current ?? next.collectionIntervalMinutes);
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, []);

  usePolling(fetchSettings, POLL_INTERVAL_MS);

  /** El interruptor guarda al instante: no tiene sentido pedir confirmación. */
  async function onToggleAlerts(enabled: boolean) {
    setSettings((current) => (current ? { ...current, alertsEnabled: enabled } : current));

    try {
      const response = await fetch('/api/meter/settings', {
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

  async function onSave() {
    if (selected === null) return;
    setSaving(true);
    setSavedAt(null);

    try {
      const response = await fetch('/api/meter/settings', {
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
    </div>
  );
}

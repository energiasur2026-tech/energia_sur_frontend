'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gauge, House, Layers, Plus, Target, TriangleAlert, Zap } from 'lucide-react';
import { formatNumber, formatRelativeMinutes, NO_DATA } from '@/lib/format';
import type { GoalProgress } from '@/lib/goal';
import type { HomeSummary } from '@/lib/home-types';
import type { ApiErrorPayload } from '@/lib/types';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { SetupNotice } from './SetupNotice';

/** Panorama, no tablero en vivo: alcanza con refrescar cada minuto. */
const POLL_INTERVAL_MS = 60000;

type MeterSummary = {
  deviceId: string;
  name: string;
  latest: { recordedAt: string; voltage: number | null; powerW: number | null } | null;
  activeEvents: number;
  goal: GoalProgress;
  home: HomeSummary;
};

export function MetersView() {
  const [meters, setMeters] = useState<MeterSummary[] | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  const fetchMeters = useCallback(async () => {
    try {
      const response = await fetch('/api/meters', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      setMeters(payload.meters as MeterSummary[]);
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, []);

  usePolling(fetchMeters, POLL_INTERVAL_MS);

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      <header className="mb-5 md:mb-7">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Mis medidores</h1>
        <p className="text-sm text-muted mt-0.5">
          Los medidores de tu domicilio, de un vistazo
        </p>
      </header>

      {error && !error.missingEnv && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      {!meters && <p className="text-center text-sm text-muted py-16">Cargando…</p>}

      {meters?.length === 0 && (
        <div className="rounded-2xl border border-border-soft bg-surface p-10 text-center">
          <Gauge className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-sm font-medium">Todavía no tenés medidores vinculados.</p>
          <p className="mt-1 text-xs text-muted">
            La vinculación se hace por ahora de forma manual. Escribinos para
            sumar un medidor a tu cuenta.
          </p>
        </div>
      )}

      {meters && meters.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
            {meters.map((meter) => (
              <MeterCard key={meter.deviceId} meter={meter} />
            ))}
          </div>

          {/* El alta de medidores todavía es manual; decirlo evita que alguien
              busque un botón que no existe. */}
          <p className="mt-6 flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-4 py-3 text-xs text-muted">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Para sumar otro medidor hace falta vincularlo con sus credenciales.
            Por ahora esa alta se hace de forma manual.
          </p>
        </>
      )}
    </div>
  );
}

function MeterCard({ meter }: { meter: MeterSummary }) {
  const goalLabel = goalSummary(meter.goal);

  return (
    <article className="flex flex-col rounded-2xl border border-border-soft bg-surface p-5">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold tracking-tight">{meter.name}</h2>
          <p className="text-xs text-muted mt-0.5">
            {meter.latest
              ? `Última medición ${formatRelativeMinutes(meter.latest.recordedAt)}`
              : 'Sin mediciones todavía'}
          </p>
        </div>
        <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
          <Gauge className="h-4 w-4 text-accent" />
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 mb-4">
        <Stat
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Tensión"
          value={meter.latest ? `${formatNumber(meter.latest.voltage, 1)} V` : NO_DATA}
        />
        <Stat
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Potencia"
          value={meter.latest ? `${formatNumber(meter.latest.powerW, 0)} W` : NO_DATA}
        />
      </dl>

      <div className="space-y-2 mb-4">
        <Row
          icon={<Target className="h-3.5 w-3.5" />}
          label="Objetivo"
          value={goalLabel.text}
          tone={goalLabel.tone}
          tip="Cómo viene el consumo del mes contra la meta que fijaste. Se configura en la sección Objetivo."
        />
        <Row
          icon={<TriangleAlert className="h-3.5 w-3.5" />}
          label="Anomalías"
          value={
            meter.activeEvents === 0
              ? 'Ninguna en curso'
              : `${meter.activeEvents} en curso`
          }
          tone={meter.activeEvents === 0 ? 'ok' : 'danger'}
          tip="Problemas detectados que siguen activos: tensión fuera de rango o falta de lecturas."
        />
      </div>

      <HomeStatus home={meter.home} />

      <Link
        href="/dashboard"
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85"
      >
        Ir a mi medidor
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

/**
 * Estado del contexto del hogar, con su acceso para cargarlo o editarlo.
 *
 * Sin contexto cargado el recuadro es punteado y el enlace se destaca: es la
 * unica accion pendiente de la tarjeta. Una vez cargado pasa a ser un dato mas
 * —cuantos ambientes y aparatos hay— y el enlace baja a secundario, porque ya
 * no hay nada que reclamarle al usuario.
 */
function HomeStatus({ home }: { home: HomeSummary }) {
  return (
    <div className="mb-4 space-y-2">
      <div
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
          home.configured
            ? 'bg-accent-soft'
            : 'border border-dashed border-border-soft'
        }`}
      >
        <span className={`shrink-0 ${home.configured ? 'text-accent' : 'text-muted'}`}>
          {home.configured ? <Layers className="h-4 w-4" /> : <House className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight">
            {home.configured ? 'Contexto del hogar cargado' : 'Sin componentes del hogar'}
          </p>
          <p className={`text-[11px] leading-tight ${home.configured ? 'text-accent' : 'text-muted'}`}>
            {home.configured
              ? `${home.rooms} ${home.rooms === 1 ? 'ambiente' : 'ambientes'} · ${home.appliances} ${
                  home.appliances === 1 ? 'aparato' : 'aparatos'
                }`
              : 'Mejora tus recomendaciones y predicciones'}
          </p>
        </div>
      </div>

      {/* Contorneado y no solido: la accion principal de la tarjeta es "Ir a mi
          medidor", que ya es un boton lleno. Dos botones llenos del mismo color
          compiten entre si y ninguno de los dos termina destacando. */}
      <Link
        href="/medidores/hogar"
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
          home.configured
            ? 'bg-surface-raised text-muted hover:text-foreground'
            : 'border border-accent text-accent hover:bg-accent-soft'
        }`}
      >
        {home.configured ? <Layers className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {home.configured ? 'Editar componentes del hogar' : 'Agregar componentes del hogar'}
      </Link>
    </div>
  );
}

function goalSummary(goal: GoalProgress): { text: string; tone: 'default' | 'ok' | 'warn' | 'danger' } {
  switch (goal.status) {
    case 'no_goal':
      return { text: 'Sin objetivo definido', tone: 'default' };
    case 'no_data':
      return { text: 'Esperando lecturas', tone: 'default' };
    case 'on_track':
      return { text: `Vas bien · ${formatNumber(goal.projectedMonthKwh, 0)} de ${formatNumber(goal.goalKwh, 0)} kWh`, tone: 'ok' };
    case 'at_risk':
      return { text: `Al límite · ${formatNumber(goal.projectedMonthKwh, 0)} de ${formatNumber(goal.goalKwh, 0)} kWh`, tone: 'warn' };
    case 'over':
      return { text: `Te estás pasando · ${formatNumber(goal.projectedMonthKwh, 0)} de ${formatNumber(goal.goalKwh, 0)} kWh`, tone: 'danger' };
  }
}

const TONE_TEXT = {
  default: 'text-muted',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
} as const;

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted mb-0.5">
        <span className="text-accent">{icon}</span>
        {label}
      </dt>
      <dd className="text-lg font-bold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  tone,
  tip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'default' | 'ok' | 'warn' | 'danger';
  tip: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted">
        <span className={TONE_TEXT[tone]}>{icon}</span>
        {label}
        <InfoTooltip text={tip} title={label} />
      </span>
      <span className={`font-medium text-right ${TONE_TEXT[tone]}`}>{value}</span>
    </div>
  );
}

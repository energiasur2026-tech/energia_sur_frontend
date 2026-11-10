'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Gauge, House, Layers, Link2Off, MapPin, Plus, Target, TriangleAlert, Zap } from 'lucide-react';
import { formatNumber, formatRelativeMinutes, NO_DATA } from '@/lib/format';
import type { GoalProgress } from '@/lib/goal';
import type { HomeSummary } from '@/domain/home-types';
import { PHASE_LABEL, type MeterPhases } from '@/domain/installation-types';
import { ROLE_LABEL, type MeterRole } from '@/domain/meter-role';
import type { ApiErrorPayload } from '@/lib/types';
import { meterHref } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { LinkMeterForm, type LinkResult } from './LinkMeterForm';
import { SetupNotice } from './SetupNotice';
import { UnlinkMeterDialog } from './UnlinkMeterDialog';

/** Panorama, no tablero en vivo: alcanza con refrescar cada minuto. */
const POLL_INTERVAL_MS = 60000;

type MeterSummary = {
  deviceId: string;
  name: string;
  latest: { recordedAt: string; voltage: number | null; powerW: number | null } | null;
  activeEvents: number;
  goal: GoalProgress;
  home: HomeSummary;
  role: MeterRole;
  /** Dónde está instalado, si es de área. `null` en un central. */
  areaLabel: string | null;
  phases: MeterPhases;
  /**
   * Si esta cuenta vinculó el medidor o es una invitada.
   *
   * Manda sobre la acción de desvincular: una cuenta invitada que la viera
   * terminaría en un 403. Es preferible no ofrecer lo que no se puede hacer.
   */
  isOwner: boolean;
};

export function MetersView() {
  const [meters, setMeters] = useState<MeterSummary[] | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  /** El medidor cuya baja se está confirmando. */
  const [unlinking, setUnlinking] = useState<MeterSummary | null>(null);
  const [unlinked, setUnlinked] = useState<{ name: string; readings: number } | null>(null);
  /**
   * El resultado del último alta.
   *
   * Vive acá y no en el formulario porque vincular el primer medidor cambia
   * la lista y vuelve a montar el formulario: el aviso duraba dos segundos.
   */
  const [linked, setLinked] = useState<LinkResult | null>(null);

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

  async function unlink(meter: MeterSummary) {
    try {
      const response = await fetch(
        `/api/meters?deviceId=${encodeURIComponent(meter.deviceId)}`,
        { method: 'DELETE' }
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      setUnlinked({ name: meter.name, readings: Number(payload.keptReadings ?? 0) });
      setLinked(null);
      setError(null);
      await fetchMeters();
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    } finally {
      setUnlinking(null);
    }
  }

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

      {linked && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-ok/40 bg-ok/5 px-4 py-3 animate-fade-in">
          <Check className="h-4 w-4 mt-0.5 shrink-0 text-ok" />
          <p className="text-xs text-muted leading-relaxed">
            Vinculamos <b className="text-foreground">{linked.name}</b>.{' '}
            {linked.existingReadings > 0 ? (
              <>
                Encontramos{' '}
                <b className="text-foreground">
                  {linked.existingReadings.toLocaleString('es-AR')} mediciones anteriores
                </b>{' '}
                de este medidor: ya tenés su historial completo, sin esperar a juntar
                datos nuevos.
              </>
            ) : (
              <>
                Todavía no tiene mediciones: van a empezar a aparecer en los próximos
                minutos.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setLinked(null)}
            aria-label="Cerrar aviso"
            className="ml-auto shrink-0 text-muted transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}

      {unlinked && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-border-soft bg-surface px-4 py-3 animate-fade-in">
          <Link2Off className="h-4 w-4 mt-0.5 shrink-0 text-muted" />
          <p className="text-xs text-muted leading-relaxed">
            Desvinculamos <b className="text-foreground">{unlinked.name}</b>. Sus{' '}
            <b className="text-foreground">
              {unlinked.readings.toLocaleString('es-AR')} mediciones
            </b>{' '}
            quedaron guardadas: si lo volvés a vincular, las recuperás.
          </p>
          <button
            type="button"
            onClick={() => setUnlinked(null)}
            aria-label="Cerrar aviso"
            className="ml-auto shrink-0 text-muted transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}

      {!meters && <p className="text-center text-sm text-muted py-16">Cargando…</p>}

      {meters?.length === 0 && (
        <>
          <div className="rounded-2xl border border-border-soft bg-surface p-10 text-center">
            <Gauge className="h-8 w-8 text-muted mx-auto mb-3" />
            <p className="text-sm font-medium">Todavía no tenés medidores vinculados.</p>
            <p className="mt-1 text-xs text-muted">
              Sumá el tuyo con el identificador impreso en el equipo.
            </p>
          </div>
        </>
      )}

      {meters && meters.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
            {meters.map((meter) => (
              <MeterCard
                key={meter.deviceId}
                meter={meter}
                onUnlink={() => setUnlinking(meter)}
              />
            ))}
          </div>

        </>
      )}

      {/* Fuera de las dos ramas a propósito: dibujarlo dentro de cada una lo
          desmonta al vincular el primer medidor —la lista deja de estar
          vacía y cambia la rama— y se pierde el aviso de cuántas mediciones
          anteriores se recuperaron, que es lo que el usuario necesita leer
          justo en ese momento. */}
      {meters && (
        <div className="mt-6">
          <LinkMeterForm
            onLinked={(result) => {
              setLinked(result);
              // Los dos avisos juntos contarían dos historias a la vez sobre
              // el mismo medidor.
              setUnlinked(null);
              fetchMeters();
            }}
          />
        </div>
      )}

      <UnlinkMeterDialog
        open={unlinking !== null}
        meterName={unlinking?.name ?? ''}
        onCancel={() => setUnlinking(null)}
        onConfirm={() => (unlinking ? unlink(unlinking) : Promise.resolve())}
      />
    </div>
  );
}

function MeterCard({ meter, onUnlink }: { meter: MeterSummary; onUnlink: () => void }) {
  const goalLabel = goalSummary(meter.goal);

  return (
    <article className="flex flex-col rounded-2xl border border-border-soft bg-surface p-5">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight">{meter.name}</h2>
          {/* Qué mide este medidor. Es una etiqueta suya y nada más: las
              tarjetas no se suman ni se comparan entre sí. */}
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted">
              {meter.role === 'central' ? (
                <Zap className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {meter.role === 'central' ? ROLE_LABEL.central : meter.areaLabel || ROLE_LABEL.area}
            </span>
            {meter.phases === 3 && (
              <span className="inline-flex items-center rounded-full border border-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted">
                {PHASE_LABEL[3]}
              </span>
            )}
          </p>
          <p className="text-xs text-muted mt-1">
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

      <HomeStatus home={meter.home} deviceId={meter.deviceId} />

      {/* Los enlaces llevan el medidor de esta tarjeta: sin eso, con más de
          uno vinculado, "Ir a mi medidor" abriría siempre el primero. */}
      <Link
        href={meterHref('/dashboard', meter.deviceId)}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85"
      >
        Ir a mi medidor
        <ArrowRight className="h-4 w-4" />
      </Link>

      {/* Solo para quien vinculó el medidor: una cuenta invitada no puede
          desvincularlo y el botón terminaría en un 403. Va discreto y al
          final: es la acción menos frecuente y la más difícil de deshacer. */}
      {meter.isOwner && (
        <button
          type="button"
          onClick={onUnlink}
          className="mt-2 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-danger"
        >
          <Link2Off className="h-3.5 w-3.5" />
          Desvincular de mi cuenta
        </button>
      )}
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
function HomeStatus({ home, deviceId }: { home: HomeSummary; deviceId: string }) {
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
            {home.configured ? 'Contexto del lugar cargado' : 'Sin contexto cargado'}
          </p>
          <p className={`text-[11px] leading-tight ${home.configured ? 'text-accent' : 'text-muted'}`}>
            {home.configured
              ? `${home.rooms} ${home.rooms === 1 ? 'lugar' : 'lugares'} · ${home.appliances} ${
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
        href={meterHref('/medidores/hogar', deviceId)}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
          home.configured
            ? 'bg-surface-raised text-muted hover:text-foreground'
            : 'border border-accent text-accent hover:bg-accent-soft'
        }`}
      >
        {home.configured ? <Layers className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {home.configured ? 'Editar lo que hay en el lugar' : 'Cargar lo que hay en el lugar'}
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

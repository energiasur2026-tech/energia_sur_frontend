'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Check,
  House,
  Layers,
  Plug,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { APPLIANCE_CATEGORIES, SUGGESTED_ROOMS } from '@/lib/home-catalog';
import {
  EMPTY_HOME,
  MAX_FLOORS,
  MAX_ROOM_NAME_LENGTH,
  MAX_ROOMS,
  type DwellingType,
  type HomeContext,
} from '@/lib/home-types';
import type { ApiErrorPayload } from '@/lib/types';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { SetupNotice } from './SetupNotice';
import { SkipHomeDialog } from './SkipHomeDialog';

type Step = 'vivienda' | 'aparatos' | 'listo';

/** No cambia por su cuenta: se relee muy de vez en cuando, por las dudas. */
const LOAD_INTERVAL_MS = 600000;

/** Los ambientes viven en el estado como mapa nombre → aparatos elegidos. */
type Draft = {
  dwellingType: DwellingType;
  floors: number;
  rooms: { name: string; appliances: Set<string> }[];
};

function toDraft(home: HomeContext | null): Draft {
  const source = home ?? EMPTY_HOME;
  return {
    dwellingType: source.dwellingType,
    floors: source.floors,
    rooms: source.rooms.map((room) => ({
      name: room.name,
      appliances: new Set(room.appliances),
    })),
  };
}

export function HomeSetup() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('vivienda');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeRoom, setActiveRoom] = useState(0);
  const [roomInput, setRoomInput] = useState('');
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/meter/home', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      // Solo se completa la primera vez. Una relectura posterior no debe
      // pisar los ambientes y aparatos que el usuario está cargando ahora.
      setDraft((current) => current ?? toDraft(payload.home as HomeContext | null));
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, []);

  // El contexto del hogar no cambia solo: alcanza con leerlo al entrar. Se usa
  // `usePolling` igual que el resto de las vistas porque agenda la primera
  // corrida en vez de escribir estado dentro del efecto.
  usePolling(load, LOAD_INTERVAL_MS);

  const totalAppliances = useMemo(
    () => (draft ? draft.rooms.reduce((total, room) => total + room.appliances.size, 0) : 0),
    [draft]
  );

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  if (!draft) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-3xl w-full mx-auto">
        {error && <ErrorNote message={error.error} />}
        {!error && <p className="text-center text-sm text-muted py-16">Cargando…</p>}
      </div>
    );
  }

  function updateDraft(patch: (current: Draft) => Draft) {
    setDraft((current) => (current ? patch(current) : current));
  }

  function addRoom(name: string) {
    const clean = name.trim().slice(0, MAX_ROOM_NAME_LENGTH);
    if (clean === '') return;

    updateDraft((current) => {
      const exists = current.rooms.some(
        (room) => room.name.toLowerCase() === clean.toLowerCase()
      );
      if (exists || current.rooms.length >= MAX_ROOMS) return current;

      return { ...current, rooms: [...current.rooms, { name: clean, appliances: new Set() }] };
    });
  }

  function removeRoom(name: string) {
    updateDraft((current) => ({
      ...current,
      rooms: current.rooms.filter((room) => room.name !== name),
    }));
    setActiveRoom(0);
  }

  function toggleAppliance(roomIndex: number, applianceId: string) {
    updateDraft((current) => ({
      ...current,
      rooms: current.rooms.map((room, index) => {
        if (index !== roomIndex) return room;

        const next = new Set(room.appliances);
        if (next.has(applianceId)) next.delete(applianceId);
        else next.add(applianceId);

        return { ...room, appliances: next };
      }),
    }));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);

    try {
      const response = await fetch('/api/meter/home', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dwellingType: draft.dwellingType,
          floors: draft.floors,
          rooms: draft.rooms.map((room) => ({
            name: room.name,
            appliances: [...room.appliances],
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      setError(null);
      setStep('listo');
    } catch {
      setError({ error: 'No se pudo guardar el contexto del hogar.' });
    } finally {
      setSaving(false);
    }
  }

  function leave() {
    router.push('/medidores');
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-3xl w-full mx-auto">
      {step !== 'listo' && (
        <>
          <div className="flex items-center gap-2.5 mb-4">
            <button
              type="button"
              onClick={() => (step === 'vivienda' ? setSkipOpen(true) : setStep('vivienda'))}
              aria-label="Volver"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {step === 'vivienda' ? 'Tu vivienda' : '¿Qué hay en cada ambiente?'}
            </h1>
          </div>

          {/* Dos pasos, dos barras. Con tan pocos pasos, un contador escrito
              ("paso 1 de 2") ocuparía más y diría lo mismo. */}
          <div className="flex items-center gap-1.5 mb-5" aria-hidden>
            <span className="h-1.5 flex-1 rounded-full bg-accent" />
            <span
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                step === 'aparatos' ? 'bg-accent' : 'bg-border-soft'
              }`}
            />
          </div>
        </>
      )}

      {error && !error.missingEnv && <ErrorNote message={error.error} />}

      {step === 'vivienda' && (
        <StepDwelling
          draft={draft}
          roomInput={roomInput}
          onRoomInput={setRoomInput}
          onDwellingType={(type) => updateDraft((current) => ({ ...current, dwellingType: type }))}
          onFloors={(delta) =>
            updateDraft((current) => ({
              ...current,
              floors: Math.max(1, Math.min(MAX_FLOORS, current.floors + delta)),
            }))
          }
          onAddRoom={(name) => {
            addRoom(name);
            setRoomInput('');
          }}
          onRemoveRoom={removeRoom}
          onNext={() => {
            setActiveRoom(0);
            setStep('aparatos');
          }}
          onSkip={() => setSkipOpen(true)}
        />
      )}

      {step === 'aparatos' && (
        <StepAppliances
          draft={draft}
          activeRoom={activeRoom}
          totalAppliances={totalAppliances}
          saving={saving}
          onActiveRoom={setActiveRoom}
          onToggle={toggleAppliance}
          onSave={save}
          onSkip={() => setSkipOpen(true)}
        />
      )}

      {step === 'listo' && (
        <StepDone draft={draft} totalAppliances={totalAppliances} onLeave={leave} />
      )}

      <SkipHomeDialog
        open={skipOpen}
        onConfirm={() => {
          setSkipOpen(false);
          leave();
        }}
        onCancel={() => setSkipOpen(false)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 1: vivienda y ambientes                                               */
/* -------------------------------------------------------------------------- */

function StepDwelling({
  draft,
  roomInput,
  onRoomInput,
  onDwellingType,
  onFloors,
  onAddRoom,
  onRemoveRoom,
  onNext,
  onSkip,
}: {
  draft: Draft;
  roomInput: string;
  onRoomInput: (value: string) => void;
  onDwellingType: (type: DwellingType) => void;
  onFloors: (delta: number) => void;
  onAddRoom: (name: string) => void;
  onRemoveRoom: (name: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const pending = SUGGESTED_ROOMS.filter(
    (suggestion) => !draft.rooms.some((room) => room.name.toLowerCase() === suggestion.name.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-6">
        Contanos cómo es el lugar donde está este medidor. Con esto y los aparatos
        del paso siguiente, las recomendaciones van a ser mucho más precisas.
      </p>

      <section className="mb-6">
        <FieldLabel>Tipo de vivienda</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          <DwellingCard
            icon={<House className="h-6 w-6" />}
            title="Casa"
            hint="Una o más plantas"
            selected={draft.dwellingType === 'casa'}
            onClick={() => onDwellingType('casa')}
          />
          <DwellingCard
            icon={<Building2 className="h-6 w-6" />}
            title="Depto / Edificio"
            hint="Una unidad"
            selected={draft.dwellingType === 'depto'}
            onClick={() => onDwellingType('depto')}
          />
        </div>
      </section>

      <section className="mb-6">
        <FieldLabel>
          {draft.dwellingType === 'casa' ? 'Cantidad de pisos' : 'Piso del departamento'}
        </FieldLabel>
        <div className="flex items-center justify-between rounded-xl border border-border-soft bg-surface px-4 py-3">
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight">{draft.floors}</p>
            <p className="text-xs text-muted">{draft.floors === 1 ? 'piso' : 'pisos'}</p>
          </div>
          <div className="flex gap-2">
            <RoundButton label="Quitar un piso" onClick={() => onFloors(-1)}>
              −
            </RoundButton>
            <RoundButton label="Sumar un piso" onClick={() => onFloors(1)}>
              +
            </RoundButton>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-1.5 mb-2.5">
          <FieldLabel className="mb-0">Ambientes con este medidor</FieldLabel>
          <InfoTooltip
            title="Ambientes"
            text="Los espacios de tu casa que alimenta este medidor. En el paso siguiente vas a marcar qué aparatos hay en cada uno, así las recomendaciones pueden decirte dónde se está yendo el consumo."
          />
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={roomInput}
            maxLength={MAX_ROOM_NAME_LENGTH}
            onChange={(event) => onRoomInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAddRoom(roomInput);
              }
            }}
            placeholder="Ej: Dormitorio principal"
            className="h-11 flex-1 rounded-xl border border-border-soft bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => onAddRoom(roomInput)}
            aria-label="Agregar ambiente"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {pending.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                onClick={() => onAddRoom(suggestion.name)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-soft px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <suggestion.icon className="h-3.5 w-3.5" />
                {suggestion.name}
              </button>
            ))}
          </div>
        )}

        {draft.rooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-soft px-4 py-5 text-center text-xs text-muted">
            Todavía no agregaste ningún ambiente. Tocá una sugerencia o escribí el nombre.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {draft.rooms.map((room) => (
              <li
                key={room.name}
                className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-surface px-3 py-2.5 animate-value-in"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span className="flex-1 text-sm font-medium">{room.name}</span>
                {room.appliances.size > 0 && (
                  <span className="text-xs text-muted tabular-nums">
                    {room.appliances.size}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveRoom(room.name)}
                  aria-label={`Quitar ${room.name}`}
                  className="text-muted transition-colors hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onNext}
          disabled={draft.rooms.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="mx-auto py-2 text-sm font-semibold text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 2: aparatos por ambiente                                              */
/* -------------------------------------------------------------------------- */

function StepAppliances({
  draft,
  activeRoom,
  totalAppliances,
  saving,
  onActiveRoom,
  onToggle,
  onSave,
  onSkip,
}: {
  draft: Draft;
  activeRoom: number;
  totalAppliances: number;
  saving: boolean;
  onActiveRoom: (index: number) => void;
  onToggle: (roomIndex: number, applianceId: string) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const index = Math.min(activeRoom, draft.rooms.length - 1);
  const room = draft.rooms[index];

  if (!room) return null;

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-4">
        Marcá lo que tenés en <b className="text-foreground">{room.name}</b>. Solo
        necesitamos saber qué hay, no la potencia de cada uno.
      </p>

      {/* Un tab por ambiente. Con muchos ambientes la fila scrollea sola en
          vez de envolver: envolviendo, el alto de la cabecera cambiaría según
          cuántos ambientes tenga cada usuario. */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {draft.rooms.map((item, roomIndex) => {
          const active = roomIndex === index;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onActiveRoom(roomIndex)}
              aria-current={active ? 'true' : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                active
                  ? 'border-accent bg-accent text-white'
                  : 'border-border-soft bg-surface text-muted hover:text-foreground'
              }`}
            >
              {item.name}
              {item.appliances.size > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                    active ? 'bg-white/25' : 'bg-surface-raised'
                  }`}
                >
                  {item.appliances.size}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {APPLIANCE_CATEGORIES.map((category) => (
        <section key={category.id} className="mb-6">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2.5">
            {category.label}
          </h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {category.items.map((appliance) => {
              const selected = room.appliances.has(appliance.id);
              const Icon = appliance.icon;

              return (
                <button
                  key={appliance.id}
                  type="button"
                  onClick={() => onToggle(index, appliance.id)}
                  aria-pressed={selected}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors ${
                    selected
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-soft bg-surface hover:border-accent/50'
                  }`}
                >
                  {selected && (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-ok text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      selected ? 'bg-accent text-white' : 'bg-surface-raised text-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-center">
                    {appliance.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 sticky-above-nav -mx-4 mt-2 border-t border-border-soft bg-surface px-4 py-3 md:-mx-6 md:px-6">
        <div className="flex items-baseline justify-between mb-2.5 text-xs text-muted">
          <span>Aparatos seleccionados</span>
          <b className="text-sm font-bold text-foreground tabular-nums">{totalAppliances}</b>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar y continuar'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="mx-auto mt-2 block py-1.5 text-sm font-semibold text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 3: confirmación                                                       */
/* -------------------------------------------------------------------------- */

function StepDone({
  draft,
  totalAppliances,
  onLeave,
}: {
  draft: Draft;
  totalAppliances: number;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 animate-fade-in">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-ok/15">
        <Check className="h-8 w-8 text-ok" strokeWidth={2.5} />
      </span>

      <h1 className="text-xl font-bold tracking-tight mb-2">Listo, guardamos tu hogar</h1>
      <p className="max-w-sm text-sm text-muted leading-relaxed mb-7">
        Esta información va a ir afinando las recomendaciones y proyecciones de tu
        medidor a medida que junte más datos.
      </p>

      <dl className="w-full max-w-sm flex flex-col gap-2 mb-7">
        <SummaryRow
          icon={draft.dwellingType === 'casa' ? <House className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          label="Vivienda"
          value={`${draft.dwellingType === 'casa' ? 'Casa' : 'Depto'} · ${draft.floors} ${
            draft.floors === 1 ? 'piso' : 'pisos'
          }`}
        />
        <SummaryRow icon={<Layers className="h-4 w-4" />} label="Ambientes" value={String(draft.rooms.length)} />
        <SummaryRow icon={<Plug className="h-4 w-4" />} label="Aparatos cargados" value={String(totalAppliances)} />
      </dl>

      <button
        type="button"
        onClick={onLeave}
        className="inline-flex w-full max-w-sm items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85"
      >
        Volver a mis medidores
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Piezas menores                                                             */
/* -------------------------------------------------------------------------- */

function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`block text-[11px] font-bold uppercase tracking-wide text-muted mb-2.5 ${className}`}
    >
      {children}
    </span>
  );
}

function DwellingCard({
  icon,
  title,
  hint,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-colors ${
        selected ? 'border-accent bg-accent-soft' : 'border-border-soft bg-surface hover:border-accent/50'
      }`}
    >
      <span className={selected ? 'text-accent' : 'text-muted'}>{icon}</span>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-[11px] text-muted">{hint}</span>
    </button>
  );
}

function RoundButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface-raised text-lg font-bold leading-none text-foreground transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border-soft px-4 py-3 text-sm">
      <dt className="flex items-center gap-2 text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Gauge,
  Layers,
  MapPin,
  Plug,
  Plus,
  Save,
  X,
  Zap,
} from 'lucide-react';
import { catalogFor } from '@/domain/catalogs';
import {
  contextDefinition,
  contextsForRole,
  PHASE_LABEL,
  type ContextDefinition,
  type ContextType,
  type MeterPhases,
} from '@/domain/installation-types';
import { MAX_AREA_LABEL_LENGTH, ROLE_LABEL, type MeterRole } from '@/domain/meter-role';
import {
  SELECTABLE_SENSITIVITIES,
  SENSITIVITY_DESCRIPTION,
  SENSITIVITY_LABEL,
  SENSITIVITY_RANGES,
  suggestedFor,
  type Sensitivity,
} from '@/domain/sensitivity';
import {
  MAX_FLOORS,
  MAX_ROOM_NAME_LENGTH,
  MAX_ROOMS,
  type HomeContext,
} from '@/domain/home-types';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { ApiErrorPayload } from '@/lib/types';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { SetupNotice } from './SetupNotice';
import { ReplaceThresholdsDialog } from './ReplaceThresholdsDialog';
import { SkipHomeDialog } from './SkipHomeDialog';

/**
 * Alta del contexto de un medidor.
 *
 * El recorrido no es uno solo: un medidor en el tablero central de una
 * clínica y uno en el garage de una casa necesitan preguntas distintas. Lo
 * que cambia —qué tipos se ofrecen, si corresponde preguntar por pisos, cómo
 * se llaman las subdivisiones, qué aparatos se muestran— sale de
 * `installation-types.ts`, no de condicionales escritos acá. Si mañana se
 * agrega un tipo de lugar, esta pantalla lo soporta sin tocarla.
 */

type Step = 'ubicacion' | 'equipo' | 'lugar' | 'detalle' | 'aparatos' | 'listo';

/** No cambia por su cuenta: se relee muy de vez en cuando, por las dudas. */
const LOAD_INTERVAL_MS = 600000;

/** Las subdivisiones viven en el estado como nombre → aparatos elegidos. */
type Draft = {
  role: MeterRole;
  /** Dónde está instalado, solo si es de área. */
  areaLabel: string;
  phases: MeterPhases;
  /** `null` hasta que el usuario elige el tipo de lugar. */
  contextType: ContextType | null;
  sensitivity: Sensitivity;
  /**
   * Si el usuario ya eligió un grado a mano. Mientras sea `false`, cambiar de
   * tipo de lugar reajusta la sugerencia; después deja de hacerlo, porque
   * sugerir es una cosa y pisar una decisión es otra.
   */
  sensitivityTouched: boolean;
  floors: number;
  rooms: { name: string; appliances: Set<string> }[];
};

type Settings = {
  role: MeterRole;
  areaLabel: string | null;
  phases: MeterPhases;
  sensitivity: Sensitivity;
  thresholds: MeterThresholds;
};

function toDraft(home: HomeContext | null, settings: Settings | null): Draft {
  return {
    role: settings?.role ?? 'central',
    areaLabel: settings?.areaLabel ?? '',
    phases: settings?.phases ?? 1,
    // El tipo guardado solo sirve si le corresponde al rol actual: si el
    // medidor pasó de central a área, "clínica" dejó de ser una opción válida.
    contextType:
      home && contextDefinition(home.contextType)?.role === (settings?.role ?? 'central')
        ? home.contextType
        : null,
    sensitivity: settings?.sensitivity ?? 'media',
    sensitivityTouched: false,
    floors: home?.floors ?? 1,
    rooms: (home?.rooms ?? []).map((room) => ({
      name: room.name,
      appliances: new Set(room.appliances),
    })),
  };
}

/**
 * Los pasos que corresponden a este borrador.
 *
 * El de detalle aparece recién con un tipo elegido: sus preguntas dependen de
 * la definición del contexto, y el grado de sensibilidad se sugiere a partir
 * del lugar.
 */
function stepsFor(def: ContextDefinition | null): Step[] {
  const base: Step[] = ['ubicacion', 'equipo', 'lugar'];
  if (def) base.push('detalle');
  return [...base, 'aparatos'];
}

export function HomeSetup() {
  const router = useRouter();
  // De qué medidor habla esta pantalla. Lo dice la dirección del navegador.
  const deviceId = useMeterId();

  const [step, setStep] = useState<Step>('ubicacion');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeRoom, setActiveRoom] = useState(0);
  const [roomInput, setRoomInput] = useState('');
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  /** El grado que ya tenía el medidor, para no reescribirlo sin motivo. */
  const [savedSensitivity, setSavedSensitivity] = useState<Sensitivity | null>(null);
  /** Umbrales vigentes, para poder decir en el cartel qué se pierde. */
  const [savedThresholds, setSavedThresholds] = useState<MeterThresholds | null>(null);
  /** Grado elegido que todavía espera confirmación, por pisar umbrales a mano. */
  const [pendingSensitivity, setPendingSensitivity] = useState<Sensitivity | null>(null);

  const load = useCallback(async () => {
    try {
      // El contexto y la ubicación del medidor viven en rutas distintas, pero
      // el asistente necesita las dos para armar el borrador: el rol decide
      // qué tipos de lugar se ofrecen.
      const [homeRes, settingsRes] = await Promise.all([
        fetch(apiUrl('/api/meter/home', deviceId), { cache: 'no-store' }),
        fetch(apiUrl('/api/meter/settings', deviceId), { cache: 'no-store' }),
      ]);
      const [homePayload, settingsPayload] = await Promise.all([
        homeRes.json(),
        settingsRes.json(),
      ]);

      if (!homeRes.ok) {
        setError(homePayload as ApiErrorPayload);
        return;
      }
      if (!settingsRes.ok) {
        setError(settingsPayload as ApiErrorPayload);
        return;
      }

      // Solo se completa la primera vez. Una relectura posterior no debe
      // pisar lo que el usuario está cargando ahora.
      setSavedSensitivity((current) => current ?? (settingsPayload as Settings).sensitivity);
      setSavedThresholds((current) => current ?? (settingsPayload as Settings).thresholds);
      setDraft(
        (current) =>
          current ??
          toDraft(homePayload.home as HomeContext | null, settingsPayload as Settings)
      );
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, [deviceId]);

  // No cambia solo: alcanza con leerlo al entrar. Se usa `usePolling` igual
  // que el resto de las vistas porque agenda la primera corrida en vez de
  // escribir estado dentro del efecto.
  usePolling(load, LOAD_INTERVAL_MS);

  const definition = draft?.contextType ? contextDefinition(draft.contextType) : null;
  const steps = useMemo(() => stepsFor(definition), [definition]);

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

  function goBack() {
    const index = steps.indexOf(step);
    if (index <= 0) setSkipOpen(true);
    else setStep(steps[index - 1]);
  }

  function goNext() {
    const index = steps.indexOf(step);
    if (index < 0 || index >= steps.length - 1) return;

    const next = steps[index + 1];
    // Un contexto que no se subdivide necesita igual una fila donde poner los
    // aparatos. Se crea al entrar al paso y no antes, para no inventar una
    // subdivisión si el usuario se vuelve atrás.
    if (next === 'aparatos') ensureSingleRoom();
    setStep(next);
  }

  function addRoom(name: string) {
    const clean = name.trim().slice(0, MAX_ROOM_NAME_LENGTH);
    if (clean === '') return;

    updateDraft((current) => {
      const exists = current.rooms.some((room) => room.name.toLowerCase() === clean.toLowerCase());
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

  /** Elegir el tipo de lugar reinicia lo que dependía del tipo anterior. */
  function chooseContext(type: ContextType) {
    updateDraft((current) => {
      if (current.contextType === type) return current;

      // Una caída de tensión en terapia intensiva no es lo mismo que en un
      // depósito. Se sugiere, no se impone: solo mientras el usuario no haya
      // elegido, y nunca sobre unos umbrales ajustados a mano.
      const sugerir =
        !current.sensitivityTouched && current.sensitivity !== 'personalizada';

      return {
        ...current,
        contextType: type,
        rooms: [],
        sensitivity: sugerir ? suggestedFor(type) : current.sensitivity,
      };
    });
    setActiveRoom(0);
  }

  /**
   * Cambiar el rol invalida el tipo elegido: los tipos de un central no son
   * los de un área, y el backend rechaza la combinación cruzada.
   */
  function chooseRole(role: MeterRole) {
    updateDraft((current) =>
      current.role === role ? current : { ...current, role, contextType: null, rooms: [] }
    );
  }

  async function save() {
    if (!draft || !definition) return;
    setSaving(true);

    try {
      // Primero la ubicación: el guardado del contexto valida que el tipo le
      // corresponda al rol que el medidor tiene en la base. Si fuera al
      // revés, cambiar de central a área y elegir "garage" en la misma
      // pasada daría un 400.
      const placement = await fetch(apiUrl('/api/meter/settings', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: draft.role,
          areaLabel: draft.role === 'area' ? draft.areaLabel.trim() : undefined,
          phases: draft.phases,
          // Solo si cambió: mandarlo igual reescribiría unos umbrales que
          // alguien pudo haber ajustado a mano a propósito.
          sensitivity:
            draft.sensitivity !== savedSensitivity && draft.sensitivity !== 'personalizada'
              ? draft.sensitivity
              : undefined,
        }),
      });

      if (!placement.ok) {
        setError((await placement.json()) as ApiErrorPayload);
        return;
      }

      // Un contexto que no se subdivide igual guarda una fila: es donde van
      // sus aparatos. El nombre sale de dónde está instalado el medidor.
      //
      // La fila se garantiza acá, y no solo al entrar al paso de aparatos,
      // porque mandar `rooms: []` no guarda "sin aparatos": **borra el
      // contexto entero** y el backend devuelve `home: null`. Es deliberado
      // de su lado —vaciar todo y no haber cargado nunca son el mismo
      // estado— pero significa que una lista vacía que llegue acá por
      // cualquier camino destruye datos sin aviso. Un medidor sin aparatos
      // marcados manda su fila con `appliances: []`, que sí es lo que el
      // usuario quiso decir.
      const rooms = definition.hasSubdivisions
        ? draft.rooms
        : [
            {
              ...draft.rooms[0],
              name: draft.rooms[0]?.name || fallbackRoomName(draft, definition),
              appliances: draft.rooms[0]?.appliances ?? new Set<string>(),
            },
          ];

      const response = await fetch(apiUrl('/api/meter/home', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextType: draft.contextType,
          floors: definition.hasFloors ? draft.floors : null,
          rooms: rooms.map((room) => ({
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
      setError({ error: 'No se pudo guardar la configuración del medidor.' });
    } finally {
      setSaving(false);
    }
  }

  function leave() {
    router.push('/medidores');
  }

  function applySensitivity(sensitivity: Sensitivity) {
    updateDraft((current) => ({ ...current, sensitivity, sensitivityTouched: true }));
  }

  /**
   * Unos umbrales a mano son una decisión, y el backend no ofrece camino de
   * vuelta: elegir un grado los reemplaza y recuperarlos exige tocar la base.
   * Por eso se pregunta una vez, y solo cuando hay algo que perder.
   */
  function chooseSensitivity(sensitivity: Sensitivity) {
    if (draft?.sensitivity === 'personalizada') {
      setPendingSensitivity(sensitivity);
      return;
    }
    applySensitivity(sensitivity);
  }

  /** Antes de entrar a los aparatos hay que tener dónde ponerlos. */
  function ensureSingleRoom() {
    if (definition?.hasSubdivisions) return;
    updateDraft((current) => {
      if (current.rooms.length > 0) return current;
      return {
        ...current,
        rooms: [{ name: fallbackRoomName(current, definition), appliances: new Set() }],
      };
    });
  }

  const stepIndex = steps.indexOf(step);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-3xl w-full mx-auto">
      {step !== 'listo' && (
        <>
          <div className="flex items-center gap-2.5 mb-4">
            <button
              type="button"
              onClick={goBack}
              aria-label="Volver"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {TITLES[step](definition)}
            </h1>
          </div>

          {/* Una barra por paso. Con tan pocos, un contador escrito
              ("paso 2 de 5") ocuparía más y diría lo mismo. */}
          <div className="flex items-center gap-1.5 mb-5" aria-hidden>
            {steps.map((item, index) => (
              <span
                key={item}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  index <= stepIndex ? 'bg-accent' : 'bg-border-soft'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {error && !error.missingEnv && <ErrorNote message={error.error} />}

      {step === 'ubicacion' && (
        <StepPlacement
          draft={draft}
          onRole={chooseRole}
          onAreaLabel={(value) =>
            updateDraft((current) => ({
              ...current,
              areaLabel: value.slice(0, MAX_AREA_LABEL_LENGTH),
            }))
          }
          onNext={goNext}
          onSkip={() => setSkipOpen(true)}
        />
      )}

      {step === 'equipo' && (
        <StepPhases
          draft={draft}
          onPhases={(phases) => updateDraft((current) => ({ ...current, phases }))}
          onNext={goNext}
        />
      )}

      {step === 'lugar' && (
        <StepContext draft={draft} onChoose={chooseContext} onNext={goNext} />
      )}

      {step === 'detalle' && definition && (
        <StepDetail
          draft={draft}
          definition={definition}
          roomInput={roomInput}
          onRoomInput={setRoomInput}
          onSensitivity={chooseSensitivity}
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
            goNext();
          }}
          onSkip={() => setSkipOpen(true)}
        />
      )}

      {step === 'aparatos' && definition && (
        <StepAppliances
          draft={draft}
          definition={definition}
          activeRoom={activeRoom}
          totalAppliances={totalAppliances}
          saving={saving}
          onActiveRoom={setActiveRoom}
          onToggle={toggleAppliance}
          onSave={save}
          onSkip={() => setSkipOpen(true)}
        />
      )}

      {step === 'listo' && definition && (
        <StepDone
          draft={draft}
          definition={definition}
          totalAppliances={totalAppliances}
          onLeave={leave}
        />
      )}

      <ReplaceThresholdsDialog
        open={pendingSensitivity !== null}
        target={pendingSensitivity}
        current={savedThresholds}
        onCancel={() => setPendingSensitivity(null)}
        onConfirm={() => {
          const elegido = pendingSensitivity;
          setPendingSensitivity(null);
          if (elegido) applySensitivity(elegido);
        }}
      />

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

const TITLES: Record<Step, (def: ContextDefinition | null) => string> = {
  ubicacion: () => '¿Dónde está el medidor?',
  equipo: () => '¿Qué tipo de equipo es?',
  lugar: () => '¿Qué tipo de lugar es?',
  detalle: (def) => (def?.hasSubdivisions ? `¿Qué ${def.subdivision.plural.toLowerCase()} tiene?` : 'Algunos detalles'),
  aparatos: (def) =>
    def?.hasSubdivisions ? `¿Qué hay en cada ${def.subdivision.singular.toLowerCase()}?` : '¿Qué hay en el lugar?',
  listo: () => '',
};

/** Nombre de la única fila en un contexto que no se subdivide. */
function fallbackRoomName(draft: Draft, definition: ContextDefinition | null): string {
  const label = draft.areaLabel.trim();
  if (label !== '') return label.slice(0, MAX_ROOM_NAME_LENGTH);
  return (definition?.label ?? 'Lugar').slice(0, MAX_ROOM_NAME_LENGTH);
}

/* -------------------------------------------------------------------------- */
/* Paso 1: dónde está instalado                                               */
/* -------------------------------------------------------------------------- */

function StepPlacement({
  draft,
  onRole,
  onAreaLabel,
  onNext,
  onSkip,
}: {
  draft: Draft;
  onRole: (role: MeterRole) => void;
  onAreaLabel: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const listo = draft.role === 'central' || draft.areaLabel.trim() !== '';

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-6">
        Un medidor puede estar en el tablero que alimenta todo el lugar, o en
        un sector puntual dentro de él. De esto depende cómo se lee lo que mide.
      </p>

      <section className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={<Zap className="h-6 w-6" />}
            title={ROLE_LABEL.central}
            hint="Mide todo lo que consume el lugar."
            selected={draft.role === 'central'}
            onClick={() => onRole('central')}
          />
          <ChoiceCard
            icon={<MapPin className="h-6 w-6" />}
            title={ROLE_LABEL.area}
            hint="Mide solo lo que se usa en un sector."
            selected={draft.role === 'area'}
            onClick={() => onRole('area')}
          />
        </div>
      </section>

      {draft.role === 'area' && (
        <section className="mb-6 animate-fade-in">
          <div className="flex items-center gap-1.5 mb-2.5">
            <FieldLabel className="mb-0">¿Dónde está instalado?</FieldLabel>
            <InfoTooltip
              title="Dónde está instalado"
              text="El nombre del sector que alimenta este medidor, como lo llamás vos: 'Terapia intensiva', 'Oficina de ventas', 'Garage'. Aparece en las pantallas para distinguirlo de los demás medidores."
            />
          </div>
          <input
            type="text"
            value={draft.areaLabel}
            maxLength={MAX_AREA_LABEL_LENGTH}
            onChange={(event) => onAreaLabel(event.target.value)}
            placeholder="Ej: Terapia intensiva"
            className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
          />
        </section>
      )}

      <div className="flex flex-col gap-2.5">
        <PrimaryButton onClick={onNext} disabled={!listo}>
          Continuar
        </PrimaryButton>
        <SkipButton onClick={onSkip} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 2: monofásico o trifásico                                             */
/* -------------------------------------------------------------------------- */

function StepPhases({
  draft,
  onPhases,
  onNext,
}: {
  draft: Draft;
  onPhases: (phases: MeterPhases) => void;
  onNext: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-6">
        Si no sabés cuál es, seguí con monofásico: es lo habitual en
        instalaciones chicas. Se puede cambiar después desde Ajustes.
      </p>

      <section className="mb-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={<Plug className="h-6 w-6" />}
            title={PHASE_LABEL[1]}
            hint="Lo habitual en casas y locales chicos."
            selected={draft.phases === 1}
            onClick={() => onPhases(1)}
          />
          <ChoiceCard
            icon={<Gauge className="h-6 w-6" />}
            title={PHASE_LABEL[3]}
            hint="Habitual con maquinaria o equipos grandes."
            selected={draft.phases === 3}
            onClick={() => onPhases(3)}
          />
        </div>
        {draft.phases === 3 && (
          <p className="mt-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted leading-relaxed animate-fade-in">
            Queda registrado para no tener que rehacer el alta más adelante. Por
            ahora las pantallas muestran una sola medición, no una por fase.
          </p>
        )}
      </section>

      <PrimaryButton onClick={onNext}>Continuar</PrimaryButton>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 3: qué tipo de lugar                                                  */
/* -------------------------------------------------------------------------- */

function StepContext({
  draft,
  onChoose,
  onNext,
}: {
  draft: Draft;
  onChoose: (type: ContextType) => void;
  onNext: () => void;
}) {
  const options = contextsForRole(draft.role);

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-6">
        {draft.role === 'central'
          ? 'Elegí qué es la instalación que alimenta este tablero.'
          : 'Elegí qué es el sector que mide este medidor.'}
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 mb-8">
        {options.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => onChoose(option.type)}
            aria-pressed={draft.contextType === option.type}
            className={`rounded-2xl border px-3 py-4 text-sm font-semibold transition-colors ${
              draft.contextType === option.type
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border-soft bg-surface text-foreground hover:border-accent/50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <PrimaryButton onClick={onNext} disabled={draft.contextType === null}>
        Continuar
      </PrimaryButton>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 4: pisos y subdivisiones, según lo que el contexto admita             */
/* -------------------------------------------------------------------------- */

function StepDetail({
  draft,
  definition,
  roomInput,
  onRoomInput,
  onSensitivity,
  onFloors,
  onAddRoom,
  onRemoveRoom,
  onNext,
  onSkip,
}: {
  draft: Draft;
  definition: ContextDefinition;
  roomInput: string;
  onRoomInput: (value: string) => void;
  onSensitivity: (sensitivity: Sensitivity) => void;
  onFloors: (delta: number) => void;
  onAddRoom: (name: string) => void;
  onRemoveRoom: (name: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { singular, plural, prompt, suggestions } = definition.subdivision;

  const pending = suggestions.filter(
    (name) => !draft.rooms.some((room) => room.name.toLowerCase() === name.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-6">
        Con esto y los aparatos del paso siguiente, las recomendaciones van a
        ser mucho más precisas.
      </p>

      {definition.hasFloors && (
        <section className="mb-6">
          <FieldLabel>Cantidad de pisos</FieldLabel>
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
      )}

      {definition.hasSubdivisions && (
        <section className="mb-8">
          <div className="flex items-center gap-1.5 mb-2.5">
            <FieldLabel className="mb-0">{prompt}</FieldLabel>
            <InfoTooltip
              title={plural}
              text={`Los lugares que alimenta este medidor. En el paso siguiente vas a marcar qué aparatos hay en cada ${singular.toLowerCase()}, así las recomendaciones pueden decirte dónde se está yendo el consumo.`}
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
              placeholder={`Ej: ${suggestions[0] ?? singular}`}
              className="h-11 flex-1 rounded-xl border border-border-soft bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => onAddRoom(roomInput)}
              aria-label={`Agregar ${singular.toLowerCase()}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {pending.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onAddRoom(name)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-soft px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {name}
                </button>
              ))}
            </div>
          )}

          {draft.rooms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-soft px-4 py-5 text-center text-xs text-muted">
              Todavía no agregaste {suggestions.length > 0 ? 'ninguno' : `ningún ${singular.toLowerCase()}`}.{' '}
              {suggestions.length > 0
                ? 'Tocá una sugerencia o escribí el nombre.'
                : 'Escribí el nombre y tocá el más.'}
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
                    <span className="text-xs text-muted tabular-nums">{room.appliances.size}</span>
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
      )}

      <section className="mb-8">
        <div className="flex items-center gap-1.5 mb-2.5">
          <FieldLabel className="mb-0">¿Cuánto querés enterarte?</FieldLabel>
          <InfoTooltip
            title="Sensibilidad de las alertas"
            text="Define cuán lejos de los 220 V tiene que irse la tensión para que se registre una anomalía. Es un umbral de aviso del producto, no un límite normativo: salir del rango elegido no significa que haya peligro, significa que pediste enterarte."
          />
        </div>
        <p className="text-xs text-muted leading-relaxed mb-3">
          Lo proponemos según el lugar que elegiste. Podés cambiarlo ahora o
          más adelante desde Ajustes.
        </p>

        <div className="space-y-2">
          {SELECTABLE_SENSITIVITIES.map((option) => {
            const isSelected = draft.sensitivity === option;
            const range = SENSITIVITY_RANGES[option];
            return (
              <label
                key={option}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-soft/40'
                    : 'border-border-soft bg-surface hover:border-muted/40'
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="sensibilidad-alta"
                    className="mt-0.5 accent-accent"
                    checked={isSelected}
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

        {/* Unos umbrales puestos a mano son una decisión, no un descuido: se
            respetan salvo que el usuario elija otra cosa acá. */}
        {draft.sensitivity === 'personalizada' && (
          <p className="mt-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted leading-relaxed">
            Este medidor tiene umbrales ajustados a mano, así que se dejan como
            están. Si elegís uno de los grados de arriba, se reemplazan.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2.5">
        <PrimaryButton
          onClick={onNext}
          disabled={definition.hasSubdivisions && draft.rooms.length === 0}
        >
          Continuar
        </PrimaryButton>
        <SkipButton onClick={onSkip} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 5: aparatos                                                           */
/* -------------------------------------------------------------------------- */

function StepAppliances({
  draft,
  definition,
  activeRoom,
  totalAppliances,
  saving,
  onActiveRoom,
  onToggle,
  onSave,
  onSkip,
}: {
  draft: Draft;
  definition: ContextDefinition;
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

  const categories = catalogFor(definition.catalog);

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted leading-relaxed mb-4">
        {definition.hasSubdivisions ? (
          <>
            Marcá lo que hay en <b className="text-foreground">{room.name}</b>. Solo
            necesitamos saber qué hay, no la potencia de cada uno.
          </>
        ) : (
          <>Marcá lo que hay. Solo necesitamos saber qué hay, no la potencia de cada uno.</>
        )}
      </p>

      {/* Un tab por subdivisión. Con muchas, la fila scrollea sola en vez de
          envolver: envolviendo, el alto de la cabecera cambiaría según
          cuántas tenga cada usuario. */}
      {definition.hasSubdivisions && (
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
      )}

      {categories.map((category) => (
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
/* Paso 6: confirmación                                                       */
/* -------------------------------------------------------------------------- */

function StepDone({
  draft,
  definition,
  totalAppliances,
  onLeave,
}: {
  draft: Draft;
  definition: ContextDefinition;
  totalAppliances: number;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 animate-fade-in">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-ok/15">
        <Check className="h-8 w-8 text-ok" strokeWidth={2.5} />
      </span>

      <h1 className="text-xl font-bold tracking-tight mb-2">Listo, guardamos tu medidor</h1>
      <p className="max-w-sm text-sm text-muted leading-relaxed mb-7">
        Esta información va a ir afinando las recomendaciones y proyecciones a
        medida que el medidor junte más datos.
      </p>

      <dl className="w-full max-w-sm flex flex-col gap-2 mb-7">
        <SummaryRow
          icon={draft.role === 'central' ? <Zap className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
          label="Ubicación"
          value={
            draft.role === 'central'
              ? ROLE_LABEL.central
              : `${ROLE_LABEL.area} · ${draft.areaLabel.trim()}`
          }
        />
        <SummaryRow
          icon={<Plug className="h-4 w-4" />}
          label="Lugar"
          value={
            definition.hasFloors
              ? `${definition.label} · ${draft.floors} ${draft.floors === 1 ? 'piso' : 'pisos'}`
              : definition.label
          }
        />
        <SummaryRow icon={<Gauge className="h-4 w-4" />} label="Equipo" value={PHASE_LABEL[draft.phases]} />
        {definition.hasSubdivisions && (
          <SummaryRow
            icon={<Layers className="h-4 w-4" />}
            label={definition.subdivision.plural}
            value={String(draft.rooms.length)}
          />
        )}
        <SummaryRow
          icon={<Plug className="h-4 w-4" />}
          label="Aparatos cargados"
          value={String(totalAppliances)}
        />
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

function ChoiceCard({
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
      <span className="text-[11px] text-muted leading-snug">{hint}</span>
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto py-2 text-sm font-semibold text-muted underline underline-offset-2 transition-colors hover:text-foreground"
    >
      Omitir por ahora
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

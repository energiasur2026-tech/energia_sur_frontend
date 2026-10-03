'use client';

import { useState } from 'react';
import { Target, Trash2 } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { GoalInputMode, GoalProgress } from '@/lib/goal';
import { InfoTooltip } from './InfoTooltip';

/**
 * Definición de la meta mensual.
 *
 * Se puede escribir en kWh o en pesos porque la gente piensa su factura de las
 * dos maneras. En pesos se convierte con el cuadro tarifario del lado del
 * servidor: acá solo se elige la unidad.
 */
export function GoalSetter({
  goal,
  onSaved,
}: {
  goal: GoalProgress;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(goal.status === 'no_goal');
  const [mode, setMode] = useState<GoalInputMode>(goal.inputMode);
  const [value, setValue] = useState(() => initialValue(goal));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(nextValue: number | null) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/meter/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, value: nextValue }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'No se pudo guardar el objetivo.');
        return;
      }

      setOpen(false);
      onSaved();
    } catch {
      setError('No se pudo contactar al servidor.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <span className="text-sm text-muted">Tu objetivo del mes:</span>
            <strong className="text-sm">
              {formatNumber(goal.goalKwh, 0)} kWh
              {goal.goalCostArs !== null && (
                <span className="font-normal text-muted"> · ≈ {formatCurrency(goal.goalCostArs)}</span>
              )}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Cambiar objetivo
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-accent/40 bg-surface p-4 md:p-5 lg:p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Target className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">
          {goal.status === 'no_goal' ? 'Ponete un objetivo mensual' : 'Cambiar tu objetivo'}
        </h2>
        <InfoTooltip title="Tu objetivo mensual" text="Es cuánto querés gastar de luz este mes. Con eso, la app te dice cuánto podés consumir por día y te avisa si te estás pasando, con tiempo para corregir." />
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">
        Escribilo como te resulte natural: en pesos, si pensás en la factura, o
        en kWh si mirás el consumo. Es lo mismo, convertido con el cuadro
        tarifario.
      </p>

      {error && (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-1 rounded-xl bg-surface-raised p-1 mb-4 w-fit">
        {(['ars', 'kwh'] as GoalInputMode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              mode === option ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            {option === 'ars' ? 'En pesos' : 'En kWh'}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            setError('Ingresá un número mayor a cero.');
            return;
          }
          save(parsed);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex-1 min-w-[10rem]">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {mode === 'ars' ? 'Quiero que la factura no pase de' : 'Quiero consumir como máximo'}
          </span>
          <span className="relative mt-1.5 flex items-center">
            {mode === 'ars' && (
              <span className="absolute left-3 text-sm text-muted">$</span>
            )}
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'ars' ? '30000' : '150'}
              className={`w-full rounded-xl border border-border-soft bg-surface-raised py-2.5 pr-14 text-sm text-foreground outline-none focus:border-accent ${
                mode === 'ars' ? 'pl-7' : 'pl-3'
              }`}
            />
            <span className="absolute right-3 text-xs text-muted">
              {mode === 'ars' ? 'por mes' : 'kWh'}
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar objetivo'}
        </button>

        {goal.status !== 'no_goal' && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Quitar
          </button>
        )}
      </form>
    </section>
  );
}

function initialValue(goal: GoalProgress): string {
  if (goal.goalKwh === null) return '';
  return goal.inputMode === 'ars' && goal.goalCostArs !== null
    ? String(Math.round(goal.goalCostArs))
    : String(Math.round(goal.goalKwh));
}

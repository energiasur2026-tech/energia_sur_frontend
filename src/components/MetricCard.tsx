import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NO_DATA } from '@/lib/format';
import { InfoTooltip } from './InfoTooltip';
import { ValueFade } from './ValueFade';

type Props = {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
  /**
   * Explicación del concepto para alguien sin conocimientos técnicos. Debe
   * decir QUÉ ES la magnitud, no repetir el número que ya está a la vista.
   */
  tip?: string;
  action?: { label: string; href: string };
};

const TONE_CLASS = {
  default: 'text-accent',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
} as const;

export function MetricCard({
  label,
  value,
  unit,
  icon,
  hint,
  tone = 'default',
  tip,
  action,
}: Props) {
  const hasValue = value !== NO_DATA;

  return (
    <article className="flex min-w-0 flex-col justify-between gap-1 rounded-2xl border border-border-soft bg-surface px-4 py-3 lg:min-h-28">
      <header className="flex items-center gap-2">
        <span className={`${TONE_CLASS[tone]} shrink-0 mt-px`}>{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted leading-snug">
          {label}
        </h3>
        {/* Sin span envoltorio: al ser item flex se bloquificaba y creaba una
            caja de linea de 24 px que empujaba el icono ~6 px hacia abajo. */}
        {tip && <InfoTooltip text={tip} title={label} />}
      </header>

      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <ValueFade
          value={value}
          className={`text-3xl font-bold tabular-nums tracking-tight ${
            hasValue ? '' : 'text-muted'
          }`}
        />
        {hasValue && unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </p>

      <p className="min-h-4 text-xs text-muted">
        <ValueFade value={hint ?? ''} />
      </p>

      {action && (
        <Link
          href={action.href}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          {action.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </article>
  );
}

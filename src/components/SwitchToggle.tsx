'use client';

/**
 * Interruptor de dos opciones, con las DOS visibles al mismo tiempo.
 *
 * Es deliberadamente distinto de un botón que rota entre estados. Ese patrón
 * ahorra espacio pero esconde la alternativa: quien entra por primera vez ve
 * una sola opción y no tiene forma de saber que existe otra, salvo tocando a
 * ver qué pasa. Acá las dos etiquetas están siempre a la vista y lo único que
 * se mueve es el indicador, así que de un vistazo se entiende qué se puede
 * elegir y qué está elegido.
 *
 * El indicador se desplaza con una transición: el movimiento es lo que hace
 * leer el control como un interruptor y no como dos botones sueltos.
 */
export function SwitchToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = 'accent',
  size = 'md',
}: {
  /** Exactamente dos: es un interruptor, no una lista. */
  options: readonly [
    { value: T; label: string; icon?: React.ReactNode },
    { value: T; label: string; icon?: React.ReactNode },
  ];
  value: T;
  onChange: (value: T) => void;
  /** Qué se está eligiendo. Lo anuncian los lectores de pantalla. */
  label: string;
  /** `accent` para filtros; `neutral` cuando ninguna opción es "la activa". */
  tone?: 'accent' | 'neutral';
  size?: 'sm' | 'md';
}) {
  const index = options.findIndex((option) => option.value === value);
  // Si el valor no coincide con ninguna opción, se asume la primera antes que
  // dejar el indicador en un limbo visual.
  const activeIndex = index === -1 ? 0 : index;

  const height = size === 'sm' ? 'h-9' : 'h-11';
  const text = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid grid-cols-2 ${height} w-full rounded-full bg-surface-raised p-1`}
    >
      {/* El indicador va detrás de las etiquetas y ocupa media caja. Se
          posiciona por transform y no cambiando `left`, que es lo que permite
          que el navegador lo anime sin recalcular el layout en cada cuadro. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${
          tone === 'accent' ? 'bg-accent' : 'bg-surface'
        } ${activeIndex === 1 ? 'translate-x-full' : 'translate-x-0'}`}
      />

      {options.map((option, optionIndex) => {
        const selected = optionIndex === activeIndex;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full ${text} font-semibold transition-colors ${
              selected
                ? tone === 'accent'
                  ? 'text-white'
                  : 'text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

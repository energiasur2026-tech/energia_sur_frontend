'use client';

/**
 * Aparicion suave de un valor que termino de cargar.
 *
 * Los KPIs arrancan mostrando `--` y cambiaban de golpe al numero, lo que se
 * ve como un salto. Al usar el propio valor como `key`, React reemplaza el
 * nodo en cada cambio y el navegador vuelve a correr la animacion CSS: el dato
 * entra con un desenfoque corto en vez de un corte seco.
 *
 * Se hace con CSS y no con `AnimatePresence` por lo mismo que la transicion de
 * seccion: la version con framer-motion podia quedarse en su estado inicial y
 * dejar el valor invisible. Un numero que no se ve es mucho peor que un numero
 * sin animar, asi que conviene el mecanismo que no puede fallar.
 */
export function ValueFade({ value, className }: { value: string; className?: string }) {
  return (
    <span key={value} className={`animate-value-in ${className ?? ''}`}>
      {value}
    </span>
  );
}

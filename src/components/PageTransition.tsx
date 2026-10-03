'use client';

import { usePathname } from 'next/navigation';

/**
 * Transicion al cambiar de seccion: la vista entrante aparece con un
 * desvanecido y un desplazamiento corto desde abajo.
 *
 * La animacion es CSS, no framer-motion. Con `motion.div` la seccion quedaba
 * clavada en `opacity: 0` al navegar —medido en el navegador: el atributo
 * style se quedaba en el estado inicial y la pantalla se veia vacia— porque el
 * enrutador de Next monta la vista dentro de una transicion de React y el
 * efecto que arranca la animacion no llegaba a ejecutarse. Con CSS eso no
 * puede pasar: la animacion corre sola al montarse el elemento, y `both` como
 * fill-mode garantiza que el estado final quede aplicado.
 *
 * La `key` es la ruta: al cambiar, React reemplaza el nodo del DOM y el
 * navegador vuelve a correr la animacion desde cero.
 *
 * Con "reducir movimiento" activado, la regla `@media` de globals.css anula la
 * animacion. Es una preferencia de accesibilidad real —hay gente a la que el
 * movimiento le provoca mareo— y respetarla no cuesta nada.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="flex-1 flex flex-col animate-section-in">
      {children}
    </div>
  );
}

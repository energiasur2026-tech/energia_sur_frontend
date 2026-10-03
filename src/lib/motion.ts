'use client';

import type { Transition } from 'framer-motion';

/**
 * Tiempos y curvas compartidos por los efectos que siguen en framer-motion.
 *
 * Antes este archivo tenia tambien las variantes de la transicion de seccion,
 * la aparicion de los KPIs y el despliegue del grafico de un evento. Los tres
 * pasaron a CSS: dependian de que framer-motion arrancara la animacion desde
 * un efecto de React, y cuando eso no ocurria el elemento quedaba clavado en
 * su estado inicial —invisible— en vez de simplemente no animarse. Para
 * contenido que tiene que verse si o si, una animacion CSS es la opcion
 * segura: si el elemento se monta, el navegador la corre.
 *
 * Lo que queda aca es el modal de informacion, que es contenido efimero: si su
 * animacion fallara no se pierde nada de la pantalla.
 */

/** Aparicion del cartel anclado en escritorio. */
export const DURATION_FAST = 0.28;

/** Curva de salida suave: arranca rapido y desacelera. */
export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1];

/**
 * Modal de informacion, al estilo de iOS: entra con un resorte que sobrepasa
 * apenas su tamano final y se asienta. El resorte es lo que da la sensacion
 * fisica del sistema de Apple; una curva de duracion fija se siente plana.
 */
export const modalSpring: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.9,
};

/**
 * La salida SI es de duracion fija. Un resorte tarda en asentarse del todo y
 * `AnimatePresence` no desmonta hasta que la animacion termina, asi que cerrar
 * con resorte se percibe pegajoso.
 */
export const modalExit: Transition = {
  duration: 0.18,
  ease: 'easeIn',
};

import { redirect } from 'next/navigation';

/**
 * La raíz ya no es una landing con botón "Ingresar": con login real, esa
 * pantalla intermedia solo agregaba un paso. Quien tiene sesión termina en el
 * Monitor y quien no, en el login — de eso se encarga `proxy.ts` y la guardia
 * del grupo (app).
 */
export default function Home() {
  redirect('/dashboard');
}

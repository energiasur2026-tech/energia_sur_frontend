import { redirect } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { PageTransition } from '@/components/PageTransition';
import { SetupNotice } from '@/components/SetupNotice';
import { WelcomeDialog } from '@/components/WelcomeDialog';
import { getCurrentUser } from '@/lib/auth';
import { MissingEnvError } from '@/lib/errors';

/**
 * Único punto de guardia para todo lo que vive bajo (app): sin sesión, se
 * redirige a /login antes de renderizar Monitor o Consumo. `proxy.ts` hace
 * lo mismo a nivel de request, pero según la documentación de Next.js 16 no
 * hay que confiar solo en eso — cada punto de entrada verifica por su cuenta.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return <SetupNotice missing={error.keys} />;
    }
    throw error;
  }

  if (!user) redirect('/login');

  return (
    // `pb-nav` reserva en mobile el alto de la barra inferior fija, para que
    // el final del contenido no quede tapado detrás de ella.
    <div className="flex-1 flex flex-col pb-nav">
      <AppNav userEmail={user.email} />
      <PageTransition>{children}</PageTransition>
      {/* Va en el layout y no en una pantalla: aparece al entrar a la app, sea
          cual sea la seccion a la que se llegue despues del login. */}
      <WelcomeDialog />
    </div>
  );
}

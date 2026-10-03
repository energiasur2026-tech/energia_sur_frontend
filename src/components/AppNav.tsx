'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gauge,
  LayoutGrid,
  LogOut,
  Receipt,
  Settings,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { ThemeToggle } from './ThemeToggle';

/** `short` es la etiqueta de la barra inferior, donde el ancho es escaso. */
const LINKS = [
  { href: '/medidores', label: 'Mis medidores', short: 'Medidores', icon: LayoutGrid },
  { href: '/dashboard', label: 'Monitor', short: 'Monitor', icon: Gauge },
  { href: '/consumo', label: 'Consumo', short: 'Consumo', icon: Receipt },
  { href: '/proyeccion', label: 'Proyección', short: 'Objetivo', icon: TrendingUp },
  { href: '/eventos', label: 'Eventos', short: 'Eventos', icon: TriangleAlert },
  { href: '/ajustes', label: 'Ajustes', short: 'Ajustes', icon: Settings },
] as const;

export function AppNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <MobileHeader onLogout={onLogout} />
      <TopNav pathname={pathname} userEmail={userEmail} onLogout={onLogout} />
      <BottomNav pathname={pathname} />
    </>
  );
}

/**
 * Encabezado de celular: marca, tema y salir. Lo que en escritorio vive en la
 * barra superior junto a las pestañas, acá se separa — abajo van las
 * secciones, arriba las acciones de cuenta.
 */
function MobileHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="md:hidden flex items-center justify-between gap-3 border-b border-border-soft bg-surface px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft">
          <Zap className="h-4 w-4 text-accent" />
        </span>
        <span className="text-sm font-bold tracking-tight">EnergIA Sur</span>
      </span>

      <span className="flex items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </span>
    </header>
  );
}

/** Navegación de escritorio: pestañas arriba, con la cuenta a la derecha. */
function TopNav({
  pathname,
  userEmail,
  onLogout,
}: {
  pathname: string;
  userEmail: string | null;
  onLogout: () => void;
}) {
  return (
    <nav className="hidden md:block border-b border-border-soft bg-surface">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-accent text-foreground'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          {userEmail && <span className="hidden lg:inline">{userEmail}</span>}
          <ThemeToggle />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-muted transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}

/**
 * Navegación de celular: barra fija abajo, al alcance del pulgar, como una
 * app nativa. Sin menú hamburguesa — las seis secciones están siempre a la
 * vista, que es la diferencia entre sentirse app y sentirse web achicada.
 */
function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border-soft bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Las columnas se derivan de la cantidad de secciones: sumar una
          entrada a LINKS no obliga a tocar la grilla. */}
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${LINKS.length}, minmax(0, 1fr))` }}>
        {LINKS.map(({ href, short, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

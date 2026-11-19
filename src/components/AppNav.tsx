'use client';

import { useNavigationPreferences } from './NavigationPreferences';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gauge,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { meterHref, useMeterId } from '@/lib/use-meter-id';
import { MeterPicker } from './MeterPicker';
import { ThemeToggle } from './ThemeToggle';

/** `short` es la etiqueta de la barra inferior, donde el ancho es escaso. */
const LINKS = [
  { href: '/medidores', label: 'Mis dispositivos', short: 'Equipos', icon: LayoutGrid },
  { href: '/dashboard', label: 'Monitor', short: 'Monitor', icon: Gauge },
  { href: '/consumo', label: 'Consumo', short: 'Consumo', icon: Receipt },
  { href: '/proyeccion', label: 'Proyección', short: 'Objetivo', icon: TrendingUp },
  { href: '/eventos', label: 'Eventos', short: 'Eventos', icon: TriangleAlert },
  { href: '/ajustes', label: 'Ajustes', short: 'Ajustes', icon: Settings },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function AppNav({ userEmail }: { userEmail: string | null }) {
  const { position, collapsed, save, waitForSave } = useNavigationPreferences();
  const pathname = usePathname();
  const router = useRouter();
  // El medidor elegido viaja en cada enlace de la barra. Sin esto, pasar de
  // Consumo a Monitor lo perdería y la pantalla mostraría otro medidor sin
  // decir nada: el backend, sin el parámetro, resuelve el primero accesible.
  const deviceId = useMeterId();

  async function onLogout() {
    await waitForSave();
    await supabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <MobileHeader onLogout={onLogout} />
      {position === 'side' ? <>
        <SideNav pathname={pathname} deviceId={deviceId} collapsed={collapsed} onToggle={() => save({ collapsed: !collapsed })} />
        <header className="app-sidebar-header hidden md:block border-b border-border-soft bg-navigation-surface">
          <div className="mx-auto flex max-w-screen-2xl min-w-0 items-center justify-end px-4 py-2 lg:px-8">
            <AccountControls userEmail={userEmail} onLogout={onLogout} deviceId={deviceId} />
          </div>
        </header>
      </> : <TopNav
        pathname={pathname}
        deviceId={deviceId}
        userEmail={userEmail}
        onLogout={onLogout}
      />}
      <BottomNav pathname={pathname} deviceId={deviceId} />
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
    <header className="md:hidden flex items-center justify-between gap-3 border-b border-border-soft bg-navigation-surface px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft">
          <Zap className="h-4 w-4 text-accent" />
        </span>
        <span className="text-sm font-bold tracking-tight">EnergIA Sur</span>
      </span>

      <span className="flex items-center gap-1">
        <MeterPicker />
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
  deviceId,
  userEmail,
  onLogout,
}: {
  pathname: string;
  deviceId: string | null;
  userEmail: string | null;
  onLogout: () => void;
}) {
  return (
    <nav aria-label="Navegación principal" className="hidden md:block border-b border-border-soft bg-navigation-surface">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 flex flex-wrap xl:flex-nowrap items-center justify-between gap-x-3">
        <div className="flex flex-wrap gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={meterHref(href, deviceId)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-2 xl:px-3.5 py-3 text-sm font-medium border-b-2 transition-colors motion-reduce:transition-none ${focus} ${
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

        <AccountControls userEmail={userEmail} onLogout={onLogout} deviceId={deviceId} />
      </div>
    </nav>
  );
}

/**
 * Navegación de celular: barra fija abajo, al alcance del pulgar, como una
 * app nativa. Sin menú hamburguesa — las seis secciones están siempre a la
 * vista, que es la diferencia entre sentirse app y sentirse web achicada.
 */
function BottomNav({ pathname, deviceId }: { pathname: string; deviceId: string | null }) {
  return (
    <nav
      aria-label="Navegación móvil"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border-soft bg-navigation-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Las columnas se derivan de la cantidad de secciones: sumar una
          entrada a LINKS no obliga a tocar la grilla. */}
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${LINKS.length}, minmax(0, 1fr))` }}>
        {LINKS.map(({ href, label, short, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={meterHref(href, deviceId)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
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

function AccountControls({ userEmail, deviceId, onLogout }: {
  userEmail: string | null;
  deviceId: string | null;
  onLogout: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 py-1 text-xs text-muted sm:gap-2">
      <MeterPicker />
      <Link href={meterHref('/ajustes/mis-datos', deviceId)} title={userEmail ?? 'Mi cuenta'}
        className={`max-w-44 truncate rounded-lg px-2 py-1.5 hover:text-foreground ${focus}`}>
        <span className="sr-only">Mi cuenta</span>
        <span aria-hidden="true">{userEmail ?? 'Mi cuenta'}</span>
      </Link>
      <ThemeToggle />
      <button type="button" onClick={onLogout} aria-label="Cerrar sesión"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium hover:text-foreground ${focus}`}>
        <LogOut className="h-4 w-4" aria-hidden="true" /><span className="hidden lg:inline">Salir</span>
      </button>
    </div>
  );
}

function SideNav({ pathname, deviceId, collapsed, onToggle }: {
  pathname: string;
  deviceId: string | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral';
  return (
    <aside className={`app-sidebar hidden md:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-border-soft bg-navigation-surface ${collapsed ? 'p-2' : 'p-3'}`}>
      <div className={`flex min-h-12 items-center ${collapsed ? 'justify-center' : 'px-2'}`}>
        <div className={collapsed ? 'w-[26px] overflow-hidden' : 'min-w-0'}>
          <Image src="/assets/energia-sur-logo.png" alt="EnergIA Sur" width={2172} height={724} unoptimized
            className={'sidebar-logo-light ' + (collapsed ? 'h-auto w-[139px] max-w-none' : 'h-auto w-44 max-w-full')} />
          <Image src="/assets/energia-sur-logo-dark-mode.png" alt="EnergIA Sur" width={2170} height={725} unoptimized
            className={'sidebar-logo-dark ' + (collapsed ? 'h-auto w-[139px] max-w-none' : 'h-auto w-44 max-w-full')} />
        </div>
      </div>
      <nav id="desktop-sidebar-links" aria-label="Navegación principal" className="mt-3 flex flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={meterHref(href, deviceId)} aria-label={label}
              title={collapsed ? label : undefined} aria-current={active ? 'page' : undefined}
              className={`app-sidebar-link relative flex min-h-11 items-center gap-3 rounded-xl text-sm transition-colors duration-200 motion-reduce:transition-none ${focus} ${collapsed ? 'justify-center' : 'px-3'} ${active ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:bg-surface-raised hover:text-foreground'}`}>
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              {collapsed ? <span aria-hidden="true" className="app-sidebar-tooltip">{label}</span> : <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-3">
        <button type="button" onClick={onToggle} aria-label={toggleLabel} aria-expanded={!collapsed} aria-controls="desktop-sidebar-links" title={toggleLabel}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl text-sm text-muted hover:bg-surface-raised hover:text-foreground ${focus} ${collapsed ? 'justify-center' : 'px-3'}`}>
          <ToggleIcon className="size-[18px] shrink-0" aria-hidden="true" />
          {!collapsed && <span>Contraer menú</span>}
        </button>
      </div>
    </aside>
  );
}

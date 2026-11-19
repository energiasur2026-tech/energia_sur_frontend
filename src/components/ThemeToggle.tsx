'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, type Theme } from '@/lib/theme';
import { useTheme, useThemePreference } from '@/lib/use-theme';
import { SwitchToggle } from './SwitchToggle';
import { useNavigationPreferences } from './NavigationPreferences';

const OPTIONS = [
  { value: 'light' as Theme, label: 'Claro', icon: <Sun className="h-3.5 w-3.5" /> },
  { value: 'dark' as Theme, label: 'Oscuro', icon: <Moon className="h-3.5 w-3.5" /> },
] as const;

/**
 * Selector de tema: un interruptor con las dos opciones a la vista.
 *
 * Antes eran tres opciones (claro, oscuro y "sistema") y en la barra superior
 * se resolvia con un solo icono que rotaba entre las tres. Ese control no
 * comunicaba nada: no se sabia cuantas opciones habia ni cual estaba puesta
 * sin ir tocando a ver que pasaba.
 *
 * `compact` es la variante de las barras de navegacion, mas chica y sin
 * etiquetas de texto —ahi el espacio es real— pero con los dos iconos
 * visibles, que es lo que importaba: se ve que hay dos opciones y cual esta
 * activa. `full` es la de Ajustes, con las palabras completas.
 */
export function ThemeToggle({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const theme = useTheme();
  const preference = useThemePreference();
  const { save } = useNavigationPreferences();
  function select(value:Theme|'system') {
    applyTheme(value);
    save({theme:value});
  }

  if (variant === 'full') {
    return (
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Tema de la aplicación</legend>
        {([...OPTIONS,{value:'system',label:'Automático',icon:<Monitor className="h-3.5 w-3.5"/>}] as const).map(option=><label
          key={option.value} className={'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm focus-within:outline-2 focus-within:outline-accent '+(preference===option.value?'border-accent bg-accent-soft':'border-border-soft')}>
          <input type="radio" name="appearance-theme" className="accent-accent" checked={preference===option.value} onChange={()=>select(option.value)}/>
          <span aria-hidden="true">{option.icon}</span>{option.label}
        </label>)}
      </fieldset>
    );
  }

  return (
    <div className="w-[5.5rem]">
      <SwitchToggle
        options={OPTIONS_ICON_ONLY}
        value={theme}
        onChange={select}
        label="Tema de la aplicación"
        size="sm"
      />
    </div>
  );
}

/**
 * En la barra, solo los iconos: el sol y la luna se entienden sin leer, y las
 * palabras no entrarian sin comerse el espacio del resto de la cabecera.
 */
const OPTIONS_ICON_ONLY = [
  { value: 'light' as Theme, label: '', icon: <Sun className="h-4 w-4" aria-label="Claro" /> },
  { value: 'dark' as Theme, label: '', icon: <Moon className="h-4 w-4" aria-label="Oscuro" /> },
] as const;

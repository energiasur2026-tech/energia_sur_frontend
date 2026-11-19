export const navigationMetadataKey = 'energia_sur_navigation';

export type NavigationPreference = {
  position: 'top' | 'side';
  collapsed: boolean;
  theme?: 'light' | 'dark' | 'system';
};

export const defaultNavigation: NavigationPreference = { position: 'top', collapsed: false };

export function readNavigationPreference(value: unknown): NavigationPreference | null {
  if (typeof value !== 'object' || value === null) return null;
  const { position, collapsed, theme } = value as Partial<NavigationPreference>;
  if (position !== 'top' && position !== 'side') return null;
  return { position, collapsed: collapsed === true, ...(theme==='light'||theme==='dark'||theme==='system'?{theme}:{}) };
}

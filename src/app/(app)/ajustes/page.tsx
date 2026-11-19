import type { Metadata } from 'next';
import { SettingsHub } from '@/components/SettingsHub';

export const metadata: Metadata = {
  title: 'Ajustes',
  description: 'Configuración de tu medidor y de la aplicación.',
};

export default function AjustesPage() {
  return <SettingsHub />;
}

import type { Metadata } from 'next';
import { SettingsView } from '@/components/SettingsView';

export const metadata: Metadata = {
  title: 'Ajustes',
  description: 'Configuración de tu medidor y de la aplicación.',
};

export default function AjustesPage() {
  return <SettingsView />;
}

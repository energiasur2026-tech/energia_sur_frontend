import type { Metadata } from 'next';
import { EventsView } from '@/components/EventsView';

export const metadata: Metadata = {
  title: 'Eventos',
  description: 'Problemas detectados en tu instalación eléctrica.',
};

export default function EventosPage() {
  return <EventsView />;
}

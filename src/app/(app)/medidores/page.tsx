import type { Metadata } from 'next';
import { MetersView } from '@/components/MetersView';

export const metadata: Metadata = {
  title: 'Mis medidores',
  description: 'Los medidores de tu domicilio, de un vistazo.',
};

export default function MedidoresPage() {
  return <MetersView />;
}

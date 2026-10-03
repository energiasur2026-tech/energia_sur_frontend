import type { Metadata } from 'next';
import { HomeSetup } from '@/components/HomeSetup';

export const metadata: Metadata = {
  title: 'Componentes del hogar',
  description: 'Qué aparatos hay en cada ambiente.',
};

export default function HogarPage() {
  return <HomeSetup />;
}

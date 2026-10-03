import type { Metadata } from 'next';
import { ForecastView } from '@/components/ForecastView';

export const metadata: Metadata = {
  title: 'Objetivo',
  description: 'Tu meta mensual de consumo y cómo venís.',
};

export default function ProyeccionPage() {
  return <ForecastView />;
}

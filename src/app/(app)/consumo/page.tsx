import type { Metadata } from 'next';
import { ConsumptionView } from '@/components/ConsumptionView';

export const metadata: Metadata = {
  title: 'Consumo',
  description: 'Cuánta electricidad usaste y cuánto costaría.',
};

export default function ConsumoPage() {
  return <ConsumptionView />;
}

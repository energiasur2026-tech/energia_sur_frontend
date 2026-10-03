import type { Metadata } from 'next';
import { Dashboard } from '@/components/Dashboard';

export const metadata: Metadata = {
  title: 'Monitor',
  description: 'Tensión, corriente y potencia de tu medidor en vivo.',
};

export default function DashboardPage() {
  return <Dashboard />;
}

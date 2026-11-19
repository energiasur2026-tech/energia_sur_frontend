import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MetersView } from '@/components/MetersView';

export const metadata: Metadata = {
  title: 'Mis dispositivos',
  description: 'Administrá tus medidores y conocé qué está consumiendo energía.',
};

export default async function MedidoresPage() {
  const user=await getCurrentUser();
  if(!user)redirect('/login');
  return <MetersView userId={user.id} />;
}

import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'Ingresar',
  description: 'Entrá a tu cuenta para ver el consumo de tu medidor.',
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}

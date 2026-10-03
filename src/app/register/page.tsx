import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Creá tu cuenta para empezar a seguir el consumo de tu medidor.',
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}

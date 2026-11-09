import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Nueva contraseña', robots: { index: false, follow: false }, referrer: 'no-referrer',
};
export default function ResetPasswordPage() { return <ResetPasswordForm />; }

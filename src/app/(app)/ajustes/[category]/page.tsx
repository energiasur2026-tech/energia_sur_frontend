import { notFound } from 'next/navigation';
import { SettingsHub } from '@/components/SettingsHub';
import { isSettingsCategory } from '@/lib/settings-categories';

export const metadata = { title: 'Ajustes' };

export default async function SettingsCategoryPage({params}:{params:Promise<{category:string}>}) {
  const {category}=await params;
  if(!isSettingsCategory(category))notFound();
  return <SettingsHub category={category}/>;
}

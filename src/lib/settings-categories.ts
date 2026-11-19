export const settingsCategories = ['apariencia','dispositivos','servicio','objetivos','lumi','mis-datos'] as const;
export type SettingsCategory = typeof settingsCategories[number];
export function isSettingsCategory(value:string):value is SettingsCategory {
  return settingsCategories.some(category=>category===value);
}

export function hasSettingsDraft() {
  return !!document.querySelector('[data-settings-panel] [data-unsaved="true"]');
}

export function confirmDiscardSettingsDraft() {
  return !hasSettingsDraft()||window.confirm('Tenés cambios sin guardar. ¿Querés salir y descartarlos?');
}

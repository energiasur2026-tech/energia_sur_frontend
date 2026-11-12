'use client';
export function LumiResponseStyle({enabled,busy,onSave}:{enabled:boolean;busy:boolean;onSave:(value:boolean)=>Promise<boolean>}){
 return <><label><input type="checkbox" disabled={busy} checked={enabled} onChange={event=>void onSave(event.target.checked)}/>Respuestas breves y concretas</label><p>Lumi va directo al punto y conserva los datos y las advertencias importantes. Podés pedir «más detalle» cuando quieras.</p></>;
}

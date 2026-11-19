export function readingStatus(latest: {recordedAt:string}|null, minutes=5, syncError=false, now=Date.now()) {
  if(syncError)return {label:'Error de sincronización',tone:'danger'} as const;
  if(!latest)return {label:'Esperando primera lectura',tone:'muted'} as const;
  const age=now-Date.parse(latest.recordedAt);
  if(!Number.isFinite(age)||age<0||age>Math.max(10,minutes*2.5)*60_000){
    return {label:'Última lectura desactualizada',tone:'warn'} as const;
  }
  return {label:'Lectura reciente',tone:'ok'} as const;
}

export function groupDevices<T extends {deviceId:string}>(meters:T[], assignment:Record<string,string>) {
  const groups=new Map<string,{name:string;meters:T[]}>();
  for(const meter of meters){
    const name=Object.hasOwn(assignment,meter.deviceId)?assignment[meter.deviceId].trim():'';
    const key=name.normalize('NFC').toLocaleLowerCase('es-AR');
    const group=groups.get(key);
    if(group)group.meters.push(meter);
    else groups.set(key,{name,meters:[meter]});
  }
  return Array.from(groups,([id,group])=>({id,...group}));
}

export function readAssignments(raw:string):Record<string,string> {
  try {
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    return Object.fromEntries(Object.entries(value).filter(([id,name])=>/^[a-zA-Z0-9_-]{1,100}$/.test(id)&&typeof name==='string'&&name.length<=60));
  } catch {return {};}
}

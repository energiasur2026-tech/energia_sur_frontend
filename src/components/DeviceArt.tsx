import { useId } from 'react';

export type DeviceKind = 'general' | 'circuit' | 'plug';

export const deviceKinds = {
  general:{ label:'Medidor general', description:'Mide el consumo total de tu instalación eléctrica.' },
  circuit:{ label:'Medidor de circuito', description:'Mide el consumo de un circuito o sector específico.' },
  plug:{ label:'Enchufe inteligente', description:'Mide el consumo de un electrodoméstico conectado.' },
} as const;

/** Generic illustrations, without branding or model-specific markings. */
export function DeviceArt({kind, className, decorative=false}:{kind:DeviceKind;className?:string;decorative?:boolean}) {
  const id=useId();
  const face=id+'-face', side=id+'-side', display=id+'-display';
  return <svg viewBox="0 0 220 142" className={className} aria-hidden={decorative||undefined}
    role={decorative?undefined:'img'} aria-label={decorative?undefined:'Ilustración de '+deviceKinds[kind].label.toLowerCase()}>
    <defs>
      <linearGradient id={face} x1="0" x2="1" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#f8fafc"/><stop offset=".75" stopColor="#bfcfdd"/><stop offset="1" stopColor="#91a9bf"/></linearGradient>
      <linearGradient id={side} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#8aa2b8"/><stop offset="1" stopColor="#435b74"/></linearGradient>
      <linearGradient id={display} x1="0" x2="1" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#193d4f"/><stop offset="1" stopColor="#102633"/></linearGradient>
    </defs>
    <ellipse cx="112" cy="125" rx="66" ry="7" fill="#314b68" opacity=".17"/>
    {kind==='plug'?<g>
      <rect x="66" y="23" width="103" height="99" rx="33" fill={`url(#${side})`}/>
      <rect x="54" y="18" width="103" height="97" rx="30" fill={`url(#${face})`} stroke="#8298af"/>
      <circle cx="105" cy="64" r="31" fill="#93a8bb" stroke="#e9f3fa" strokeWidth="3"/>
      <circle cx="105" cy="64" r="26" fill="#c9d8e3"/>
      <path d="m92 57 5 9m21-9-5 9m-8 6v6" stroke="#31485e" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="105" cy="103" r="3" fill="#1d9c83"/><path d="M158 52v22" stroke="#9fb1c1" strokeWidth="2" strokeLinecap="round"/>
    </g>:<g transform={kind==='circuit'?'translate(31 2) scale(.74 1)':''}>
      <path d="M62 27 82 15h74l22 16v78l-20 14H62Z" fill={`url(#${side})`}/>
      <path d="M62 27 82 15h74l-10 12Z" fill="#cfdfeb"/>
      <rect x="54" y="26" width="98" height="96" rx="9" fill={`url(#${face})`} stroke="#8399ac"/>
      <rect x="62" y="47" width="82" height="37" rx="5" fill={`url(#${display})`}/>
      <path d="M76 69h10m10 0h10m10 0h12M77 61h9m10 0h10" stroke="#7ee3c8" strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="75" cy="94" r="3" fill="#1d9c83"/><rect x="109" y="90" width="24" height="8" rx="4" fill="#758fa8"/>
      <path d="M67 36h73M67 107h73" stroke="#8299ad" opacity=".7"/>
      {[71,89,107,125].map(x=><g key={x}><circle cx={x} cy="113" r="3.2" fill="#526d84"/><path d={`M${x-1.5} 113h3`} stroke="#b9cbda"/></g>)}
    </g>}
  </svg>;
}

import {formatCurrency} from '@/lib/format';
import type {EnergyCost} from '@/lib/tariffs';
export function ElectricityBreakdown({cost}:{cost:EnergyCost}){
 const detail=cost.breakdown;
 return <section className="rounded-2xl border border-border-soft bg-surface p-5 mb-6"><h2 className="font-semibold">Desglose eléctrico del hogar</h2><p className="text-xs text-muted mt-2">{detail?.category??'Categoría no confirmada'} · {detail?.segment==='subsidized'?'Con subsidio':detail?.segment==='unsubsidized'?'Sin subsidio':'Segmento sin confirmar'}. Vigencia: {detail?.effectiveFrom??'sin confirmar'}.</p>
 <dl className="space-y-3 mt-4 text-sm">{(detail?.lines??[{id:'fixed',label:'Cargo fijo eléctrico',amount:cost.fixedCharge,kind:'fixed'},{id:'variable',label:'Cargo variable por energía',amount:cost.variableCharge,kind:'variable'}]).map(line=><div className="flex justify-between gap-3" key={line.id}><dt>{line.label}</dt><dd>{formatCurrency(line.amount)}</dd></div>)}
 <div className="flex justify-between gap-3 border-t border-border-soft pt-3 font-semibold"><dt>Subtotal eléctrico antes de ajustes pendientes</dt><dd>{formatCurrency(detail?.subtotal??cost.total)}</dd></div>
 <div className="flex justify-between gap-3"><dt>Créditos / bonificaciones eléctricos</dt><dd>{detail?.pending.some(t=>t.includes('Créditos'))?'Pendientes de confirmar':formatCurrency(detail?.credits.reduce((sum,c)=>sum+c.amount,0)??0)}</dd></div>
 <div className="flex justify-between gap-3"><dt>Impuestos sobre electricidad</dt><dd>{detail?.pending.some(t=>t.includes('Impuestos'))?'Base y alcance pendientes':formatCurrency(detail?.taxes.reduce((sum,c)=>sum+c.amount,0)??0)}</dd></div>
 <div className="flex justify-between gap-3 font-semibold"><dt>Total final de electricidad del hogar</dt><dd>{detail?.totalElectricity!=null?formatCurrency(detail.totalElectricity):'No determinado'}</dd></div></dl>
 <p className="text-xs text-muted mt-4">No incluye agua, cloaca ni energía pública. Un crédito o IVA global no se asigna automáticamente a electricidad.</p>{cost.warning&&<p className="text-xs text-warn mt-2">{cost.warning}</p>}{detail?.pending.map(text=><p className="text-xs text-muted mt-2" key={text}>{text}</p>)}
 </section>;
}

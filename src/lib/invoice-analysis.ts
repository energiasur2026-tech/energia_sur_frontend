export type InvoiceCharge = {name:string; amount:number; quantity?:number; rate?:number};
export type InvoiceFields = {
  provider:string; providerName:string; province:string; locality:string; category:string;
  supplyType:string; meterType:string; segment:string; period:string; issuedOn:string;
  dueOn:string; closedOn:string; kwh:string; previousReading:string; currentReading:string; total:string;
};
export type InvoiceAnalysis = {fields:InvoiceFields; charges:InvoiceCharge[]; ambiguous:boolean};

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const numberPattern='[-−]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,4})?';
const numberToken=new RegExp(numberPattern,'g');
export function parseInvoiceNumber(text:string) {
  const value=text.trim().replace(/^\$\s*/,'').replace('−','-');
  if(!new RegExp('^'+numberPattern+'$').test(value))return null;
  const parsed=Number(value.replace(/\./g,'').replace(',','.'));
  return Number.isFinite(parsed)&&Math.abs(parsed)<=1e10?parsed:null;
}
function numbers(value:string) {
  return Array.from(value.matchAll(numberToken), match=>parseInvoiceNumber(match[0])!).filter(value=>value!==null);
}
const decimal=(value:number|undefined)=>value===undefined?'':String(value).replace('.',',');
function date(value:string) {
  const match=value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b|\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if(!match)return '';
  const result=(match[3]??match[4])+'-'+(match[2]??match[5]).padStart(2,'0')+'-'+(match[1]??match[6]).padStart(2,'0');
  const timestamp=Date.parse(result);
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===result?result:'';
}
const chargeLabels=[
  [/^(?:energia|cargo variable).*escal[oó]n\s*(\d+)/,'Escalón'],
  [/^(?:cargo variable|consumo de energia|energia facturada)/,'Cargo variable'],
  [/^cargo fijo/,'Cargo fijo'],
  [/^iva\b/,'IVA'],
  [/^(?:contribucion municipal|tasa municipal)/,'Contribución municipal'],
  [/^(?:bonificacion|descuento|credito)\b/,'Bonificación'],
  [/^fondo compensador/,'Fondo compensador'],
  [/^(?:ley\s*326|bomberos)/,'Bomberos'],
  [/^cuota (?:de )?capitalizacion/,'Cuota de capitalización'],
  [/^alumbrado publico/,'Alumbrado público'],
  [/^(?:cargo )?luz de obra/,'Luz de obra'],
  [/^.*sepelio/,'Sepelio'],
  [/^(?:recargo|interes|mora)\b/,'Recargo'],
  [/^(?:otros cargos|potencia contratada|penalizacion)\b/,'Otros cargos'],
] as const;

function categoryFor(provider:string,text:string) {
  if(provider==='EDESUR'){
    const residential=text.match(/\bt\s*1\s*[- ]?r\s+residencial\s*([1-6])\b/);
    return residential?'R'+residential[1]:text.match(/^\s*([rg][1-6])\b/)?.[1].toUpperCase()??'';
  }
  if(provider==='COOPRG'){
    const candidate=text.match(/\b(?:tr[12]|t\s*1\s*-?\s*r[12]|t\s*1\s*-?\s*[ge]|t2p|tm1)\b/)?.[0];
    return candidate?.replace(/[ -]/g,'').replace(/^t1r/,'tr').toUpperCase()??'';
  }
  if(provider==='SPSE')return text.match(/^\s*(?:residencial|general|comercial)?\s*[:#-]?\s*(1|3|4|5|11|22|91|31|41|51)\b/)?.[1]??'';
  return '';
}

export function analyzeInvoice(text:string):InvoiceAnalysis {
  const original=text.slice(0,320_000).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const lines=original.map(normalize);
  const combined=lines.join('\n');
  const candidates=[
    ['EDESUR',/\bedesur\b|empresa distribuidora sur/],
    ['SPSE',/servicios publicos sociedad del estado|\bspse\b|s\.?\s*p\.?\s*s\.?\s*e\./],
    ['COOPRG',/cooperativa electrica[^\n]{0,100}rio grande|\bcooprg\b/],
  ].filter(([,expression])=>(expression as RegExp).test(combined));
  const provider=candidates.length===1?String(candidates[0][0]):'';
  const first=(label:RegExp)=>{
    const index=lines.findIndex(line=>label.test(line));
    return index<0?'':original[index].slice(lines[index].match(label)?.[0].length??0).trim();
  };
  const categoryTexts=lines.flatMap(line=>{
    const match=line.match(/^(?:tarifa(?:\s+aplicada)?|categoria(?:\s+tarifaria)?)\s*[:–-]?\s*(.+)$/);
    if(match)return [match[1]];
    return /^t\s*1\s*[- ]?r\s+residencial\b|^tr[12]\s*[-–]/.test(line)?[line]:[];
  });
  const categories=Array.from(new Set(categoryTexts.map(value=>categoryFor(provider,value)).filter(Boolean)));
  const supplies=new Set(lines.flatMap(line=>{
    const match=line.match(/^(?:n(?:ro|umero|°|º)\.?\s*(?:de\s+)?)?(?:suministro|nro.? de cliente)\s*[:#-]?\s*(\d[\d .-]{3,})/);
    return match?[match[1].replace(/\D/g,'')]:[];
  }));
  const ambiguous=candidates.length>1||categories.length>1||supplies.size>1;
  const category=categories.length===1?categories[0]:'';
  const segmentText=normalize(first(/^(?:condicion de subsidio|subsidio nacional|segmentacion)\s*[:–-]?\s*/));
  const segment=/sin subsidio|no subsidiado|^no$/.test(segmentText)?'unsubsidized':/con subsidio|subsidiado|^si$/.test(segmentText)?'subsidized':provider==='COOPRG'&&category==='TR1'?'unsubsidized':provider==='COOPRG'&&category==='TR2'?'subsidized':'';
  const provinceText=normalize(first(/^provincia\s*[:–-]\s*/));
  const province=['Santa Cruz','Buenos Aires','Ciudad Autónoma de Buenos Aires','Tierra del Fuego']
    .find(value=>normalize(value)===provinceText)??(provider==='COOPRG'?'Tierra del Fuego':provider==='SPSE'?'Santa Cruz':'');
  const localityText=first(/^(?:partido|localidad)\s*[:–-]\s*/);
  // Only publish an isolated locality label, never an address or account identifier.
  const locality=/^[\p{L}][\p{L} ]{1,48}$/u.test(localityText)?localityText:provider==='COOPRG'?'Río Grande':'';
  const supplyText=normalize(first(/^(?:tipo de suministro|tipo de medidor|alimentacion)\s*[:–-]?\s*/));
  const meterType=/monofas/.test(supplyText)?'Monofásico':/trifas/.test(supplyText)?'Trifásico':'';
  const company=first(/^(?:distribuidora|proveedor electrico)\s*[:–-]\s*/);
  const providerName=/^[\p{L}][\p{L} .&()-]{2,79}$/u.test(company)&&/energia|electri|distribuidora|cooperativa|servicios publicos/.test(normalize(company))?company:'';
  const periodText=normalize(first(/^(?:periodo facturado|periodo de facturacion|periodo de medicion|periodo)\s*[:–-]?\s*/));
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const year=periodText.match(/\b20\d{2}\b/)?.[0];
  const month=months.findIndex(word=>periodText.includes(word))+1;
  const numericPeriod=periodText.match(/^(0?[1-9]|1[0-2])[/-](20\d{2})\b/);
  const period=year&&month?year+'-'+String(month).padStart(2,'0'):numericPeriod?numericPeriod[2]+'-'+numericPeriod[1].padStart(2,'0'):'';
  const totalLine=first(/^(?:total\s+(?:primer\s+vencimiento|1(?:er|°)\s+vencimiento|facturado|a\s+pagar)|importe\s+total)\s*[:–-]?\s*/)||
    first(/^total\s*(?=[:$\d])[: ]*/);
  const reading=(label:RegExp)=>{
    const raw=first(label).replace(/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/g,'');
    return decimal(numbers(raw.replace(/kwh/gi,''))[0]);
  };
  const charges:InvoiceCharge[]=[];
  for(const line of lines){
    const rule=chargeLabels.find(([pattern])=>pattern.test(line));
    if(!rule)continue;
    const match=line.match(rule[0])!;
    const values=numbers(line.slice(match[0].length).replace(/\b\d+(?:,\d+)?\s*%/g,''));
    if(!values.length)continue;
    const amount=values.at(-1)!;
    const name=rule[1]==='Escalón'?'Energía · escalón '+match[1]:rule[1];
    charges.push({name,amount,...(rule[1]==='Escalón'&&values.length>=3?{quantity:values[0],rate:values[1]}:{})});
  }
  return {ambiguous,charges:charges.slice(0,40),fields:{
    provider,providerName,province,locality,category,segment,period,meterType,
    supplyType:meterType==='Monofásico'?'single-phase':meterType==='Trifásico'?'three-phase':'',
    issuedOn:date(first(/^fecha de emision\s*[:–-]?\s*/)),
    dueOn:date(first(/^(?:fecha de vencimiento|primer vencimiento|vencimiento)\s*[:–-]?\s*/)),
    closedOn:date(first(/^fecha de cierre\s*[:–-]?\s*/)),
    previousReading:reading(/^lectura anterior\s*[:–-]?\s*/),
    currentReading:reading(/^lectura actual\s*[:–-]?\s*/),
    kwh:decimal(numbers(first(/^(?:consumo total|consumo facturado|consumo de energia|consumo)\s*[:–-]?\s*/))[0]),
    total:decimal(numbers(totalLine).at(-1)),
  }};
}

export function invoiceChecks(fields:InvoiceFields,charges:InvoiceCharge[]) {
  const total=parseInvoiceNumber(fields.total);
  const previous=parseInvoiceNumber(fields.previousReading),current=parseInvoiceNumber(fields.currentReading),kwh=parseInvoiceNumber(fields.kwh);
  const sum=charges.reduce((acc,charge)=>acc+Math.round(charge.amount*100),0);
  return {
    difference:total===null||!charges.length?null:(Math.round(total*100)-sum)/100,
    readingDifference:previous===null||current===null||kwh===null?null:Math.round((current-previous-kwh)*1000)/1000,
  };
}

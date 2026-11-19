const {test,afterEach}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),ts=require('typescript');const dom=new JSDOM('<html><body></body></html>');for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])globalThis[k]=k==='getComputedStyle'?dom.window[k].bind(dom.window):dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{render,screen,cleanup,fireEvent,waitFor}=require('@testing-library/react'),userEvent=require('@testing-library/user-event').default;
let calls=[];const onSaved=()=>{};
function load(file,dependency=require){const mod={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(dependency,mod.exports,mod);return mod.exports;}
const format=load('lib/format.ts');const {ElectricityBreakdown}=load('components/ElectricityBreakdown.tsx',name=>name==='@/lib/format'?format:require(name));
const {TariffSimulator}=load('components/TariffSimulator.tsx', name=>name==='@/lib/format'?format:name==='./ElectricityBreakdown'?{ElectricityBreakdown}:require(name));
const {TariffAndBillTools}=load('components/TariffAndBillTools.tsx',name=>name==='@/lib/format'?format:name==='./TariffSimulator'?{TariffSimulator}:name==='./ConfigureTariffLink'?{ConfigureTariffLink:()=>React.createElement('a',{href:'/ajustes#proveedor-tarifa'},'Configurar tarifa')}:name==='./ElectricityBreakdown'?{ElectricityBreakdown}:name==='@/lib/meter-fetch'?{meterFetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url==='/api/meter/tariff'?{profile:null}:{comparison:{status:'partial_data',appKwh:null,deltaKwh:null,electricityDifference:null,pending:['Datos insuficientes']},breakdown:null}};}}:require(name));
afterEach(cleanup);
test('comparison requires both real dates and tariff editing links to Settings',async()=>{
 calls=[];render(React.createElement(TariffAndBillTools,{onSaved}));const user=userEvent.setup();assert.equal(calls.length,0);assert.equal(screen.getByRole('link',{name:'Configurar tarifa'}).getAttribute('href'),'/ajustes#proveedor-tarifa');
 await user.click(screen.getByText('Comparar el intervalo facturado'));assert.equal(screen.getByRole('button',{name:'Comparar factura eléctrica'}).disabled,true);
 fireEvent.change(screen.getByLabelText('Lectura inicial'),{target:{value:'2026-09-18T00:00'}});fireEvent.change(screen.getByLabelText('Lectura final'),{target:{value:'2026-10-18T00:00'}});await user.type(screen.getByLabelText('Consumo facturado · kWh'),'214');await user.type(screen.getByLabelText('Solo cargo de energía · ARS'),'33.747,85');await user.click(screen.getByRole('button',{name:'Comparar factura eléctrica'}));
 await waitFor(()=>assert.equal(calls.length,1));const body=JSON.parse(calls[0].options.body);assert.equal(body.electricityCharge,33747.85);assert.equal(body.from,'2026-09-18T03:00:00.000Z');assert.equal(body.to,'2026-10-18T03:00:00.000Z');assert.equal(body.userId,undefined);
});
test('unconfirmed taxes and credits display pending, never zero or a fake final total',()=>{
 render(React.createElement(ElectricityBreakdown,{cost:{fixedCharge:14000,variableCharge:15950.49,total:29950.49,tier:{},breakdown:{category:'Residencial',segment:'subsidized',effectiveFrom:'2026-07-01',lines:[{id:'fixed',label:'Cargo fijo',amount:14000}],subtotal:29950.49,totalElectricity:null,credits:[],taxes:[],pending:['Créditos pendientes','Impuestos pendientes']}}}));
 assert.ok(screen.getByText('No determinado'));assert.ok(screen.getByText('Pendientes de confirmar'));assert.ok(screen.getByText('Base y alcance pendientes'));
});

test('the Río Grande simulator selects a historical tariff and sends both scenarios',async t=>{
 const originalFetch=globalThis.fetch, originalFormData=globalThis.FormData;
 t.after(()=>{globalThis.fetch=originalFetch;globalThis.FormData=originalFormData;});
 globalThis.FormData=dom.window.FormData;
 const version={id:'cooprg-tr1-2026-07-01',jurisdiction:'AR-Tierra del Fuego',provider:'COOPRG',category:'TR1',segment:'unsubsidized',effectiveFrom:'2026-07-01'};
 let submitted;
 globalThis.fetch=async(_url,options)=>{
  if(!options)return {ok:true,json:async()=>[version]};
  submitted=JSON.parse(options.body);
  return {ok:true,json:async()=>({quotes:[],difference:14659.10})};
 };
 render(React.createElement(TariffSimulator));
 const user=userEvent.setup();
 await user.click(screen.getByText('Simular costos por consumo'));
 await user.click(screen.getByRole('button',{name:'Cargar cuadros tarifarios'}));
 await user.selectOptions(await screen.findByLabelText('Proveedor'),'COOPRG');
 await user.selectOptions(screen.getByLabelText('Categoría y período'),version.id+'|'+version.jurisdiction);
 await user.type(screen.getByLabelText('Consumo mensual (kWh)'),'279');
 await user.type(screen.getByLabelText('Consumo alternativo (kWh)'),'350');
 await user.click(screen.getByRole('button',{name:'Calcular'}));
 await screen.findByText(/Diferencia de cargos calculados/);
 assert.deepEqual(submitted,{id:version.id,jurisdiction:version.jurisdiction,construction:false,scenarios:[279,350]});
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost'});
for(const key of ['window','document','HTMLElement','Node','MutationObserver'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');
const {render,screen,fireEvent,cleanup,waitFor}=require('@testing-library/react');

function load(path, stubs={}) {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('src/'+path,'utf8'),{compilerOptions:{
    jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  }}).outputText;
  new Function('require','module','exports',code)(name=>stubs[name]??require(name),module,module.exports);
  return module.exports;
}
const {groupDevices,readingStatus,readAssignments}=load('lib/device-inventory.ts');

test('groups only explicitly assigned devices and keeps measurements separate',()=>{
  const devices=[{deviceId:'main',energy:300},{deviceId:'circuit',energy:40},{deviceId:'shop',energy:98},{deviceId:'unknown',energy:27}];
  const groups=groupDevices(devices,{main:'Casa',circuit:'casa',shop:'Local'});
  assert.deepEqual(groups.map(group=>[group.name,group.meters.map(meter=>meter.energy)]),[['Casa',[300,40]],['Local',[98]],['',[27]]]);
  assert.deepEqual(groupDevices([],{}),[]);
  assert.deepEqual(readAssignments('[]'),{});
});

test('stale readings, failed sync and a new device have distinct states',()=>{
  const now=Date.parse('2026-11-18T14:00:00Z');
  assert.equal(readingStatus(null,5,false,now).label,'Esperando primera lectura');
  assert.equal(readingStatus(null,5,true,now).label,'Error de sincronización');
  assert.equal(readingStatus({recordedAt:'2026-11-18T13:40:00Z'},5,false,now).label,'Última lectura desactualizada');
  assert.equal(readingStatus({recordedAt:'2026-11-18T13:58:00Z'},5,false,now).label,'Lectura reciente');
});

test('the wizard blocks unsupported plugs and submits an explicitly assigned circuit only after review',async t=>{
  t.after(cleanup);
  const {LinkMeterForm}=load('components/LinkMeterForm.tsx',{
    './DeviceArt':load('components/DeviceArt.tsx'),
    './InfoTooltip':{InfoTooltip:()=>null},
    '@/domain/installation-types':{PHASE_LABEL:{1:'Monofásico',3:'Trifásico'}},
  });
  const fetchBefore=globalThis.fetch;
  t.after(()=>{globalThis.fetch=fetchBefore;});
  let request,result;
  globalThis.fetch=async(url,options)=>{
    request={url,body:JSON.parse(options.body)};
    return {ok:true,json:async()=>({meter:{deviceId:'abc123',name:'Cocina'},existingReadings:3})};
  };
  render(React.createElement(LinkMeterForm,{supplies:['Casa'],onClose:()=>{},onLinked:value=>{result=value;}}));
  const press=name=>fireEvent.click(screen.getByRole('button',{name}));
  press(/Enchufe inteligente/);
  assert.equal(screen.getByRole('button',{name:'Continuar'}).disabled,true);
  press(/Medidor de circuito/);
  press('Continuar');
  assert.equal(screen.getByRole('combobox',{name:/Suministro o lugar/}).value,'Casa');
  press('Continuar');
  fireEvent.change(screen.getByRole('textbox',{name:/Identificador del medidor/}),{target:{value:'abc123'}});
  press('Continuar');
  fireEvent.change(screen.getByRole('textbox',{name:/Nombre/}),{target:{value:'Cocina'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Circuito o ambiente/}),{target:{value:'Cocina'}});
  press('Continuar');
  assert.equal(request,undefined);
  press('Confirmar y vincular');
  await waitFor(()=>assert.equal(result.name,'Cocina'));
  assert.deepEqual(request,{url:'/api/meters',body:{deviceId:'abc123',name:'Cocina',phases:1,role:'area',areaLabel:'Cocina'}});
  assert.equal(result.supply,'Casa');
});

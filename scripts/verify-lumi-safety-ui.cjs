const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body><button id="launcher">Lumi</button></body></html>',{url:'http://localhost'});
for(const k of ['window','document','HTMLElement','Node','MutationObserver','Event','localStorage','sessionStorage','navigator'])globalThis[k]=dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.scrollTo=()=>{};window.matchMedia=()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}});
dom.window.HTMLDialogElement.prototype.showModal=function(){assert.equal(document.querySelectorAll('dialog[open]').length,0,'Only one native modal may be open');this.open=true};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false};
const React=require('react');
const {render,screen,cleanup,act,fireEvent,waitFor}=require('@testing-library/react');
function load(path,stubs={}){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>stubs[n]||require(n),m.exports,m);return m.exports;}
const css={__esModule:true,default:new Proxy({},{get:(_,key)=>key})};
const policy=load('src/components/lumi/safety-policy.ts');
const {LumiSafety,OPEN_SAFETY}=load('src/components/lumi/LumiSafety.tsx',{'next/navigation':{usePathname:()=>'/dashboard'},'@/lib/use-meter-id':{useMeterId:()=>null,apiUrl:x=>x},'@/lib/use-polling':{usePolling:()=>{}},'./safety-policy':policy,'./safety.module.css':css});
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();document.body.removeAttribute('style');document.documentElement.removeAttribute('style')});
async function open(){document.getElementById('launcher').focus();render(React.createElement(LumiSafety,{userId:'test-user',blocked:false}));await act(async()=>window.dispatchEvent(new Event(OPEN_SAFETY)));return screen.getByRole('dialog',{name:'Consejos de seguridad'})}
function cancel(dialog){fireEvent(dialog,new Event('cancel',{cancelable:true}))}
test('one tip at a time, bounded navigation, scroll reset and arrow keys without changing frequency history',async()=>{
 const key=policy.safetyKey('test-user');const original={enabled:true,lastAt:123456,shown:['alta-potencia']};localStorage.setItem(key,JSON.stringify(original));
 const dialog=await open();const body=dialog.querySelector('.body');
 assert.equal(screen.getByRole('button',{name:'← Anterior'}).disabled,true);
 assert.ok(screen.getByRole('article',{name:'No todo va a la zapatilla'}));assert.equal(screen.queryByRole('heading',{name:'No todo va a la zapatilla'}),null);
 body.scrollTop=140;fireEvent.click(screen.getByRole('button',{name:'Siguiente →'}));assert.equal(body.scrollTop,0);assert.ok(screen.getByRole('article',{name:'Para desenchufar, agarrá la ficha'}));
 fireEvent.keyDown(dialog,{key:'ArrowRight'});assert.ok(screen.getByText('Consejo 3 de 3'));assert.equal(screen.getByRole('button',{name:'Siguiente →'}).disabled,true);
 fireEvent.keyDown(dialog,{key:'ArrowRight'});assert.ok(screen.getByText('Consejo 3 de 3'));
 fireEvent.keyDown(dialog,{key:'ArrowLeft'});assert.ok(screen.getByText('Consejo 2 de 3'));
 fireEvent.click(screen.getByRole('button',{name:'Configurar frecuencia'}));const checkbox=screen.getByRole('checkbox');checkbox.focus();fireEvent.keyDown(checkbox,{key:'ArrowRight'});assert.ok(screen.getByText('Consejo 2 de 3'));
 assert.deepEqual(policy.readSafety(localStorage.getItem(key)),original);
});
test('same dialog zooms, pans and exits image mode with Escape before closing; focus and background scrolling restore',async()=>{
 document.body.style.position='relative';const dialog=await open();assert.equal(document.body.style.position,'fixed');assert.equal(document.documentElement.style.overflow,'hidden');
 const close=screen.getByRole('button',{name:'Cerrar consejos de seguridad'});close.focus();fireEvent.keyDown(close,{key:'Tab',shiftKey:true});assert.equal(document.activeElement,screen.getByRole('button',{name:'Configurar frecuencia'}));fireEvent.keyDown(document.activeElement,{key:'Tab'});assert.equal(document.activeElement,close);
 fireEvent.click(screen.getByRole('button',{name:'Ampliar imagen'}));assert.equal(document.querySelectorAll('dialog[open]').length,1);assert.equal(document.activeElement,screen.getByRole('button',{name:'← Volver al consejo'}));
 fireEvent.keyDown(dialog,{key:'ArrowRight'});assert.equal(screen.queryByText('Consejo 2 de 3'),null);
 fireEvent.click(screen.getByRole('button',{name:'Aumentar zoom'}));assert.ok(screen.getByText('1.5×'));fireEvent.change(screen.getByRole('slider'),{target:{value:75}});assert.equal(screen.getByRole('img').style.marginLeft,'-37.5%');
 cancel(dialog);assert.ok(screen.getByRole('button',{name:'Ampliar imagen'}));assert.equal(document.activeElement,screen.getByRole('button',{name:'Ampliar imagen'}));assert.ok(screen.getByText('Consejo 1 de 3'));
 cancel(dialog);assert.equal(screen.queryByRole('dialog'),null);assert.equal(document.body.style.position,'relative');assert.equal(document.documentElement.style.overflow,'');await waitFor(()=>assert.equal(document.activeElement.id,'launcher'));
});
test('manual access persists disabling preference and survives missing artwork',async()=>{
 await open();fireEvent.click(screen.getByRole('button',{name:'Configurar frecuencia'}));fireEvent.click(screen.getByRole('checkbox'));assert.equal(policy.readSafety(localStorage.getItem(policy.safetyKey('test-user'))).enabled,false);
 fireEvent.error(screen.getByRole('img'));assert.ok(screen.getByText(/La imagen no está disponible/));assert.ok(screen.getByText(policy.SAFETY_TIPS[0].explanation));assert.equal(screen.queryByRole('button',{name:'Ampliar imagen'}),null);
 fireEvent.click(screen.getByRole('button',{name:'Cerrar consejos de seguridad'}));await act(async()=>window.dispatchEvent(new Event(OPEN_SAFETY)));assert.ok(screen.getByRole('dialog'));fireEvent.click(screen.getByRole('button',{name:'Configurar frecuencia'}));assert.equal(screen.getByRole('checkbox').checked,false);
});

const silence=()=>{};const actions=[];
const {LumiWidget}=load('src/components/lumi/LumiWidget.tsx',{
 './LumiSafety':{LumiSafety,OPEN_SAFETY},'@/lib/use-meter-id':{useMeterId:()=>null},'@/lib/lumi-category-help':{CATEGORY_HELP_OPEN:'test-category'},
 '@/lib/meter-fetch':{meterFetch:async(_url,options)=>{if(options?.body)actions.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({version:'1',events:[],messages:[{role:'assistant',text:'Conversación conservada',at:'2026-11-16T12:00:00Z'}],preferences:{reducedMotion:true,soundsEnabled:false}})}}},
 '@/lib/use-polling':{usePolling:callback=>React.useEffect(()=>{void callback()},[callback])},
 './LumiAvatar':{LumiAvatar:()=>null},'./LumiHistory':{LumiHistory:({messages})=>React.createElement('div',null,messages.map((message,index)=>React.createElement('p',{key:index},message.text)))},
 './LumiEvents':{LumiEvents:()=>null},'./LumiCategoryHelp':{LumiCategoryHelp:()=>null},'./LumiResponseStyle':{LumiResponseStyle:()=>null},'./LumiMemory':{LumiMemory:()=>null},
 './use-lumi-sounds':{useLumiSounds:()=>silence},'./lumi-sound':{newEventSound:()=>null},'./use-reduced-motion':{useLumiReducedMotion:()=>true},
 './lumi-state':{LUMI_LABELS:{idle:'Lumi'},isConsultation:()=>false,isPendingEvent:()=>false,isPriorityEvent:()=>false,resolveLumiState:()=> 'idle'},'./lumi.module.css':css,
});
test('opening safety suspends chat without stacked dialogs and restores tab, conversation, draft and opener',async()=>{
 actions.length=0;render(React.createElement(LumiWidget,{userId:'integration-user'}));
 fireEvent.click(screen.getByRole('button',{name:'Abrir Lumi, tu asistente energético'}));await screen.findByRole('button',{name:'Continuar chat anterior'});fireEvent.click(screen.getByRole('button',{name:'Continuar chat anterior'}));assert.ok(screen.getByText('Conversación conservada'));
 fireEvent.change(screen.getByLabelText('Tu consulta sobre energía'),{target:{value:'Mi borrador pendiente'}});
 fireEvent.click(screen.getByRole('button',{name:'Preferencias'}));
 const opener=screen.getByRole('button',{name:'Consejos de seguridad'});opener.focus();fireEvent.click(opener);
 const chat=document.getElementById('lumi-panel');assert.equal(chat.hidden,true);assert.equal(chat.open,false);assert.equal(document.querySelectorAll('dialog[open]').length,1);
 fireEvent.click(screen.getByRole('button',{name:'Cerrar consejos de seguridad'}));await waitFor(()=>assert.equal(chat.open,true));assert.equal(chat.hidden,false);assert.equal(screen.getByRole('button',{name:'Preferencias'}).getAttribute('aria-pressed'),'true');await waitFor(()=>assert.equal(document.activeElement,opener));
 fireEvent.click(screen.getByRole('button',{name:'Chat'}));assert.equal(screen.getByLabelText('Tu consulta sobre energía').value,'Mi borrador pendiente');assert.ok(screen.getByText('Conversación conservada'));assert.deepEqual(actions,[]);
});

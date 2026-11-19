const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost'});for(const k of ['window','document','HTMLElement','Node','MutationObserver','Event','localStorage'])globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const {render,screen,cleanup,waitFor,fireEvent}=require('@testing-library/react');
function load(file,stubs={}){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>stubs[n]||require(n),m.exports,m);return m.exports;}
const navigationTypes=load('src/lib/navigation-preference.ts');
let signedIn='A', failSave=false;
const savedNavigation=new Map();
const navigation=load('src/components/NavigationPreferences.tsx',{
 '@/lib/navigation-preference':navigationTypes, '@/lib/theme':{applyTheme:()=>{}},
 '@/lib/supabase-browser':{supabaseBrowser:()=>({auth:{
  getSession:async()=>({data:{session:{user:{id:signedIn}}}}),
  updateUser:async({data})=>{
   if(failSave)return {error:new Error('offline')};
   savedNavigation.set(signedIn,data.energia_sur_navigation);return {error:null};
  },
 }})},
});
const {NavigationPreferences,NavigationSettings}=navigation;
let pathname='/medidores/hogar';
const {AppNav}=load('src/components/AppNav.tsx',{
 './NavigationPreferences':navigation,
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
 'next/navigation':{usePathname:()=>pathname,useRouter:()=>({})},
 '@/lib/use-meter-id':{useMeterId:()=> 'demo',meterHref:(href,id)=> href+'?deviceId='+id},
 './MeterPicker':{MeterPicker:()=>null},
 './ThemeToggle':{ThemeToggle:()=>null},
 '@/lib/supabase-browser':{supabaseBrowser:()=>({})},
});
const profileTypes=load('src/lib/profile-types.ts');
const {ProfileForm}=load('src/components/ProfileForm.tsx',{'@/lib/profile-types':profileTypes,'@/lib/use-polling':{usePolling:callback=>React.useEffect(()=>{void callback()},[callback])}});
afterEach(()=>{cleanup();localStorage.clear();savedNavigation.clear();signedIn='A';failSave=false;pathname='/medidores/hogar';});

function renderNavigation(userId='A',initial=null) {
 return render(React.createElement(NavigationPreferences,{userId,initial},
  React.createElement(AppNav,{userEmail:'test@example.invalid'}),
  React.createElement(NavigationSettings),
  React.createElement('input',{'aria-label':'Formulario abierto',defaultValue:'sin guardar'}),
 ));
}

test('navigation saves position and collapse to the account without remounting page or mobile navigation',async()=>{
 const view=renderNavigation();
 const draft=screen.getByRole('textbox',{name:'Formulario abierto'});
 assert.equal(screen.getByRole('radio',{name:'Superior (horizontal)'}).checked,true);
 const bottom=document.querySelector('nav[aria-label="Navegación móvil"]');
 fireEvent.click(screen.getByRole('radio',{name:'Lateral izquierda (vertical)'}));
 assert.equal(document.querySelector('.app-shell').dataset.navigation,'side');
 assert.equal(document.querySelector('aside [aria-current="page"]').getAttribute('href'),'/medidores?deviceId=demo');
 assert.deepEqual(Array.from(document.querySelectorAll('aside nav a'),link=>link.getAttribute('href')),
  ['/medidores','/dashboard','/consumo','/proyeccion','/eventos','/ajustes'].map(route=>route+'?deviceId=demo'));
 const collapse=screen.getByRole('button',{name:'Contraer menú lateral'});
 fireEvent.click(collapse);
 assert.equal(document.querySelector('.app-shell').dataset.sidebarCollapsed,'true');
 assert.equal(document.querySelector('aside [aria-current="page"]').title,'Mis dispositivos');
 assert.equal(screen.getByRole('button',{name:'Expandir menú lateral'}),collapse);
 assert.equal(screen.getByRole('textbox',{name:'Formulario abierto'}),draft);
 assert.equal(document.querySelector('nav[aria-label="Navegación móvil"]'),bottom);
 await waitFor(()=>assert.deepEqual(savedNavigation.get('A'),{position:'side',collapsed:true}));
 view.unmount();
 const restored=renderNavigation('A',savedNavigation.get('A'));
 assert.equal(screen.getByRole('button',{name:'Expandir menú lateral'}).getAttribute('aria-expanded'),'false');
 restored.unmount();
 signedIn='B';renderNavigation('B');
 assert.equal(document.querySelector('.app-shell').dataset.navigation,'top');
});

test('legacy browser preference migrates and a failed save can be retried without reverting navigation',async()=>{
 localStorage.setItem('energia-sur:navigation:v1:A','side');
 renderNavigation();
 await waitFor(()=>assert.deepEqual(savedNavigation.get('A'),{position:'side',collapsed:false}));
 assert.equal(localStorage.getItem('energia-sur:navigation:v1:A'),null);
 failSave=true;
 fireEvent.click(screen.getByRole('radio',{name:'Superior (horizontal)'}));
 await screen.findByRole('button',{name:'Reintentar guardado'});
 assert.equal(document.querySelector('.app-shell').dataset.navigation,'top');
 failSave=false;
 fireEvent.click(screen.getByRole('button',{name:'Reintentar guardado'}));
 await waitFor(()=>assert.deepEqual(savedNavigation.get('A'),{position:'top',collapsed:false}));
});

test('personal data enters edit mode, cancels drafts and saves through the authenticated profile API',async()=>{
 let stored={firstName:'Franco',lastName:'Biason',phone:'123',address:'Ejemplo'};let saves=0;
 globalThis.fetch=async(_url,options)=>{if(options?.method==='PUT'){stored=JSON.parse(options.body);saves++;}return {ok:true,json:async()=>({email:'test@example.invalid',profile:stored})}};
 render(React.createElement(ProfileForm));const name=await screen.findByDisplayValue('Franco');assert.equal(name.disabled,true);
 fireEvent.click(screen.getByRole('button',{name:'Editar mis datos'}));assert.equal(name.disabled,false);fireEvent.change(name,{target:{value:'Borrador'}});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));assert.equal(name.value,'Franco');assert.equal(saves,0);
 fireEvent.click(screen.getByRole('button',{name:'Editar mis datos'}));fireEvent.change(name,{target:{value:'Actualizado'}});fireEvent.click(screen.getByRole('button',{name:'Guardar datos'}));await waitFor(()=>assert.equal(name.disabled,true));assert.equal(stored.firstName,'Actualizado');assert.equal(saves,1);assert.ok(screen.getByText('Datos guardados.'));
});

test('welcome uses the greeting asset and keeps the opt-out after a new mount',async()=>{
 const {WelcomeDialog}=load('src/components/WelcomeDialog.tsx',{
  'next/image':{__esModule:true,default:({unoptimized,...props})=>React.createElement('img',props)},
 });
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const first=render(React.createElement(WelcomeDialog));
 const modal=await screen.findByRole('dialog',{name:'¡Bienvenido a EnergIA Sur!'});
 assert.ok(modal.open);
 assert.equal(screen.getByRole('img',{name:'Lumi saludando'}).getAttribute('src'),'/assets/lumi/lumi-greeting.png');
 fireEvent.click(screen.getByRole('button',{name:'¡Empecemos!'}));
 assert.equal(screen.queryByRole('dialog'),null);
 assert.equal(localStorage.getItem('energia-sur-welcome-oculto'),null);
 first.unmount();
 const second=render(React.createElement(WelcomeDialog));
 await screen.findByRole('dialog');
 fireEvent.click(screen.getByRole('checkbox',{name:'No mostrar esta bienvenida nuevamente.'}));
 fireEvent.click(screen.getByRole('button',{name:'Cerrar bienvenida'}));
 assert.equal(localStorage.getItem('energia-sur-welcome-oculto'),'1');
 second.unmount();
 render(React.createElement(WelcomeDialog));
 assert.equal(screen.queryByRole('dialog'),null);
});

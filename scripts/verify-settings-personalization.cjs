const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost'});for(const k of ['window','document','HTMLElement','Node','MutationObserver','Event','localStorage'])globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const {render,screen,cleanup,waitFor,fireEvent}=require('@testing-library/react');
function load(file,stubs={}){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>stubs[n]||require(n),m.exports,m);return m.exports;}
const {NavigationPreferences,NavigationSettings}=load('src/components/NavigationPreferences.tsx');
const profileTypes=load('src/lib/profile-types.ts');
const {ProfileForm}=load('src/components/ProfileForm.tsx',{'@/lib/profile-types':profileTypes,'@/lib/use-polling':{usePolling:callback=>React.useEffect(()=>{void callback()},[callback])}});
afterEach(()=>{cleanup();localStorage.clear()});
test('sidebar position applies, persists on remount and stays isolated per authenticated user',async()=>{
 const view=render(React.createElement(NavigationPreferences,{userId:'A'},React.createElement(NavigationSettings)));
 await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Superior'}).getAttribute('aria-pressed'),'true'));
 fireEvent.click(screen.getByRole('button',{name:'Lateral'}));assert.equal(document.querySelector('.app-shell').dataset.navigation,'side');assert.equal(localStorage.getItem('energia-sur:navigation:v1:A'),'side');
 view.unmount();const restored=render(React.createElement(NavigationPreferences,{userId:'A'},React.createElement(NavigationSettings)));await waitFor(()=>assert.equal(document.querySelector('.app-shell').dataset.navigation,'side'));restored.unmount();
 render(React.createElement(NavigationPreferences,{userId:'B'},React.createElement(NavigationSettings)));await waitFor(()=>assert.equal(document.querySelector('.app-shell').dataset.navigation,'top'));
});
test('personal data enters edit mode, cancels drafts and saves through the authenticated profile API',async()=>{
 let stored={firstName:'Franco',lastName:'Biason',phone:'123',address:'Ejemplo'};let saves=0;
 globalThis.fetch=async(_url,options)=>{if(options?.method==='PUT'){stored=JSON.parse(options.body);saves++;}return {ok:true,json:async()=>({email:'test@example.invalid',profile:stored})}};
 render(React.createElement(ProfileForm));const name=await screen.findByDisplayValue('Franco');assert.equal(name.disabled,true);
 fireEvent.click(screen.getByRole('button',{name:'Editar mis datos'}));assert.equal(name.disabled,false);fireEvent.change(name,{target:{value:'Borrador'}});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));assert.equal(name.value,'Franco');assert.equal(saves,0);
 fireEvent.click(screen.getByRole('button',{name:'Editar mis datos'}));fireEvent.change(name,{target:{value:'Actualizado'}});fireEvent.click(screen.getByRole('button',{name:'Guardar datos'}));await waitFor(()=>assert.equal(name.disabled,true));assert.equal(stored.firstName,'Actualizado');assert.equal(saves,1);assert.ok(screen.getByText('Datos guardados.'));
});

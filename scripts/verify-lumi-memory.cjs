const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver', 'getComputedStyle']) globalThis[key] = key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, cleanup } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;
const fs = require('node:fs');const path = require('node:path');const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/lumi/LumiMemory.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const mod = { exports: {} };new Function('require', 'exports', 'module', code)(name => name === '../ConfigureTariffLink' ? {ConfigureTariffLink:()=>React.createElement('a',{href:'/ajustes#proveedor-tarifa'},'Configurar tarifa')} : name === './lumi-state' ? (() => { const stateMod={exports:{}}; const stateCode=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/lumi/lumi-state.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText; new Function('exports','module',stateCode)(stateMod.exports,stateMod); return stateMod.exports; })() : name.endsWith('.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) } : require(name), mod.exports, mod);
const { LumiMemory } = mod.exports;
const habit = { id: 'fixture', equipment: 'Pava eléctrica', kind: 'routine', localTime: '09:00', weekdays: [0,1,2,3,4], timezone: 'America/Argentina/Buenos_Aires', updatedAt: '2026-11-11T12:00:00Z' };
let calls, fail;
function Harness() {
  const [session, setSession] = React.useState({ version: '1', events: [], messages: [], memories: [habit], preferences: {} });
  return React.createElement(LumiMemory, { session, busy: false, onAction: async action => {
    calls.push(action);if (fail) { fail = false; return false; }
    if (action.action === 'memory' && action.operation === 'delete') setSession(current => ({ ...current, memories: [] }));
    if (action.action === 'memory' && action.operation === 'update') setSession(current => ({ ...current, memories: [{ ...habit, localTime: '10:00' }] }));
    if (action.action === 'preferences') setSession(current => ({ ...current, preferences: { ...current.preferences, ...action.preferences } }));
    return true;
  } });
}
function setup() { calls=[];fail=false;render(React.createElement(Harness));return userEvent.setup(); }
afterEach(cleanup);
test('memory edits explicit submission, preserves draft on error and supports cancellation', async () => {
  const user=setup();await user.click(screen.getByRole('button',{name:/Corregir recuerdo/}));
  const text=screen.getByLabelText('Corregí este recuerdo');assert.match(text.value,/09:00/);
  await user.clear(text);await user.type(text,'Ahora uso esa pava a las 10');assert.equal(calls.length,0);
  fail=true;await user.click(screen.getByRole('button',{name:'Guardar recuerdo'}));assert.match(screen.getByRole('alert').textContent,/Conservé tu texto/);assert.equal(text.value,'Ahora uso esa pava a las 10');
  await user.click(screen.getByRole('button',{name:'Guardar recuerdo'}));assert.equal(calls.length,2);assert.equal(screen.queryByLabelText('Corregí este recuerdo'),null);assert.ok(screen.getByText(/Horario: 10:00/));
  await user.click(screen.getByRole('button',{name:/Corregir recuerdo/}));await user.click(screen.getByRole('button',{name:'Cancelar'}));assert.equal(calls.length,2);
});
test('deletion requires explicit confirmation and only sends memory id',async()=>{
  const user=setup();await user.click(screen.getByRole('button',{name:/Eliminar recuerdo/}));assert.equal(calls.length,0);
  await user.click(screen.getByRole('button',{name:'Confirmar eliminación'}));assert.deepEqual(calls,[{action:'memory',operation:'delete',id:'fixture'}]);assert.ok(screen.getByText(/Todavía no hay recuerdos/));
});
test('memory pause and optional provider preferences use booleans without client identities',async()=>{
  const user=setup();await user.click(screen.getByRole('checkbox',{name:'Permitir guardar y usar hábitos energéticos'}));
  assert.deepEqual(calls[0],{action:'preferences',preferences:{memoryEnabled:false}});
  await user.click(screen.getByText('Redacción con un proveedor opcional'));await user.click(screen.getByRole('checkbox',{name:'Permitir el proveedor de lenguaje'}));
  assert.deepEqual(calls[1],{action:'preferences',preferences:{modelEnabled:true}});
});
test('supply has one editing source in Settings and sends no duplicate preference action',async()=>{
 const user=setup();await user.click(screen.getByText('Referencia de tu suministro'));assert.equal(screen.getByRole('link',{name:'Configurar tarifa'}).getAttribute('href'),'/ajustes#proveedor-tarifa');assert.equal(screen.queryByRole('button',{name:'Guardar referencia'}),null);assert.equal(calls.length,0);
});

test('pattern deletion requires confirmation and sends no client identity', async () => {
  const user=setup();
  await user.click(screen.getByText('Patrones estadísticos observados'));
  await user.click(screen.getByRole('button',{name:'Borrar patrones y asociaciones'}));
  assert.equal(calls.length,0);
  await user.click(screen.getByRole('button',{name:'Confirmar borrado de patrones y asociaciones'}));
  assert.deepEqual(calls,[{action:'memory',operation:'clearPatterns'}]);
  assert.ok(screen.getByText(/un análisis posterior puede volver a aprender/));
});

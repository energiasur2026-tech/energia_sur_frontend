const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver', 'getComputedStyle']) globalThis[key] = typeof dom.window[key] === 'function' && key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, cleanup, within } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependency = require) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', compiled)(dependency, mod.exports, mod);
  return mod.exports;
}
const state = load('components/lumi/lumi-state.ts');
const catalog = load('lib/home-catalog.ts');
const { LumiEvents } = load('components/lumi/LumiEvents.tsx', name => {
  if (name === './lumi-state') return state;
  if (name === '@/lib/home-catalog') return catalog;
  if (name === './lumi.module.css') return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  return require(name);
});
const electrical = { id: 'electrical', type: 'voltage', at: '2026-11-10T12:00:00Z', evidence: 'Electrical test fixture', question: null, read: false, userLabels: [] };
const consultation = { ...electrical, id: 'question', type: 'unusual_power', question: 'Fixture question?', evidence: 'Consumption test fixture' };
let current, calls, failNext;
function Harness({ initial = [electrical, consultation] }) {
  const [events, setEvents] = React.useState(() => structuredClone(initial));
  current = events;
  return React.createElement(LumiEvents, { events, busy: false, onAction: async action => {
    calls.push(action);
    if (failNext) { failNext = false; return false; }
    setEvents(previous => previous.map(event => event.id !== action.eventId ? event : action.action === 'read'
      ? { ...event, read: action.read }
      : { ...event, userLabels: action.labels, otherEquipment: action.otherEquipment ?? '', answered: action.labels.length > 0, answeredAt: action.labels.length ? new Date().toISOString() : null }));
    return true;
  } });
}
function setup(initial) { calls = []; failNext = false; render(React.createElement(Harness, { initial })); return userEvent.setup(); }
afterEach(cleanup);
const click = (user, name) => user.click(screen.getByRole('button', { name, exact: true }));
const expandFirst = user => user.click(screen.getAllByRole('button').find(button => button.getAttribute('aria-expanded') === 'false')); 

test('read action immediately changes counts, history retains event and permits unread', async () => {
  const user = setup();
  await click(user, 'Marcar como leído');
  assert.equal(current.find(e => e.id === 'electrical').read, true);
  assert.ok(screen.getByRole('button', { name: 'Pendientes (1)' }));
  await click(user, 'Historial (2)');
  await expandFirst(user);
  await click(user, 'Marcar como no leído');
  assert.equal(current.find(e => e.id === 'electrical').read, false);
  assert.ok(screen.getByRole('button', { name: 'Pendientes (2)' }));
  assert.equal(current.length, 2);
});
test('equipment choices remain local until save, can deselect and unknown is exclusive', async () => {
  const user = setup([consultation]);
  await user.click(screen.getByRole('checkbox', { name: 'Pava eléctrica' }));
  await user.click(screen.getByRole('checkbox', { name: 'Pava eléctrica' }));
  assert.equal(screen.getByRole('checkbox', { name: 'Pava eléctrica' }).checked, false);
  await user.click(screen.getByRole('checkbox', { name: 'Plancha' }));
  await user.click(screen.getByRole('checkbox', { name: 'No recuerdo' }));
  assert.equal(screen.getByRole('checkbox', { name: 'Plancha' }).checked, false);
  assert.equal(calls.length, 0);
  await click(user, 'Enviar respuesta');
  assert.deepEqual(current[0].userLabels, ['No recuerdo']);
  assert.equal(current[0].read, false);
  assert.ok(screen.getByText('No tenés consultas pendientes'));
  assert.equal(screen.getByRole('button', { name: 'Pendientes (0)' }).getAttribute('aria-pressed'), 'true');
  await click(user, 'Ver en historial');
  assert.ok(screen.getByText('Tu respuesta:'));
  assert.ok(screen.getByText(/^Respuesta modificada:/));
  assert.ok(screen.getByRole('button', { name: 'Pendientes (0)' }));
});
test('edit preloads answer, cancel leaves saved state untouched, save replaces it', async () => {
  const saved = { ...consultation, userLabels: ['Pava eléctrica'], answered: true, answeredAt: '2026-11-10T13:00:00Z' };
  const user = setup([saved]);
  await click(user, 'Historial (1)'); await expandFirst(user); await click(user, 'Editar respuesta');
  assert.equal(screen.getByRole('checkbox', { name: 'Pava eléctrica' }).checked, true);
  await user.click(screen.getByRole('checkbox', { name: 'Microondas' }));
  await click(user, 'Cancelar');
  assert.equal(calls.length, 0); assert.deepEqual(current[0].userLabels, ['Pava eléctrica']);
  await click(user, 'Editar respuesta');
  assert.equal(screen.getByRole('checkbox', { name: 'Microondas' }).checked, false);
  await user.click(screen.getByRole('checkbox', { name: 'Pava eléctrica' }));
  await user.click(screen.getByRole('checkbox', { name: 'Otro equipo' }));
  await user.type(screen.getByRole('textbox', { name: '¿Cuál? (opcional)' }), 'Tostadora');
  await click(user, 'Guardar cambios');
  assert.deepEqual(current[0].userLabels, ['Otro equipo']); assert.equal(current[0].otherEquipment, 'Tostadora');
  assert.equal(current.length, 1);
});
test('withdraw requires confirmation and brings consultation back to pending', async () => {
  const user = setup([{ ...consultation, userLabels: ['Plancha'], answered: true, read: true }]);
  await click(user, 'Historial (1)'); await expandFirst(user); await click(user, 'Retirar respuesta'); await click(user, 'Cancelar');
  assert.equal(calls.length, 0);
  await click(user, 'Retirar respuesta'); await click(user, 'Confirmar retiro');
  assert.deepEqual(current[0].userLabels, []); assert.equal(current[0].answered, false);
  assert.ok(screen.getByRole('button', { name: 'Pendientes (1)' }));
  assert.ok(screen.getByRole('button', { name: 'Enviar respuesta' }));
});
test('failed save retains draft and retries the actual mutation', async () => {
  const user = setup([consultation]);
  await user.click(screen.getByRole('checkbox', { name: 'Pava eléctrica' }));
  failNext = true; await click(user, 'Enviar respuesta');
  assert.ok(screen.getByRole('alert')); assert.equal(screen.getByRole('checkbox', { name: 'Pava eléctrica' }).checked, true);
  assert.deepEqual(current[0].userLabels, []);
  await click(user, 'Reintentar guardado');
  assert.deepEqual(current[0].userLabels, ['Pava eléctrica']); assert.equal(calls.length, 2);
});
test('a failed read does not change pending count and retry persists only reading', async () => {
  const user = setup([electrical]);
  failNext = true; await click(user, 'Marcar como leído');
  assert.equal(current[0].read, false);
  assert.ok(screen.getByRole('button', { name: 'Pendientes (1)' }));
  await click(user, 'Reintentar guardado');
  assert.equal(current[0].read, true);
  assert.deepEqual(current[0].userLabels, []);
  const snapshot = structuredClone(current);
  cleanup(); setup(snapshot);
  await click(user, 'Historial (1)'); await expandFirst(user);
  assert.ok(screen.getByRole('button', { name: 'Marcar como no leído' }));
});
test('filters distinguish unread notices from unanswered consultations', async () => {
  const user = setup([electrical, { ...consultation, read: true }, { ...consultation, id: 'answered', read: false, userLabels: ['No recuerdo'], answered: true }]);
  await click(user, 'Consultas (1)');
  assert.equal(screen.queryByText('Electrical test fixture'), null);
  assert.equal(screen.getAllByText('Consumption test fixture').length, 1);
  await click(user, 'Historial (2)');
  assert.equal(screen.getAllByText('Consumption test fixture').length, 2);
});
test('context remount clears draft and keyboard can select a full option', async () => {
  const user = setup([consultation]);
  await user.click(screen.getByRole('checkbox', { name: 'Plancha' }));
  cleanup(); setup([{ ...consultation, id: 'other-meter' }]);
  const option = screen.getByRole('checkbox', { name: 'Plancha' });
  assert.equal(option.checked, false);
  option.focus(); await user.keyboard(' '); assert.equal(option.checked, true);
  assert.equal(calls.length, 0);
});

test('answer consecutive consultations without changing filters or jumping to history', async () => {
  const user = setup([{ ...consultation, id: 'first', at: '2026-11-11T12:00:00Z' }, { ...consultation, id: 'second' }]);
  await click(user, 'Consultas (2)');
  const list = screen.getByLabelText('Elementos pendientes');
  list.scrollTop = 180;
  // Simulate a removed card above the next header in an actual scrolling viewport.
  list.getBoundingClientRect = () => ({ top: 100 });
  const cards = list.querySelectorAll('[data-event-id]');
  cards[0].getBoundingClientRect = () => ({ top: 100 });
  cards[1].getBoundingClientRect = () => ({ top: 100 });
  const first = within(cards[0]);
  await user.click(first.getByRole('checkbox', { name: 'Pava eléctrica' }));
  assert.equal(calls.length, 0);
  await user.click(first.getByRole('button', { name: 'Enviar respuesta' }));
  assert.equal(screen.getByRole('button', { name: 'Pendientes (1)' }).getAttribute('aria-pressed'), 'true');
  assert.equal(screen.getByRole('button', { name: 'Consultas (1)' }).getAttribute('aria-pressed'), 'true');
  assert.equal(list.scrollTop, 180);
  assert.equal(document.activeElement.dataset.eventId, 'second');
  assert.ok(screen.getByText('Respuesta guardada'));
  await user.click(screen.getByRole('checkbox', { name: 'No recuerdo' }));
  await click(user, 'Enviar respuesta');
  assert.ok(screen.getByText('No tenés consultas pendientes'));
  assert.equal(screen.getByRole('button', { name: 'Pendientes (0)' }).getAttribute('aria-pressed'), 'true');
  assert.equal(calls.length, 2);
});
test('history is collapsed, editing retains expanded record and event order', async () => {
  const user = setup([{ ...consultation, id: 'newer', at: '2026-11-11T12:00:00Z', answered: true, userLabels: ['Plancha'] }, { ...consultation, id: 'older', answered: true, userLabels: ['Microondas'] }]);
  await click(user, 'Historial (2)');
  assert.equal(screen.queryByRole('button', { name: 'Editar respuesta' }), null);
  const order = () => [...document.querySelectorAll('[data-event-id]')].map(node => node.dataset.eventId);
  assert.deepEqual(order(), ['newer', 'older']);
  await expandFirst(user); await click(user, 'Editar respuesta');
  await user.click(screen.getByRole('checkbox', { name: 'Plancha' }));
  await user.click(screen.getByRole('checkbox', { name: 'Pava eléctrica' }));
  await click(user, 'Guardar cambios');
  assert.equal(screen.getByRole('button', { name: 'Historial (2)' }).getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[data-event-id="newer"] button').getAttribute('aria-expanded'), 'true');
  assert.ok(screen.getByRole('button', { name: 'Editar respuesta' }));
  assert.deepEqual(order(), ['newer', 'older']);
});
test('both theme palettes keep selected text, dates, actions and focus distinguishable', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/app/globals.css'), 'utf8');
  const blocks = [css.match(/:root \{([\s\S]*?)\}/)[1], css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\}/)[1]];
  const luminance = hex => {
    const channels = hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
  for (const block of blocks) {
    const colors = Object.fromEntries([...block.matchAll(/--([a-z-]+): (#[a-f0-9]{6})/g)].map(m => [m[1], m[2]]));
    for (const [text, background] of [['foreground','surface'],['foreground','surface-raised'],['foreground','accent-soft'],['muted','surface'],['muted','surface-raised'],['accent','surface'],['danger','surface']]) {
      assert.ok(contrast(colors[text], colors[background]) >= 4.5, text + ' on ' + background);
    }
    assert.ok(contrast(colors.accent, colors['accent-soft']) >= 3, 'selected border/focus contrast');
  }
});

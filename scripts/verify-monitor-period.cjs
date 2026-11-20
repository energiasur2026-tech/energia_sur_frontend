'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
let query = new URLSearchParams();

function loadTsModule(filePath, cache = new Map()) {
  const abs = path.resolve(filePath);
  if (cache.has(abs)) return cache.get(abs).exports;
  const source = fs.readFileSync(abs, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: abs,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const mod = { exports: {} };
  cache.set(abs, mod);

  function customRequire(specifier) {
    if (specifier === 'next/link') {
      return {
        __esModule: true,
        default: ({ href, children, ...rest }) =>
          React.createElement('a', { href: String(href), ...rest }, children),
      };
    }
    if (specifier === 'next/navigation') {
      return {
        useSearchParams: () => query,
      };
    }
    if (specifier === './LazyCharts') return { EventChart: () => null };
    if (specifier.startsWith('@/')) {
      return loadTsModule(resolveWithExt(path.join(SRC, specifier.slice(2))), cache);
    }
    if (specifier.startsWith('.')) {
      return loadTsModule(resolveWithExt(path.resolve(path.dirname(abs), specifier)), cache);
    }
    return require(specifier);
  }

  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled);
  fn(customRequire, mod, mod.exports, abs, path.dirname(abs));
  return mod.exports;
}

function resolveWithExt(base) {
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`No se encontró módulo: ${base}`);
}

const { MonitorPeriodCards } = loadTsModule(path.join(SRC, 'components/MonitorPeriodCards.tsx'));

function render(props) {
  return renderToStaticMarkup(React.createElement(MonitorPeriodCards, props));
}

test('objetivo en pesos: muestra gasto, objetivo, porcentaje, barra, proyección, kWh y enlaces por medidor', () => {
  const html = render({
    failed: false,
    deviceId: 'meter-42',
    data: {
      spend: {
        closedOn: '2026-10-28',
        periodFrom: '2026-10-28T03:00:00.000Z',
        periodTo: '2026-11-18T03:00:00.000Z',
        goalMode: 'ars',
        spentArs: 18450,
        goalArs: 50000,
        goalKwh: 320,
        projectedArs: 43800,
        measuredKwh: 112.5,
        partial: false,
        missing: null,
        reason: null,
        projectionReason: null,
      },
      anomalies: {
        from: '2026-11-01T03:00:00.000Z',
        to: '2026-11-18T03:00:00.000Z',
        count: 3,
        active: 1,
        resolved: 2,
      },
    },
  });

  assert.match(html, /Gasto del período/);
  assert.match(html, /18\.450/);
  assert.match(html, /de un objetivo de/);
  assert.match(html, /50\.000/);
  assert.match(html, /36,9% utilizado/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /Proyección al cierre/);
  assert.match(html, /43\.800/);
  assert.match(html, /Consumo medido del período: 112,50 kWh/);
  assert.match(html, /href="\/proyeccion\?period=billing(&amp;|&)deviceId=meter-42"/);
  assert.match(html, /Anomalías del período/);
  assert.match(html, />3<\/p>/);
  assert.match(html, /1 anomalía activa/);
  assert.match(html, /2 episodios del período ya resueltos/);
  assert.match(html, /href="\/eventos\?period=current&amp;from=2026-11-01T03%3A00%3A00.000Z&amp;to=2026-11-18T03%3A00%3A00.000Z&amp;deviceId=meter-42"/);
});

test('objetivo sin configurar: muestra gasto sin barra de progreso falsa', () => {
  const html = render({
    failed: false,
    deviceId: null,
    data: {
      spend: {
        spentArs: 12300,
        goalArs: null,
        goalKwh: null,
        projectedArs: 28000,
        measuredKwh: 80,
        partial: false,
        missing: null,
        reason: null,
        projectionReason: null,
      },
      anomalies: {
        from: '2026-11-01T03:00:00.000Z',
        to: '2026-11-18T03:00:00.000Z',
        count: 0,
        detectionCurrent: true,
        active: 0,
        resolved: 0,
      },
    },
  });

  assert.match(html, /12\.300/);
  assert.match(html, /Sin objetivo económico configurado/);
  assert.doesNotMatch(html, /role="progressbar"/);
  assert.match(html, /0 anomalías activas en el período/);
});

test('tarifas no disponibles y lecturas insuficientes nunca muestran $0 falso', () => {
  const noTariff = render({
    failed: false,
    deviceId: 'meter-a',
    data: {
      spend: {
        spentArs: null,
        goalArs: 50000,
        goalKwh: null,
        projectedArs: null,
        measuredKwh: 21,
        partial: false,
        missing: 'tariff',
        reason: 'No hay tarifa vigente configurada para este período.',
        projectionReason: null,
      },
      anomalies: {
        from: null,
        to: '2026-11-18T03:00:00.000Z',
        count: null,
        active: 0,
        resolved: null,
      },
    },
  });

  assert.match(noTariff, /Cálculo en pesos no disponible/);
  assert.match(noTariff, /No hay tarifa vigente configurada/);
  assert.match(noTariff, /21,00 kWh/);
  assert.match(noTariff, /Configurar en Ajustes/);
  assert.doesNotMatch(noTariff, /\$\s*0\b/);
  assert.match(noTariff, /Resumen del período no disponible/);

  const noReadings = render({
    failed: false,
    deviceId: 'meter-b',
    data: {
      spend: {
        spentArs: null,
        goalArs: 40000,
        goalKwh: null,
        projectedArs: null,
        measuredKwh: null,
        partial: false,
        missing: 'readings',
        reason: 'Faltan al menos dos lecturas válidas en este período.',
        projectionReason: null,
      },
      anomalies: {
        from: '2026-11-01T03:00:00.000Z',
        to: '2026-11-18T03:00:00.000Z',
        count: 0,
        active: 0,
        resolved: 0,
      },
    },
  });

  assert.match(noReadings, /Faltan al menos dos lecturas válidas/);
  assert.match(noReadings, /Objetivo configurado:.*40\.000/);
  assert.doesNotMatch(noReadings, /Esperando lecturas del mes/);
});

test('mes provisional y detección desactualizada muestran su alcance', () => {
  const html = render({
    failed: false, deviceId: 'meter-x',
    data: {
      spend: { provisional: true, spentArs: 12350, goalArs: 40000, projectedArs: 29000, partial: true },
      anomalies: { provisional: true, count: 0, active: 0, detectionCurrent: false },
    },
  });
  assert.match(html, /Mes calendario actual — provisional/);
  assert.match(html, /Saldo hasta el objetivo \(provisional\):.*27\.650/);
  assert.match(html, /Proyección a fin de mes/);
  assert.match(html, /estado sin confirmar/);
  assert.doesNotMatch(html, /Normal/);
});

test('Eventos recibe el rango de Monitor, combina filtros y restablece la vista', async (t) => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  t.mock.method(globalThis, 'fetch', async (value) => {
    const url = new URL(value, 'http://localhost');
    requests.push(Object.fromEntries(url.searchParams));
    return { ok: true, json: async () => ({
      bounds: url.searchParams.get('period') === 'all' ? { from: null, lastDay: null } : { from, lastDay: to },
      events: url.searchParams.get('period') === 'custom' ? [] : episodes,
    }) };
  });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const { render, screen, fireEvent, cleanup, within } = require('@testing-library/react/pure');
  t.after(() => {
    cleanup();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    query = new URLSearchParams();
  });

  const requests = [];
  const from = '2026-11-01T03:00:00.000Z';
  const to = '2026-11-19T11:00:00.000Z';
  query = new URLSearchParams({ period: 'current', from, to, deviceId: 'meter-42' });
  const startedAt = '2026-11-18T14:00:00.000Z';
  const episodes = [
    { id: 1, type: 'OVERCURRENT', severity: 'CRITICAL', startedAt, endedAt: startedAt,
      lastViolationAt: startedAt, samples: 1, maxCurrent: 18.2, detectionThreshold: 14 },
    { id: 2, type: 'LOW_VOLTAGE', severity: 'WARNING', startedAt, endedAt: null,
      lastViolationAt: '2026-11-18T14:15:00.000Z', samples: 2, minVoltage: 199 },
  ];
  const { EventsView } = loadTsModule(path.join(SRC, 'components/EventsView.tsx'));
  render(React.createElement(EventsView));

  const summary = () => screen.getByRole('region', { name: 'Resumen de anomalías' });
  await screen.findByText('Período de Monitor · 1/11 al 19/11');
  assert.deepEqual(requests[0], { period: 'current', from, to, deviceId: 'meter-42', meterId: 'meter-42' });
  assert.match(summary().textContent, /2 episodios detectados · 1 en curso · 1 resuelto/);
  const resolved = screen.getByText('Resuelto').closest('li');
  assert.ok(within(resolved).getByText('Crítico'));
  assert.ok(within(resolved).getByText('Detectado en una lectura'));
  fireEvent.click(within(resolved).getByRole('button', { name: 'Ver qué pasó' }));
  assert.ok(within(resolved).getByText(/umbral de 14,0 A/));

  fireEvent.click(screen.getByRole('button', { name: 'En curso' }));
  assert.match(summary().textContent, /1 episodio detectado · 1 en curso · 0 resueltos/);
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'OVERCURRENT' } });
  assert.ok(screen.getByText('Ningún evento coincide con los filtros elegidos.'));
  fireEvent.change(screen.getByLabelText('Período'), { target: { value: '7d' } });
  await screen.findByText(/Últimos 7 días · /);
  assert.deepEqual(requests.at(-1), { period: '7d', deviceId: 'meter-42', meterId: 'meter-42' });

  fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-18' } });
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-18' } });
  await screen.findByText(/Personalizado · /);
  assert.deepEqual(requests.at(-1), { period: 'custom', from: '2026-11-18', to: '2026-11-18', deviceId: 'meter-42', meterId: 'meter-42' });
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
  await screen.findByText('Todo el historial', { selector: 'span' });
  assert.equal(screen.getByLabelText('Tipo').value, 'ALL');
  assert.equal(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed'), 'true');
});

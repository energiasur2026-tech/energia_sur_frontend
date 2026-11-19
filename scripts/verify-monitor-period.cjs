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
        useSearchParams: () => new URLSearchParams(),
      };
    }
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
        from: '2026-10-28T03:00:00.000Z',
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
  assert.match(html, /2 episodios resueltos en este período/);
  assert.match(html, /href="\/eventos\?deviceId=meter-42"/);
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
  assert.match(html, /0 anomalías activas registradas/);
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
  assert.match(noTariff, /Período sin configurar/);
  assert.match(noTariff, /Configurar período/);

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
        from: '2026-11-15T03:00:00.000Z',
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

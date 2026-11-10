const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/meter-selection.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, URL };
vm.runInNewContext(compiled, context);
const { selectedDeviceId, withMeterSelection } = context.exports;
assert.equal(selectedDeviceId(new URLSearchParams('deviceId=a')), 'a');
assert.equal(selectedDeviceId(new URLSearchParams('meterId=b')), 'b');
assert.equal(selectedDeviceId(new URLSearchParams('deviceId=a&meterId=b')), 'a');
assert.equal(selectedDeviceId(new URLSearchParams()), null);
const api = new URL(withMeterSelection('/api/lumi/v1?from=today#section', 'meter & one'), 'http://local');
assert.equal(api.searchParams.get('from'), 'today');
assert.equal(api.searchParams.get('deviceId'), 'meter & one');
assert.equal(api.searchParams.get('meterId'), 'meter & one');
assert.equal(api.hash, '#section');
const link = new URL(withMeterSelection('/proyeccion?meterId=old&month=2026-11', 'new', false), 'http://local');
assert.equal(link.searchParams.get('deviceId'), 'new');
assert.equal(link.searchParams.has('meterId'), false);
assert.equal(link.searchParams.get('month'), '2026-11');
assert.equal(withMeterSelection('/consumo', null), '/consumo');
console.log('12 meter-selection checks passed.');

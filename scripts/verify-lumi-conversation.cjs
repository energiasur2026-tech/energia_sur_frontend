const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name, dependency = require) {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/lumi/', name), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', compiled)(dependency, mod.exports, mod);
  return mod.exports;
}
const { messageKeys, isNearHistoryEnd } = load('lumi-conversation.ts');
const message = (n) => ({ role: n % 2 ? 'assistant' : 'user', at: 'fixture-' + n, text: 'Test message ' + n });

test('Polling an equal history preserves all message identities', () => {
  const messages = [message(0), message(1)];
  assert.deepEqual(messageKeys(messages), messageKeys(JSON.parse(JSON.stringify(messages))));
});
test('Rolling a full server history keeps surviving message identities', () => {
  const before = Array.from({ length: 100 }, (_, index) => message(index));
  const after = before.slice(1).concat(message(100));
  assert.deepEqual(messageKeys(before).slice(1), messageKeys(after).slice(0, -1));
});
test('Repeated text and timestamps receive distinct keys', () => {
  const one = message(0);
  const keys = messageKeys([one, { ...one }, { ...one }]);
  assert.equal(new Set(keys).size, 3);
});
test('A different assistant reply is recognized even when count and time match', () => {
  const first = message(1);
  assert.notEqual(messageKeys([first])[0], messageKeys([{ ...first, text: 'Another test reply' }])[0]);
});
test('Auto-follow allows the 64px near-end threshold but excludes older reading positions', () => {
  assert.equal(isNearHistoryEnd(1000, 400, 536), true);
  assert.equal(isNearHistoryEnd(1000, 400, 535), false);
  assert.equal(isNearHistoryEnd(1000, 400, 100), false);
});
test('Short and empty histories count as already at the end', () => {
  assert.equal(isNearHistoryEnd(100, 400, 0), true);
  assert.equal(isNearHistoryEnd(0, 400, 0), true);
});
test('Full avatar mounts all six image assets with a single active pose', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const states = load('lumi-state.ts');
  const { LumiAvatar } = load('LumiAvatar.tsx', (name) => {
    if (name === './lumi-state') return states;
    if (name === './lumi.module.css') return { __esModule: true, default: { avatar: 'avatar', compact: 'compact', character: 'character', indicator: 'indicator' } };
    return require(name);
  });
  for (const state of states.LUMI_STATES) {
    const html = renderToStaticMarkup(React.createElement(LumiAvatar, { state }));
    assert.equal((html.match(/<img /g) || []).length, 6);
    assert.equal((html.match(/data-active="true"/g) || []).length, 1);
    assert.equal((html.match(/loading="eager"/g) || []).length, 6);
    assert.equal((html.match(/width="480"/g) || []).length, 6);
    assert.equal((html.match(/height="520"/g) || []).length, 6);
  }
});

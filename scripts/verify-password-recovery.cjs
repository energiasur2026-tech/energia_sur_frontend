const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/password-recovery.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', compiled)(mod.exports, mod);
const { parseRecoveryCallback: parse, isLegacyRecoveryCallback: legacy, completePasswordRecovery: complete, validateNewPassword: validate, recoveryErrorMessage: message } = mod.exports;
const base = 'https://example.test/restablecer-clave';

test('PKCE callback preserves code and optional flow id', () => {
  assert.deepEqual(parse(base + '?code=test-code&sb_flow_id=test-flow'), { kind: 'code', code: 'test-code', flowId: 'test-flow' });
  assert.equal(parse(base + '?code=').kind, 'error');
});
test('Legacy implicit link requires both tokens and recovery type', () => {
  assert.deepEqual(parse(base + '#type=recovery&access_token=fixture-access&refresh_token=fixture-refresh'), { kind: 'tokens', accessToken: 'fixture-access', refreshToken: 'fixture-refresh' });
  assert.equal(parse(base + '#type=signup&access_token=fixture-access&refresh_token=fixture-refresh').kind, 'error');
  assert.equal(parse(base + '#type=recovery&access_token=fixture-access').kind, 'error');
});
test('Expired/error callbacks never fall back to an existing session', async () => {
  for (const href of [base+'#error=access_denied&error_code=otp_expired', base+'?error_code=otp_expired']) {
    let checked = false;
    await assert.rejects(complete({ getUser: async () => { checked = true; } }, parse(href)));
    assert.equal(checked, false);
  }
});
test('Recovery OTP cannot be confused with signup token hashes', () => {
  assert.deepEqual(parse(base+'?type=recovery&token_hash=fixture'), { kind: 'otp', tokenHash: 'fixture' });
  assert.equal(parse(base+'?type=signup&token_hash=fixture').kind, 'error');
});
test('Legacy login routes recovery fragments, not normal login or signup', () => {
  assert.equal(legacy('https://example.test/login#type=recovery&access_token=fixture'), true);
  assert.equal(legacy('https://example.test/login#error_code=otp_expired'), true);
  assert.equal(legacy('https://example.test/login#type=signup'), false);
  assert.equal(legacy('https://example.test/login'), false);
});
test('Session flags alone never authorize an anonymous password change', async () => {
  await assert.rejects(complete({ getUser: async () => ({ data: { user: null }, error: null }) }, parse(base)));
});
test('A failed PKCE exchange must fail even if a different user is signed in', async () => {
  let checked = false;
  await assert.rejects(complete({ exchangeCodeForSession: async () => ({ error: { code: 'invalid_grant' } }), getUser: async () => { checked = true; } }, { kind: 'code', code: 'expired' }));
  assert.equal(checked, false);
});
test('Successful PKCE exchange forwards flow id then validates identity', async () => {
  const calls = [];
  await complete({ exchangeCodeForSession: async (...args) => { calls.push(args); return { error: null }; }, getUser: async () => { calls.push('verified'); return { data: { user: { id: 'fixture-user' } }, error: null }; } }, { kind: 'code', code: 'fixture-code', flowId: 'fixture-flow' });
  assert.deepEqual(calls, [['fixture-code', { flowId: 'fixture-flow' }], 'verified']);
});
test('Implicit tokens are submitted to Supabase and followed by remote identity validation', async () => {
  const calls = [];
  await complete({ setSession: async (tokens) => { calls.push(tokens); return { error: null }; }, getUser: async () => { calls.push('verified'); return { data: { user: { id: 'fixture-user' } }, error: null }; } }, { kind: 'tokens', accessToken: 'fixture-access', refreshToken: 'fixture-refresh' });
  assert.deepEqual(calls, [{ access_token: 'fixture-access', refresh_token: 'fixture-refresh' }, 'verified']);
});
test('A rejected implicit session cannot use an older valid session', async () => {
  await assert.rejects(complete({ setSession: async () => ({ error: { code: 'bad_jwt' } }) }, { kind: 'tokens', accessToken: 'fixture', refreshToken: 'fixture' }));
});
test('OTP uses recovery type and validates identity', async () => {
  let params;
  await complete({ verifyOtp: async (value) => { params = value; return { error: null }; }, getUser: async () => ({ data: { user: { id: 'fixture' } }, error: null }) }, { kind: 'otp', tokenHash: 'fixture-hash' });
  assert.deepEqual(params, { type: 'recovery', token_hash: 'fixture-hash' });
});
test('New password confirmation and minimum length are checked without trimming passwords', () => {
  assert.ok(validate('short', 'short'));
  assert.ok(validate('fixture-long', 'different'));
  assert.equal(validate(' fixture-long ', ' fixture-long '), null);
});
test('Error text does not expose raw Supabase messages, credentials or URLs', () => {
  assert.ok(!message(new Error('private-fixture-token')).includes('private-fixture-token'));
  assert.match(message({ code: 'same_password' }), /diferente/);
  assert.match(message({ code: 'weak_password' }), /requisitos/);
  assert.match(message({ code: 'over_email_send_rate_limit' }), /límite/);
});

// Run from your terminal: npm run local:stack. Keep this terminal open.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const net = require('node:net');
const front = path.resolve(__dirname, '..');
const root = path.dirname(front);
const back = path.join(root, 'energIA_sur_backend');
const ml = path.join(root, 'energIA_sur_machine_learning');

function nodeRuntime() {
  if (Number(process.versions.node.split('.')[0]) >= 22) return process.execPath;
  const candidates = [];
  for (const base of [process.env.NVM_HOME, path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'runtimes', 'cua_node')]) {
    if (!base || !fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      candidates.push(path.join(base, name, 'node.exe'), path.join(base, name, 'bin', 'node.exe'));
    }
  }
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      if (Number(cp.execFileSync(candidate, ['-p', 'process.versions.node.split(".")[0]'], { encoding: 'utf8', windowsHide: true }).trim()) >= 22) return candidate;
    } catch { /* Try another installed runtime. */ }
  }
  throw new Error('Se necesita Node.js 22 o 24 para iniciar los proyectos.');
}
function pythonRuntime() {
  const candidates = [process.env.LUMI_TEST_PYTHON, path.join(ml, '.venv', 'Scripts', 'python.exe'), 'python'];
  const installed = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python');
  if (fs.existsSync(installed)) for (const name of fs.readdirSync(installed)) candidates.push(path.join(installed, name, 'python.exe'));
  for (const candidate of candidates.filter(Boolean)) {
    try {
      const version = cp.execFileSync(candidate, ['-c', 'import sys; print(int(sys.version_info >= (3, 11)))'], { encoding: 'utf8', windowsHide: true }).trim();
      if (version === '1') return candidate;
    } catch { /* Try another installed runtime. */ }
  }
  throw new Error('Se necesita Python 3.11 o superior para iniciar Lumi.');
}
function assertFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('El puerto ' + port + ' ya está ocupado. Cerrá la ejecución anterior antes de iniciar otra.')));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function main() {
  const node = nodeRuntime();
  const python = pythonRuntime();
  const envPath = path.join(back, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('Falta energIA_sur_backend/.env.local');
  require('@next/env').loadEnvConfig(back);
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LUMI_SERVICE_SECRET']) {
    if (!process.env[key]) throw new Error('Falta configurar ' + key + ' en el backend.');
  }
  for (const directory of [front, back]) {
    if (!fs.existsSync(path.join(directory, '.next', 'BUILD_ID'))) throw new Error('Falta compilar ' + path.basename(directory) + ' con npm run build.');
  }
  await Promise.all([3000, 3001, 8010].map(assertFree));
  const children = [];
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill();
    process.exitCode = code;
  }
  function start(name, exe, args, cwd, extra = {}) {
    const child = cp.spawn(exe, args, { cwd, windowsHide: true, stdio: 'inherit', env: { ...process.env, ...extra } });
    children.push(child);
    child.on('error', () => { console.error('No se pudo iniciar ' + name + '. Verificá su runtime.'); stop(1); });
    child.on('exit', code => { if (!stopping) { console.error(name + ' se detuvo. Revisá el mensaje anterior.'); stop(code || 1); } });
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
  start('Lumi', python, ['-m', 'lumi.server'], ml, {
    LUMI_DB_PATH: path.join(ml, 'data', 'lumi-local.sqlite3'), LUMI_PORT: '8010', LUMI_HOST: '127.0.0.1',
  });
  start('Backend', node, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'], back, {
    LUMI_SERVICE_URL: 'http://127.0.0.1:8010', LUMI_ALLOWED_ORIGINS: 'http://127.0.0.1:3000,http://localhost:3000',
  });
  start('Frontend', node, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], front, {
    BACKEND_URL: 'http://127.0.0.1:3001',
  });
  console.log('EnergIA Sur: http://127.0.0.1:3000 — mantené esta terminal abierta. Ctrl+C detiene los tres servicios.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

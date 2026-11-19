const {copyFileSync, cpSync, mkdirSync, readdirSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '..');
const destination = join(root, 'public', 'invoice-engine');
const modules = join(root, 'node_modules');
mkdirSync(destination, {recursive:true});
const copy = (folder, file) => copyFileSync(join(modules, folder, file), join(destination, file));
copy('pdfjs-dist/build', 'pdf.worker.min.mjs');
copy('tesseract.js/dist', 'worker.min.js');
copy('@tesseract.js-data/spa/4.0.0_best_int', 'spa.traineddata.gz');
for (const folder of ['standard_fonts','cmaps']) {
  cpSync(join(modules,'pdfjs-dist',folder),join(destination,folder),{recursive:true});
}
for (const file of readdirSync(join(modules, 'tesseract.js-core'))) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(file)) copy('tesseract.js-core', file);
}

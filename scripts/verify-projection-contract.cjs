const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('src/lib/projection-contract.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const box={exports:{}};vm.runInNewContext(code,box);const valid=JSON.parse(fs.readFileSync('src/app/projection-preview/fixture.json','utf8'));
assert.equal(box.exports.isMonthlyProjection(valid),true);
for(const payload of [null,[],{}, {goal:valid.goal}, {...valid,tariff:undefined},{...valid,quality:null},{...valid,chart:null},{...valid,warnings:null}])assert.equal(box.exports.isMonthlyProjection(payload),false);
console.log('9 projection contract checks passed; legacy responses never reach rendering.');

const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file,dependency=require){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/lumi',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports','module',code)(dependency,mod.exports,mod);return mod.exports;}
const state=load('lumi-state.ts');const {newEventSound,CUES,LumiAudio}=load('lumi-sound.ts',name=>name==='./lumi-state'?state:require(name));
const query={id:'q',type:'unusual_power',question:'?',userLabels:[],read:false};const alert={...query,id:'a',type:'voltage',question:null};const suggestion={...alert,id:'s',type:'goal_risk'};
test('new notifications have distinct priority cues without replaying initial history or polling',()=>{
 assert.equal(newEventSound(null,[query]),null);assert.equal(newEventSound(new Set(['q']),[query]),null);
 assert.equal(newEventSound(new Set(),[query]),'question');assert.equal(newEventSound(new Set(),[query,alert]),'alert');assert.equal(newEventSound(new Set(),[suggestion]),'suggestion');
 assert.equal(newEventSound(new Set(),[query],true),null);assert.equal(newEventSound(new Set(),[{...query,answered:true}]),null);
 assert.notDeepEqual(CUES.question,CUES.alert);assert.notDeepEqual(CUES.success,CUES.error);
});
test('audio waits for a gesture unlock, respects mute/hidden tab, cooldown and cleanup',()=>{
 let created=0,started=0,stopped=0,closed=0;
 class Context{constructor(){created++;this.state='running';this.currentTime=10;this.destination={};}createOscillator(){return{frequency:{},connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}close(){closed++;return Promise.resolve();}resume(){return Promise.resolve();}}
 global.window={AudioContext:Context};global.document={visibilityState:'visible'};
 const audio=new LumiAudio();audio.play('question');assert.equal(created,0);audio.unlock();audio.play('question');assert.equal(started,3);
 audio.play('alert');assert.equal(started,3);audio.setEnabled(false);assert.ok(stopped>=3);audio.play('success');assert.equal(started,3);
 audio.setEnabled(true);document.visibilityState='hidden';audio.play('alert');assert.equal(started,3);document.visibilityState='visible';audio.play('alert');assert.equal(started,6);
 audio.dispose();assert.equal(closed,1);delete global.window;delete global.document;
});
test('Argentine event timestamps are explicit 24h and UTC legacy messages remain correct',()=>{
 assert.equal(state.formatLumiDate('2026-11-11T19:40:10+00:00'),'11/11/2026, 16:40:10');
 assert.equal(state.formatLumiDate('2026-11-11 19:40:10'),'11/11/2026, 16:40:10');
 assert.equal(state.formatLumiDate('2026-11-11T02:00:00Z'),'10/11/2026, 23:00:00');
 assert.equal(state.formatLumiDate('bad'),'Fecha no disponible');
});

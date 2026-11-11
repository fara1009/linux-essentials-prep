import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {selectQuestions,grade,shuffle} from './engine.mjs';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const lessons=json('content/lessons.json'),manifest=json('dist/content-manifest.json');
const bank=json('dist/questions.json'),cards=json('dist/cards.json'),commands=json('dist/commands.json');
assert.deepEqual(lessons.map(l=>l.number),[13,14,15,16,17,18]);
for(const l of lessons){
  assert.equal(read(`dist/notes/lesson-${l.number}.txt`),l.markdown,`Full text preservation: ${l.number}`);
  const record=manifest.lessons.find(x=>x.number===l.number);
  assert.equal(record.sha256,crypto.createHash('sha256').update(l.markdown).digest('hex'));
  const html=read(`dist/lessons/${l.number}/index.html`);
  const headings=[...l.markdown.matchAll(/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/gm)];
  assert.ok(headings.length>10,`Chapter sections ${l.number}`);
  assert.equal(headings.length,record.sections);
  for(const h of headings)assert.ok(html.includes(`id="section-${h[1]}"`),`Missing section ${l.number}/${h[1]}`);
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  for(const block of l.markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm))assert.ok(html.includes(escape(block[1].replace(/\r?\n$/,''))),`Missing terminal example in ${l.number}`);
  assert.ok(bank.filter(q=>q.lesson===l.number).length>=30);
  assert.ok(cards.some(q=>q.lesson===l.number));
  assert.ok(commands.some(q=>q.lesson===l.number));
}
assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
assert.equal(new Set(bank.map(q=>q.question)).size,bank.length);
for(const q of bank){assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4,q.id);assert.ok(q.choices.includes(q.answer));for(const f of ['topic','question','answer','explanation'])assert.ok(q[f]?.trim(),q.id+' '+f);assert.ok(q.explanation.length>=45,q.id+' meaningful explanation');}
for(const q of cards){assert.ok(q.answer&&q.question);assert.ok(!/^[-: ]+$/.test(q.question));assert.notEqual(q.question,'Вопрос');}
for(let i=0;i<40;i++){
  const selected=selectQuestions(bank,[13,14,15,16,17,18],20);
  assert.equal(selected.length,20);assert.equal(new Set(selected.map(q=>q.id)).size,20);
  const counts=[13,14,15,16,17,18].map(l=>selected.filter(q=>q.lesson===l).length);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,'Balanced mixed lessons');
  for(const q of selected)assert.ok(q.choices.includes(q.answer));
}
assert.equal(selectQuestions(bank,[17],999).length,30);
assert.equal(selectQuestions(bank,[],20).length,0);
assert.equal(selectQuestions(bank,[13,14,15,16,17,18],999).length,180);
const selected=selectQuestions(bank,[13],3);
const answers={[selected[0].id]:selected[0].answer,[selected[1].id]:selected[1].choices.find(c=>c!==selected[1].answer)};
assert.equal(grade(selected,answers).correct,1);assert.equal(grade(selected,answers).total,3);
assert.deepEqual([...shuffle([1,2,3,4])].sort(),[1,2,3,4]);
for(const file of ['app.mjs','build.mjs','engine.mjs','server.mjs']){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
const htmlFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.html'))htmlFiles.push(p);}}walk('dist');
for(const file of htmlFiles){const html=read(file);assert.ok(!html.includes('\u0001'),'Unresolved inline formatting token');assert.equal((html.match(/<pre>/g)||[]).length,(html.match(/<\/pre>/g)||[]).length);for(const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){const p=path.join('dist',m[1]);assert.ok(fs.existsSync(p),`Broken internal link in ${file}: ${m[1]}`);}const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,`Duplicate ids: ${file}`);}
console.log(`PASS: exact notes (${lessons.reduce((s,l)=>s+l.markdown.length,0)} chars), ${manifest.lessons.reduce((s,l)=>s+l.sections,0)} sections, ${bank.length} questions, ${cards.length} cards, ${commands.length} command examples, ${htmlFiles.length} pages; sampling, grading, syntax and links.`);

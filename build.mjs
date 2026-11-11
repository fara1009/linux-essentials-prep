import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
process.chdir(decodeURIComponent(root));
const lessons=JSON.parse(fs.readFileSync('content/lessons.json','utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function inline(text) {
  const stash=[];const token=x=>`\u0001${stash.push(x)-1}\u0001`;
  let s=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>token(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${inline(label)}</a>`));
  s=s.replace(/`([^`]+)`/g,(_,x)=>token(`<code>${esc(x)}</code>`));
  s=esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  return s.replace(/\u0001(\d+)\u0001/g,(_,i)=>stash[+i]);
}
const splitCells=line=>{
  const source=line.trim().replace(/^\|/,'').replace(/\|$/,'');
  const cells=[];let cell='',ticks=false;
  for(let i=0;i<source.length;i++){
    if(source[i]==='\\'&&source[i+1]==='|'){cell+='|';i++;continue;}
    if(source[i]==='`')ticks=!ticks;
    if(source[i]==='|'&&!ticks){cells.push(cell.trim());cell='';}else cell+=source[i];
  }
  cells.push(cell.trim());return cells;
};
function render(md, number) {
  const lines=md.split(/\r?\n/), out=[], sections=[], commands=[];let i=0;
  while(i<lines.length){const line=lines[i];
    if(!line.trim()){i++;continue;}
    if(/^```/.test(line)){const lang=line.slice(3).trim();const code=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);i++;
      const body=code.join('\n');out.push(`<div class="code-wrap"><div class="code-bar"><span>${lang==='console'?'ТЕРМИНАЛ':lang==='bash'?'КОМАНДА':'ПРИМЕР'}</span><button class="copy-code" type="button">Копировать пример</button></div><pre><code>${esc(body)}</code></pre></div>`);
      const prompts=code.map(l=>l.match(/^(?:[\w.@:/~+-]+(?:@[\w.-]+)?[^\n]*?)?[$#]\s+(.+)$/)?.[1]).filter(Boolean);
      for(const cmd of prompts)commands.push({lesson:number,command:cmd,example:body});continue;
    }
    const heading=line.match(/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/);
    if(heading){const id=`section-${heading[1]}`;sections.push({id,title:heading[2],number:+heading[1]});out.push(`<h2 id="${id}"><span class="section-num">${heading[1].padStart(2,'0')}</span>${inline(heading[2])}<a class="anchor-link" href="#${id}" aria-label="Ссылка на раздел">#</a></h2>`);i++;continue;}
    if(/^---\s*$/.test(line)){out.push('<hr>');i++;continue;}
    if(line.trim().startsWith('|')&&lines[i+1]?.match(/^\s*\|?[\s:|-]+\|/)){
      const headers=splitCells(line);i+=2;const rows=[];
      while(i<lines.length&&lines[i].trim().startsWith('|'))rows.push(splitCells(lines[i++]));
      out.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="Таблица материала"><table><thead><tr>${headers.map(x=>`<th scope="col">${inline(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
    }
    if(/^\s*[-*]\s+/.test(line)||/^\s*\d+\.\s+/.test(line)){
      const ordered=/^\s*\d+\./.test(line), rows=[];
      while(i<lines.length&&(ordered?/^\s*\d+\.\s+/:/^\s*[-*]\s+/).test(lines[i]))rows.push(lines[i++].replace(ordered?/^\s*\d+\.\s+/:/^\s*[-*]\s+/,''));
      out.push(`<${ordered?'ol':'ul'}>${rows.map(x=>`<li>${inline(x)}</li>`).join('')}</${ordered?'ol':'ul'}>`);continue;
    }
    if(/^>\s?/.test(line)){const rows=[];while(i<lines.length&&/^>/.test(lines[i]))rows.push(lines[i++].replace(/^>\s?/,''));out.push(`<blockquote>${rows.map(inline).join('<br>')}</blockquote>`);continue;}
    const p=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^```|^\*\*\d+\.|^---$|^\||^>\s?|^\s*[-*]\s+|^\s*\d+\.\s+/.test(lines[i]))p.push(lines[i++]);
    out.push(`<p>${p.map(inline).join('\n')}</p>`);
  }
  return {html:out.join('\n'),sections,commands};
}
function cardsFrom(md,number){const lines=md.split(/\r?\n/);let active=false;const cards=[];for(const l of lines){if(/^\*\*\d+\./.test(l))active=/самопровер/i.test(l);if(active&&l.trim().startsWith('|')){const a=splitCells(l);if(a.length===2&&!/^(Вопрос|[-: ]+)$/.test(a[0])&&a[0]&&a[1])cards.push({id:`card-${number}-${cards.length+1}`,lesson:number,question:a[0].replace(/\*\*/g,''),answer:a[1]});}}return cards;}
const enriched=lessons.map(l=>({...l,...render(l.markdown,l.number)}));
const cards=enriched.flatMap(l=>cardsFrom(l.markdown,l.number));
const commands=[...new Map(enriched.flatMap(l=>l.commands).filter(x=>/^[A-Za-z./][\w./-]*(?:\s|$)/.test(x.command)&&!/^\^|^(?:Password:|passwd:)/.test(x.command)).map(x=>[x.lesson+'|'+x.command,x])).values()];
const quizLines=fs.readFileSync('content/questions.txt','utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'));
const quizzes=quizLines.map((l,i)=>{const [lesson,topic,question,answer,b,c,d,explanation]=l.split(' | ');if(!explanation)throw new Error('Invalid question '+(i+1));return {id:'q'+(i+1),lesson:+lesson,topic,question,answer,choices:[answer,b,c,d],explanation};});
const icon=`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 6 6 6-6 6M13 18h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const nav=(active,lesson)=>`<a class="brand" href="/"><span class="brand-icon">${icon}</span><span>LINUX<span class="brand-sub">учиться · понимать · применять</span></span></a><div class="nav-label">ТВОЯ ПОДГОТОВКА</div><a class="nav-item ${active==='home'?'active':''}" href="/"><span>⌂</span>Обзор курса</a><a class="nav-item ${active==='quiz'?'active':''}" href="/quiz/"><span>◇</span>Тренажёр и квизы</a><a class="nav-item ${active==='commands'?'active':''}" href="/commands/"><span>⌘</span>Примеры команд</a><div class="nav-label lesson-label">УРОКИ <span>13—18</span></div><nav aria-label="Уроки">${enriched.map(l=>`<a class="lesson-link ${lesson===l.number?'active':''}" href="/lessons/${l.number}/"><span class="nav-number">${l.number}</span><span>${esc(l.title)}</span><span class="read-indicator" data-read="${l.number}"></span></a>`).join('')}</nav><div class="sidebar-note"><span class="status-dot"></span><strong>Понемногу каждый день</strong><p>Конспект → практика → разбор ошибок.</p><div class="mini-progress"><span id="side-progress"></span></div><small id="side-progress-text">0 из 6 уроков изучено</small></div>`;
function layout(title,active,body,lesson=null){return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#153b32"><meta name="description" content="Полные конспекты Linux Essentials 13–18 и квизы для подготовки к экзамену."><title>${esc(title)} · Linux Essentials</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"></head><body data-page="${active}" ${lesson?`data-lesson="${lesson}"`:''}><a class="skip-link" href="#main">К содержимому</a><div class="mobile-shade" id="mobile-shade"></div><aside class="sidebar" id="sidebar">${nav(active,lesson)}</aside><div class="workspace"><header class="topbar"><button class="menu-button" id="menu-toggle" aria-label="Открыть меню" aria-expanded="false">☰</button><div class="breadcrumb">Linux Essentials <span>/</span> ${lesson?'Урок '+lesson:active==='quiz'?'Практика':active==='commands'?'Команды':'Подготовка к экзамену'}</div><button class="search-trigger" id="open-search"><span>⌕</span><span>Поиск по конспектам</span><kbd>Ctrl K</kbd></button></header><main id="main">${body}</main><footer class="site-footer"><span>Linux Essentials · NDG · Уроки 13–18</span><span>Прогресс хранится в этом браузере.</span></footer></div><dialog id="search-dialog" aria-label="Поиск по материалам"><div class="search-head"><span>⌕</span><input id="global-search" placeholder="Команда, путь или понятие…" aria-label="Поиск по всем урокам"><button id="close-search" aria-label="Закрыть поиск">×</button></div><div id="search-results" class="search-results"><p>Ищи по всем шести конспектам. Например: chmod, /etc/shadow, DNS.</p></div></dialog><div id="toast" role="status"></div><script type="module" src="/app.mjs"></script></body></html>`;}
const home=`<div class="page-width"><div class="eyebrow"><span class="status-dot"></span>ТВОЙ МАРШРУТ К ЭКЗАМЕНУ</div><section class="hero"><div><h1>Linux.<br>По полочкам<span class="green-dot">.</span></h1><p class="hero-copy">От процессов и сети до прав и ссылок.<br>Шесть полных уроков — и практика, которая помогает запомнить.</p><div class="hero-actions"><a class="button primary" href="/quiz/">Начать смешанный квиз <span>↗</span></a><a class="button secondary" id="continue-link" href="/lessons/13/">Открыть конспект →</a></div><div class="hero-chips"><span>01 / Читай</span><span>02 / Проверяй себя</span><span>03 / Повторяй ошибки</span></div></div><div class="terminal-card"><div class="terminal-top"><i></i><i></i><i></i><span>твой прогресс</span></div><div class="terminal-body"><span class="terminal-prompt">sysadmin@learning:~$</span> whoami<br><strong>будущий Linux-специалист</strong><div class="terminal-rule"></div><div class="progress-row"><span>Изучено уроков</span><b id="hero-read">0 / 6</b></div><div class="progress-track"><span id="hero-progress"></span></div><div class="terminal-stats"><div><b id="hero-answers">0</b><span>ответов в квизах</span></div><div><b id="hero-accuracy">—</b><span>точность</span></div></div><div class="terminal-tip">$ один урок сегодня — уверенность завтра<span class="cursor">▌</span></div></div></div></section><section class="stat-strip"><div><b>6</b><span>полных уроков</span></div><div><b>${enriched.reduce((s,l)=>s+l.sections.length,0)}</b><span>разделов конспекта</span></div><div><b>${quizzes.length}</b><span>вопросов в тестах</span></div><div><b>${cards.length}</b><span>карточек для повторения</span></div></section><section><div class="section-heading"><div><div class="eyebrow">КОНСПЕКТЫ</div><h2>Твоя база знаний</h2><p>Весь материал из этого чата. Без сокращений, с командами и примерами вывода.</p></div><span class="small-label">ОДИН УРОК — ОДНА СТРАНИЦА</span></div><div class="lesson-grid">${enriched.map((l,i)=>`<a class="lesson-card" href="/lessons/${l.number}/"><div class="card-top"><span class="lesson-badge">${l.number}</span><span class="card-status" data-card-status="${l.number}">К изучению</span></div><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p><div class="card-bottom"><span>${l.sections.length} разделов</span><span>Открыть урок ↗</span></div></a>`).join('')}</div></section><section class="practice-banner"><div><div class="eyebrow">СОБЕРИ ВСЁ ВМЕСТЕ</div><h2>Темы разные.<br>Знание — одно.</h2><p>Перемешанные вопросы проверяют, умеешь ли ты выбирать правильную команду и объяснять результат.</p><a class="button primary" href="/quiz/">Перейти к практике →</a></div><div class="banner-code"><span class="code-muted"># Что покажет команда?</span><br><span class="code-green">$</span> chmod 640 report.txt<br><br><span class="code-muted"># А теперь — совсем другая тема</span><br><span class="code-green">$</span> dig -x 192.168.1.2<br><br><span class="code-muted"># Учись переключаться между задачами.</span></div></section><section class="history-section"><div class="section-heading"><div><div class="eyebrow">ЛИЧНЫЙ РЕЗУЛЬТАТ</div><h2>Последние тренировки</h2></div><button class="text-button" id="reset-progress">Сбросить прогресс</button></div><div id="history-list" class="empty-state">Пройди первый квиз — здесь появится результат и темы для повторения.</div></section></div>`;
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',layout('Подготовка к экзамену','home',home));
const search=[];
for(const l of enriched){
  const toc=`<div class="toc-title">В ЭТОМ УРОКЕ</div><nav aria-label="Содержание урока">${l.sections.map(s=>`<a href="#${s.id}" data-toc="${s.id}"><span>${s.number.toString().padStart(2,'0')}</span>${esc(s.title)}</a>`).join('')}</nav>`;
  const body=`<div class="lesson-head"><a class="back-link" href="/">← Все уроки</a><div class="lesson-heading-row"><div><div class="eyebrow">УРОК ${l.number} / LINUX ESSENTIALS</div><h1>${esc(l.title)}</h1><p>${esc(l.summary)}</p></div><span class="big-number">${l.number}</span></div><div class="lesson-toolbar"><button class="button secondary" id="mark-read" data-number="${l.number}">Отметить изученным</button><a class="button primary" href="/quiz/?lesson=${l.number}">Квиз по уроку ↗</a><button class="text-button" id="print-lesson">Печать</button><a class="text-button" href="/notes/lesson-${l.number}.txt" download>Скачать полный конспект</a></div><details class="mobile-toc"><summary>Содержание: ${l.sections.length} разделов</summary>${toc}</details></div><div class="lesson-layout"><article class="prose" id="lesson-content">${l.html}</article><aside class="toc">${toc}</aside></div><div class="lesson-finish"><div><span class="eyebrow">ЗАКРЕПИ МАТЕРИАЛ</span><h2>Теперь проверь себя</h2><p>Пройди квиз по уроку или смешай все темы.</p></div><a class="button primary" href="/quiz/?lesson=${l.number}">Практика: урок ${l.number} →</a></div><nav class="lesson-pager">${l.number>13?`<a href="/lessons/${l.number-1}/">← Урок ${l.number-1}</a>`:'<span></span>'}${l.number<18?`<a href="/lessons/${l.number+1}/">Урок ${l.number+1} →</a>`:'<a href="/quiz/">Смешанный квиз →</a>'}</nav>`;
  const dest=`dist/lessons/${l.number}`;fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(dest+'/index.html',layout('Урок '+l.number+' — '+l.title,'lesson',body,l.number));
  fs.mkdirSync('dist/notes',{recursive:true});fs.writeFileSync(`dist/notes/lesson-${l.number}.txt`,l.markdown);
  const pattern=/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/gm;const matches=[...l.markdown.matchAll(pattern)];
  for(let i=0;i<matches.length;i++){const m=matches[i],end=matches[i+1]?.index??l.markdown.length;search.push({lesson:l.number,id:'section-'+m[1],title:m[2],text:l.markdown.slice(m.index,end).replace(/[`*|]/g,' ').replace(/\s+/g,' ').trim()});}
}
const quizBody=`<div class="page-width quiz-page"><div class="eyebrow">ПРАКТИКА, КОТОРАЯ ОСТАЁТСЯ В ГОЛОВЕ</div><h1>Проверь понимание<span class="green-dot">.</span></h1><p class="page-lead">Смешивай темы, разбирай ошибки и возвращайся к нужному разделу конспекта.</p><div id="quiz-root" aria-live="polite"></div></div>`;
fs.mkdirSync('dist/quiz',{recursive:true});fs.writeFileSync('dist/quiz/index.html',layout('Квизы и повторение','quiz',quizBody));
const commandBody=`<div class="page-width"><div class="eyebrow">БЫСТРЫЙ ДОСТУП</div><h1>Примеры команд<span class="green-dot">.</span></h1><p class="page-lead">Терминальные примеры из полных конспектов. Это учебные записи, команды здесь не выполняются.</p><div class="command-filters"><input id="command-search" type="search" placeholder="Найти команду: chmod, ps, dig…" aria-label="Найти команду"><select id="command-lesson" aria-label="Урок"><option value="all">Все уроки</option>${lessons.map(l=>`<option value="${l.number}">Урок ${l.number}</option>`).join('')}</select></div><p class="muted" id="command-count"></p><div id="command-list"></div><button class="button secondary" id="more-commands" hidden>Показать ещё</button></div>`;
fs.mkdirSync('dist/commands',{recursive:true});fs.writeFileSync('dist/commands/index.html',layout('Примеры команд','commands',commandBody));
for(const file of ['style.css','app.mjs','engine.mjs'])fs.copyFileSync(file,'dist/'+file);
fs.writeFileSync('dist/favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#153b32"/><path d="m16 18 14 14-14 14m20 0h13" fill="none" stroke="#9ee5b9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
fs.writeFileSync('dist/questions.json',JSON.stringify(quizzes));fs.writeFileSync('dist/cards.json',JSON.stringify(cards));fs.writeFileSync('dist/commands.json',JSON.stringify(commands));fs.writeFileSync('dist/search.json',JSON.stringify(search));
const manifest={lessons:enriched.map(l=>({number:l.number,title:l.title,sections:l.sections.length,characters:l.markdown.length,sha256:crypto.createHash('sha256').update(l.markdown).digest('hex')})),questions:quizzes.length,cards:cards.length,commands:commands.length};
fs.writeFileSync('dist/content-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));

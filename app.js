const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const profile = document.querySelector('#profile');
const notice = document.querySelector('#notice');
const statuses = ['Da fare', 'In corso', 'Bloccata', 'Completata'];
const pages = {centrale:'Sala operativa', lavoro:'Distribuisci il lavoro', squadra:'Squadra', raci:'Matrice RACI', roadmap:'Roadmap'};
let workspace, person = '0', station = null, area = '', filter = 'all', busy = false;
let me = /^[0-4]$/.test(localStorage.getItem('tarvis-view')) ? localStorage.getItem('tarvis-view') : '0';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
const name = id => id === '' ? 'Da assegnare' : workspace.state.people[id];
const option = (value, label, current) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
const options = (current, empty) => (empty ? option('', empty, current) : '') + workspace.state.people.map((n,i) => option(String(i),n,current)).join('');
const avatar = n => `<span class="avatar" aria-hidden="true">${esc(n.trim()[0].toUpperCase())}</span>`;
const rows = tasks => tasks.length ? `<div class="list">${tasks.map(card).join('')}</div>` : '<p class="panel">Nessuna attività in questa vista.</p>';
function card(t) {
  return `<article class="task"><div><h3>${esc(t.title)}</h3><p>${esc(t.area)} · ${esc(t.due || 'Scadenza da fissare')}</p>${t.next ? `<p>${esc(t.next)}</p>` : ''}</div>
  <div class="actions"><span class="tag" data-status="${esc(t.status)}">${esc(t.status)}</span>
  <button data-assign="${t.id}">${t.owner === '' ? 'Assegna' : avatar(name(t.owner)) + esc(name(t.owner))}</button>
  <button data-edit="${t.id}" aria-label="Apri ${esc(t.title)}">Apri</button></div></article>`;
}
function stageInfo(index) {
  const tasks = workspace.state.tasks.filter(t => t.stage === index);
  return {tasks, done:tasks.filter(t => t.status === 'Completata').length};
}
function render() {
  const {tasks, people, raci, milestones} = workspace.state;
  const page = Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'centrale';
  profile.innerHTML = '<p>La tua postazione</p>' + people.map((n,i)=>`<button type="button" data-profile="${i}" aria-pressed="${String(i)===me}">${avatar(n)}<span>${esc(n)}</span>${String(i)===me?'<span aria-hidden="true">✓</span>':''}</button>`).join('');
  document.querySelector('#profile-avatar').textContent=people[Number(me)].trim().slice(0,2).toUpperCase();
  const destination = ['raci','roadmap'].includes(page)?'progetto':page==='squadra'?'centrale':page;
  for (const a of document.querySelectorAll('[data-dock]')) {
    if (a.dataset.dock === destination) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  }
  let body = '';
  if (page === 'centrale') {
    const index = milestones.findIndex((_, i) => { const s = stageInfo(i); return s.done < s.tasks.length; });
    const {done,tasks:stage} = stageInfo(index < 0 ? milestones.length-1 : index);
    const blocked = tasks.filter(t => t.status === 'Bloccata');
    body = roomView(milestones[index < 0 ? milestones.length-1 : index], done, stage.length, blocked);
  } else if (page === 'lavoro') {
    const visible = tasks.filter(t => (filter !== 'unassigned' || !t.owner) && (filter !== 'mine' || t.owner === me));
    body = `<div class="bar"><label>Mostra <select id="filter">${option('all','Tutte',filter)}${option('unassigned','Da assegnare',filter)}${option('mine','Le mie',filter)}</select></label></div>`;
    body += Object.keys(raci).map(key => {
      const matching = visible.filter(t => t.area === key);
      return matching.length ? `<section><div class="bar"><h2>${esc(key)}</h2></div>${rows(matching)}</section>` : '';
    }).join('') || rows([]);
  } else if (page === 'squadra') {
    const assigned = tasks.filter(t=>t.owner===person);
    const upcoming = assigned.filter(t=>t.status!=='Completata').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999') || a.stage-b.stage);
    const roles = Object.entries(raci).filter(([,row])=>row.roles[person] || row.backup===person);
    body = `<div class="people">${people.map((n,i)=>`<button data-person="${i}" aria-pressed="${String(i)===person}">${avatar(n)}${esc(n)}</button>`).join('')}</div>
      <section class="panel"><div class="bar"><h2>${esc(name(person))}</h2><button data-rename>Modifica nomi</button></div>
      <p>Prossimo obiettivo · ${esc(upcoming[0]?.title || 'Da definire con il gruppo')}</p><p>${assigned.length-upcoming.length} risultati completati su ${assigned.length} attività assegnate</p>
      ${roles.map(([key,row])=>`<p>${esc(key)} · ${esc([row.roles[person],row.backup===person?'Riserva':''].filter(Boolean).join(', '))}</p>`).join('')}</section>${rows([...upcoming,...assigned.filter(t=>t.status==='Completata')])}`;
  } else if (page === 'raci') {
    body = `<p class="legend">A = referente · R = esegue · C = consultato · I = informato</p><div class="panel scroll"><table><thead><tr><th scope="col">Area</th>${people.map(n=>`<th scope="col">${esc(n)}</th>`).join('')}<th scope="col">Riserva</th></tr></thead><tbody>
    ${Object.entries(raci).map(([key,row])=>`<tr><th scope="row"><button data-area="${esc(key)}">${esc(key)}</button></th>${row.roles.map((role,i)=>`<td><button data-area="${esc(key)}" aria-label="${esc(key)}: ${esc(people[i])}, ${esc(role||'da definire')}">${esc(role||'—')}</button></td>`).join('')}<td>${row.backup ? esc(name(row.backup)) : '—'}</td></tr>`).join('')}</tbody></table></div>
    ${area ? `<div class="bar"><h2>${esc(area)}</h2></div>${rows(tasks.filter(t=>t.area===area))}` : ''}`;
  } else {
    body = `<button data-export>Copia riepilogo per Notion</button>` + milestones.map((label,i)=>{
      const {tasks:stage,done}=stageInfo(i);
      return `<section class="panel milestone"><div class="bar"><h2>${esc(label)}</h2><span>${done}/${stage.length} completati</span></div><progress aria-label="${esc(label)}" value="${done}" max="${stage.length}"></progress>${rows(stage)}</section>`;
    }).join('');
  }
  if (destination==='progetto') {
    body = `<div class="project-tabs" role="group" aria-label="Viste del progetto">
      <a href="#roadmap" ${page==='roadmap'?'aria-current="page"':''}>Milestone</a>
      <a href="#raci" ${page==='raci'?'aria-current="page"':''}>Responsabilità</a>
    </div>` + body;
  }
  if (page==='centrale') body += '<p class="team-settings"><a href="#squadra">Gestisci squadra</a></p>';
  main.innerHTML = `<header><p class="eyebrow">Project work ITS</p><h1>${pages[page]}</h1><p>${page==='centrale'?'Lo stato del progetto, a colpo d’occhio.': 'TARVIS AI · Spazio di lavoro del gruppo'}</p></header>${body}`;
}
async function refresh() {
  const response = await fetch('./demo.json', {cache:'no-store'});
  if (!response.ok) throw Error('La centrale non è raggiungibile. Ricarica per riprovare.');
  const seed = await response.json();
  const latest = JSON.parse(localStorage.getItem("tarvis-pages-workspace") || "null") || seed;
  if (latest.state.people.every((name,i)=>name==="Persona "+(i+1))) latest.state.people=seed.state.people;
  if (!workspace || latest.revision > workspace.revision) {
    workspace = latest;
    render();
  }
}
function message(text) {
  notice.textContent = text;
  clearTimeout(message.timer);
  message.timer = setTimeout(()=>{notice.textContent='';},4500);
}
async function save(change) {
  if (busy) return;
  const draft = structuredClone(workspace);
  change(draft.state);
  busy = true;
  dialog.querySelectorAll('button').forEach(button=>{button.disabled=true;});
  try {
    draft.revision++;
    localStorage.setItem("tarvis-pages-workspace", JSON.stringify(draft));
    workspace = draft;
    dialog.close();
    render();
    message('Aggiornamento salvato');
  } catch (error) {
    dialog.querySelector('.error').textContent = error.message || 'Impossibile salvare. Riprova.';
  } finally {
    busy = false;
    dialog.querySelectorAll('button').forEach(button=>{button.disabled=false;});
  }
}
function open(title, content, submit, variant = "") {
  dialog.className = variant;
  dialog.innerHTML = `<div class="bar"><h2 id="dialog-title">${esc(title)}</h2><button type="button" data-close aria-label="Chiudi">×</button></div>${content}<p class="error" role="alert"></p>`;
  dialog.showModal();
  if (submit) dialog.querySelector('form').addEventListener('submit', event=>{
    event.preventDefault();
    submit(Object.fromEntries(new FormData(event.currentTarget)));
  });
}
function assignment(t) {
  const people = workspace.state.people;
  open('Assegna attività', `<p>${esc(t.title)}</p><div class="people">${people.map((n,i)=>{
    const count=workspace.state.tasks.filter(task=>task.owner===String(i) && task.status!=='Completata').length;
    return `<button data-owner="${i}">${avatar(n)}${esc(n)} · ${count} aperte</button>`;
  }).join('')}</div><button data-owner="">Lascia da assegnare</button>`);
  dialog.querySelectorAll('[data-owner]').forEach(button=>button.onclick=()=>chooseOwner(t,button.dataset.owner));
}
function edit(t, trigger) {
  open(t.title, `<div class="task-context"><span>${esc(t.area)}</span><span>${esc(name(t.owner))}</span></div>
    <div class="task-brief"><h3>Risultato atteso</h3><p>${esc(t.criterion)}</p></div>
    <form>
    <fieldset class="task-status"><legend>Stato</legend>
      ${statuses.map(status=>`<label><input type="radio" name="status" value="${esc(status)}" ${status===t.status?'checked':''}><span>${esc(status)}</span></label>`).join('')}
    </fieldset>
    <label>Scadenza<input type="date" name="due" value="${esc(t.due)}"></label>
    <label>Prossimo passo o blocco<textarea rows="2" maxlength="1500" name="next">${esc(t.next)}</textarea></label>
    <label>Risultato o link alla prova<textarea rows="2" maxlength="1500" name="evidence">${esc(t.evidence)}</textarea></label>
    <div class="task-save"><button class="primary">Salva aggiornamento</button></div></form>`, fields=>{
    if ((fields.status==='Completata' && !fields.evidence.trim()) || (fields.status==='Bloccata' && !fields.next.trim())) {
      dialog.querySelector('.error').textContent=fields.status==='Completata'?'Aggiungi il risultato o il link alla prova.':'Descrivi cosa blocca l’attività.';
      return;
    }
    save(state=>Object.assign(state.tasks[t.id-1],fields));
  }, 'task-drawer');
  dialog.querySelector('.task-save').prepend(dialog.querySelector('.error'));
  if (!trigger || reducedMotion.matches) return;
  const from=trigger.getBoundingClientRect();
  const to=dialog.getBoundingClientRect();
  if (matchMedia('(max-width:560px)').matches) {
    dialog.animate([{transform:'translateY(28px)',opacity:0},{transform:'none',opacity:1}],{duration:260,easing:'ease-out'});
    return;
  }
  dialog.animate([
    {transformOrigin:'left top',transform:`translate(${from.left-to.left}px,${from.top-to.top}px) perspective(1000px) rotateY(-76deg) scale(.7,.2)`,opacity:.45},
    {transformOrigin:'left top',transform:'translate(0,0) perspective(1000px) rotateY(0) scale(1)',opacity:1},
  ],{duration:390,easing:'cubic-bezier(.18,.76,.24,1)'});

}
function editArea(key) {
  area = key;
  render();
  const row = workspace.state.raci[key];
  open(key,`<form>${workspace.state.people.map((n,i)=>`<label>${esc(n)}<select name="role${i}">${['','A','R','C','I','A/R'].map(role=>option(role,role||'Da definire',row.roles[i])).join('')}</select></label>`).join('')}
    <label>Riserva<select name="backup">${options(row.backup,'Da definire')}</select></label><button class="primary">Salva responsabilità</button></form>`, fields=>{
    const roles=workspace.state.people.map((_,i)=>fields['role'+i]);
    const leads=roles.flatMap((role,i)=>role.startsWith('A')?[String(i)]:[]);
    if (leads.length>1 || leads.includes(fields.backup)) {
      dialog.querySelector('.error').textContent='Scegli un solo referente e una riserva diversa dal referente.';
      return;
    }
    save(state=>{state.raci[key]={roles,backup:fields.backup};});
  });
}
function exportSummary() {
  const {tasks,milestones}=workspace.state;
  const summary=['# TARVIS AI · Avanzamento',...milestones.flatMap((label,i)=>[
    '\n## '+label,
    ...tasks.filter(t=>t.stage===i).map(t=>`- ${t.title} · ${name(t.owner)} · ${t.status}${t.due?' · '+t.due:''}${t.next?'\n  Prossimo passo o blocco: '+t.next:''}${t.evidence?'\n  Evidenza: '+t.evidence:''}`)
  ])].join('\n');
  open('Riepilogo per Notion',`<form><label>Testo del riepilogo<textarea readonly rows="12">${esc(summary)}</textarea></label><button class="primary">Copia riepilogo</button></form>`,async()=>{
    try { await navigator.clipboard.writeText(summary); message('Riepilogo copiato'); }
    catch { dialog.querySelector('textarea').select(); message('Testo selezionato. Copialo con la tastiera.'); }
  });
}
main.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if (!button) return;
  const data=button.dataset;
  if ('orbitToggle' in data) {
    orbitPaused=!orbitPaused;
    button.innerHTML=orbitIcon();
    button.setAttribute('aria-label',orbitLabel());
    button.title=orbitLabel();
  }
  if ('station' in data) selectStation(station===data.station?null:data.station);
  if ('closeStation' in data) selectStation(null);
  if ('stationAssign' in data) {
    const owner=station;
    const available=workspace.state.tasks.filter(t=>!t.owner && t.status!=='Completata');
    open('Attività per '+name(owner), available.length
      ? `<div class="list">${available.map(t=>`<button data-pick="${t.id}">${esc(t.title)}</button>`).join('')}</div>`
      : '<p>Tutte le attività sono già distribuite.</p>');
    dialog.querySelectorAll('[data-pick]').forEach(choice=>choice.onclick=()=>{
      const task=workspace.state.tasks[Number(choice.dataset.pick)-1];
      chooseOwner(task,owner);
    });
  }
  if (data.take) chooseOwner(workspace.state.tasks[Number(data.take)-1],me);
  if (data.assign) assignment(workspace.state.tasks[Number(data.assign)-1]);
  if (data.edit) edit(workspace.state.tasks[Number(data.edit)-1],button);
  if (data.person) {person=data.person;render();}
  if (data.area) editArea(data.area);
  if ('rename' in data) open('Nomi della squadra',`<form>${workspace.state.people.map((n,i)=>`<label>Persona ${i+1}<input name="name${i}" value="${esc(n)}" required maxlength="40"></label>`).join('')}<button class="primary">Salva nomi</button></form>`, fields=>{
    const people=workspace.state.people.map((_,i)=>fields['name'+i].trim());
    if (people.some(n=>!n)) {dialog.querySelector('.error').textContent='Inserisci tutti e cinque i nomi.';return;}
    save(state=>{state.people=people;});
  });
  if ('export' in data) exportSummary();
});
main.addEventListener('change',event=>{if(event.target.id==='filter'){filter=event.target.value;render();}});
dialog.addEventListener('click',event=>{if(event.target.closest('[data-close]') && !busy)dialog.close();});
dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
dialog.addEventListener('close',()=>{if(!busy && !dialog.open)refresh().catch(()=>{});});
const profileTrigger=document.querySelector('#profile-trigger');
function placeProfile() {
  const anchor=profileTrigger.getBoundingClientRect();
  profile.style.top=(anchor.bottom+12)+'px';
  profile.style.left=Math.max(10,Math.min(anchor.right-profile.offsetWidth,innerWidth-profile.offsetWidth-10))+'px';
}
profile.addEventListener('toggle',()=>{if(profile.matches(':popover-open'))placeProfile();});
window.addEventListener('resize',()=>{if(profile.matches(':popover-open'))placeProfile();});
profile.addEventListener('click',event=>{
  const choice=event.target.closest('[data-profile]');
  if (!choice) return;
  me=choice.dataset.profile;
  localStorage.setItem('tarvis-view',me);
  profile.hidePopover();
  render();
  profileTrigger.focus();
});
window.addEventListener('hashchange',()=>{if(workspace)render();});
refresh().catch(error=>{main.textContent=error.message;});
setInterval(()=>{if(!dialog.open && !busy && !document.hidden)refresh().catch(()=>{});},8000);

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let orbitPaused=reducedMotion.matches, orbitTime=0, lastOrbitFrame=null, orbitDragging=false;

function orbitLabel() {
  return orbitPaused?'Riprendi orbita':'Pausa orbita';
}
function orbitIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${orbitPaused?'M7 4l9 6-9 6z':'M6 4h3v12H6z M11 4h3v12h-3z'}"/></svg>`;
}

function positionOrbit(orbit) {
  orbit.querySelectorAll('[data-station]').forEach((node,index)=>{
    const angle=-Math.PI/2+index*2*Math.PI/5+orbitTime*2*Math.PI/100000;
    const centered=node.dataset.station===station;
    node.style.left=(centered?50:50+35*Math.cos(angle))+'%';
    node.style.top=(centered?36:50+33*Math.sin(angle))+'%';
  });
}

function selectStation(next) {
  const id=next ?? station;
  const selector=`[data-station="${id}"]`;
  const before=main.querySelector(selector)?.getBoundingClientRect();
  station=next;
  render();
  positionOrbit(main.querySelector('.orbit'));
  const node=main.querySelector(selector);
  if (before && !reducedMotion.matches) {
    const after=node.getBoundingClientRect();
    node.animate([{transform:`translate(${before.x-after.x}px,${before.y-after.y}px)`},{transform:'none'}],
      {duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});
  }
  (station===null?node:main.querySelector('[data-close-station]')).focus({preventScroll:true});
}
document.addEventListener('keydown',event=>{
  if (event.key==='Escape' && station!==null && !dialog.open && !profile.matches(':popover-open') && main.querySelector('.orbit')) selectStation(null);
});

function animateOrbit(now) {
  const orbit=main.querySelector('.orbit');
  if (orbit) {
    const keyboardFocus=orbit.querySelector('[data-station]:focus-visible');
    if (lastOrbitFrame!==null && !orbitPaused && !orbitDragging && !keyboardFocus && !dialog.open) {
      orbitTime=(orbitTime+Math.min(now-lastOrbitFrame,40))%100000;
    }
    positionOrbit(orbit);
  }
  lastOrbitFrame=now;
  requestAnimationFrame(animateOrbit);
}
requestAnimationFrame(animateOrbit);
main.addEventListener('dragstart',event=>{if(event.target.closest('[data-drag]'))orbitDragging=true;});
document.addEventListener('dragend',()=>{orbitDragging=false;});

function roomView(milestone, done, total, blocked) {
  const {people, tasks} = workspace.state;
  const queue = tasks.filter(task=>!task.owner && task.status!=='Completata');
  const selected = tasks.filter(t=>t.owner===station && t.status!=='Completata');
  selected.sort((a,b)=>Number(b.status==='Bloccata')-Number(a.status==='Bloccata') ||
    (a.due||'9999').localeCompare(b.due||'9999') || a.stage-b.stage);
  return `<section class="room" aria-label="Mappa della squadra">
    <div class="room-head"><div><p>Milestone corrente</p><h2>${esc(milestone)}</h2></div>
    <a class="room-progress" href="#roadmap"><strong>${done}/${total}</strong><span>risultati completati</span><progress aria-label="Risultati completati" value="${done}" max="${total}"></progress></a></div>
    <div class="stations orbit ${station===null?'':'has-focus'}"><div class="orbit-core" ${station===null?'':'hidden'} aria-hidden="true"><b>◈</b>TARVIS</div>${people.map((n,i)=>{
      const openTasks=tasks.filter(task=>task.owner===String(i) && task.status!=='Completata');
      const block=openTasks.find(task=>task.status==='Bloccata');
      const next=block || openTasks.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999') || a.stage-b.stage)[0];
      return `<button class="station" data-station="${i}" aria-pressed="${station===String(i)}" aria-controls="station-detail">
        <span class="station-node">${avatar(n)}</span><strong>${esc(n)}</strong>
        <span class="station-state${block?' has-block':''}">${block?'Blocco aperto':openTasks.length?openTasks.length+' aperte':'Disponibile'}</span>
        <span class="station-next">${esc(next?.title || 'Pronto a prendere un’attività')}</span>
      </button>`;
    }).join('')}
    ${station===null?'':`<section id="station-detail" class="focus-card" aria-label="Postazione di ${esc(name(station))}">
      <button class="focus-close" data-close-station aria-label="Chiudi postazione">×</button>
      ${selected.length?`<div class="focus-tasks">${selected.map(t=>`<button class="focus-task" data-edit="${t.id}">
        <span><small>${esc(t.status)}</small><strong>${esc(t.title)}</strong></span><span aria-hidden="true">›</span>
      </button>`).join('')}</div>`:
      `<p>Nessuna attività aperta</p><button class="primary" data-station-assign>${station===me?'Scegli un’attività':'Assegna un’attività'}</button>`}
    </section>`}</div><button class="orbit-toggle" data-orbit-toggle aria-label="${orbitLabel()}" title="${orbitLabel()}">${orbitIcon()}</button></section>
    <section class="dispatch"><div class="bar"><div><h2>Lavoro da distribuire</h2><p>Prendi un’attività per te o trascinala su una postazione.</p></div><span class="tag">${queue.length} disponibili</span></div>
    <div class="dispatch-grid">${queue.map(t=>`<article class="dispatch-card" draggable="true" data-drag="${t.id}"><p>${esc(t.area)}</p><h3>${esc(t.title)}</h3><div class="actions"><button class="primary" data-take="${t.id}">Prendi per me</button><button data-assign="${t.id}">Assegna</button><button data-edit="${t.id}">Dettagli</button></div></article>`).join('') || '<p>Tutte le attività sono distribuite.</p>'}</div></section>
    ${blocked.length?`<section><div class="bar"><h2>Blocchi aperti</h2></div>${rows(blocked)}</section>`:''}`;
}

function chooseOwner(task, owner) {
  if (!task || task.owner===owner) return;
  const commit=()=>save(state=>{state.tasks[task.id-1].owner=owner;});
  if (!task.owner && owner===me) {
    if (!dialog.open) open('Prendi attività', `<p>${esc(task.title)}</p>`);
    commit();
    return;
  }
  if (dialog.open) dialog.close();
  open('Assegnazione concordata', `<form>
    <p>${esc(task.title)} · ${esc(name(task.owner))} → ${esc(name(owner))}</p>
    <label class="agreement"><input type="checkbox" required> Abbiamo concordato il cambio nel gruppo</label>
    <button class="primary">Conferma assegnazione</button></form>`,commit);
}

main.addEventListener('dragstart',event=>{
  const card=event.target.closest('[data-drag]');
  if (card) event.dataTransfer.setData('application/x-tarvis-task',card.dataset.drag);
});
main.addEventListener('dragover',event=>{
  const target=event.target.closest('[data-station]');
  if (target && event.dataTransfer.types.includes('application/x-tarvis-task')) {
    event.preventDefault();
    target.classList.add('drop-ready');
  }
});
main.addEventListener('dragleave',event=>{
  const target=event.target.closest('[data-station]');
  if (target && !target.contains(event.relatedTarget)) target.classList.remove('drop-ready');
});
main.addEventListener('drop',event=>{
  const target=event.target.closest('[data-station]');
  if (!target) return;
  target.classList.remove('drop-ready');
  const id=event.dataTransfer.getData('application/x-tarvis-task');
  if (!id) return;
  event.preventDefault();
  const task=workspace.state.tasks[Number(id)-1];
  if (task && !task.owner) chooseOwner(task,target.dataset.station);
});

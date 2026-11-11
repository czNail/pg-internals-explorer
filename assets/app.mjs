import {mapSizes,modules,nestedObjects,actors,positions,routes,workloads,overviewState} from './overview.mjs?rev=semantic-v1';
import {mapNodes,inspectionInfo} from './overview-ui.mjs?rev=semantic-v1';
import {labs,labState} from './labs.mjs?rev=memory-lab';
import {labArt,moduleArt} from './module-art.mjs?rev=memory-lab';
import {memoryLabs} from './memory.mjs';
import {mountMemoryScene} from './memory-view.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));
const labTones = {'shared-memory':'sql',buffers:'page',wal:'wal',mvcc:'sql',hot:'page',vacuum:'io'};
const labEntries = Object.entries(labs).filter(([, lab]) => !lab.module);
const flowKinds = ['request','response','access','page','wal'];
const paces = {wide:160,compact:95};
const speedInput = $('speed');

function svg(tag,attributes) {
  const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [name,value] of Object.entries(attributes)) element.setAttribute(name,value);
  return element;
}

function markCurrent(element,current,value='true') {
  if (current) element.setAttribute('aria-current',value);
  else element.removeAttribute('aria-current');
}

const motion=matchMedia('(prefers-reduced-motion: reduce)');
const compactMap=matchMedia('(max-width: 640px)');
let workload=workloads.mixed;
let eventIndex=0;
let selectedModule='buffers';
let running=!motion.matches;
let stepping=false;
let overviewVisible=false;
let elapsed=0;
let eventDuration=0;
let previousTime=0;
let animationFrame=0;
let mapMode;
let stateApplied=false;
let displayedState;
let transfers=[];
let retiring=[];
let labKey=null;
let labIndex=0;
let labTimer=0;
let renderMemoryScene=null;
const paths={};
const pathLengths={};
const nodeElements={};
const captions={};
const captionPositions={
  sqlRequest:{wide:[184,145],compact:[124,115]},
  sqlResponse:{wide:[183,254],compact:[116,253]},
  bufferAccess:{wide:[487,106],compact:[153,300]},
  tupleRead:{wide:[499,222],compact:[266,307]},
  pageRead:{wide:[830,87],compact:[251,350]},
  pageWrite:{wide:[831,207],compact:[252,473]},
  walInsert:{wide:[475,323],compact:[54,563]},
  walFlush:{wide:[831,364],compact:[251,742]}
};

function layoutMap() {
  mapMode=compactMap.matches?'compact':'wide';
  const [width,height]=mapSizes[mapMode];
  $('stage').style.aspectRatio=width+'/'+height;
  for (const layer of [$('edges'),$('tokens')]) layer.setAttribute('viewBox',`0 0 ${width} ${height}`);
  for (const [id,node] of Object.entries(nodeElements)) {
    const [x,y,w,h]=positions[id][mapMode];
    Object.assign(node.style,{left:x/width*100+'%',top:y/height*100+'%',width:w/width*100+'%',height:h/height*100+'%'});
  }
  for (const [id,route] of Object.entries(routes)) {
    paths[id].setAttribute('d',route[mapMode]);
    pathLengths[id]=paths[id].getTotalLength();
    if (captions[id]) {
      const [x,y]=captionPositions[id][mapMode];
      captions[id].style.left=x/width*100+'%';
      captions[id].style.top=y/height*100+'%';
    }
  }
  for (const transfer of [...transfers,...retiring]) {
    transfer.duration=travelTime(transfer.flow);
    paintTransfer(transfer,transfer.progress,transfer.opacity);
  }
  if (transfers.length) {
    const progress=eventDuration?elapsed/eventDuration:0;
    eventDuration=durationForEvent(workload.steps[eventIndex]);
    elapsed=eventDuration*progress;
  }
}

function setupOverview() {
  $('nodes').innerHTML=mapNodes();
  for (const node of $('nodes').querySelectorAll('[data-node]')) nodeElements[node.dataset.node]=node;
  $('edges').innerHTML=`<defs>${flowKinds.map(kind=>`
    <marker id="arrow-${kind}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
      <path class="${kind} marker-tip" d="M1.5 1.5 7 4.5 1.5 7.5"/>
    </marker>`).join('')}</defs>`;
  for (const [id,route] of Object.entries(routes)) {
    paths[id]=svg('path',{'data-route':id,class:`route ${route.kind}${route.optional?' optional':''}`,'marker-end':`url(#arrow-${route.kind})`});
    $('edges').append(paths[id]);
    if (captionPositions[id]) {
      captions[id]=document.createElement('span');
      captions[id].className='route-caption '+route.kind;
      captions[id].textContent=route.label;
      $('stage').append(captions[id]);
    }
  }
  layoutMap();
  compactMap.addEventListener('change',layoutMap);
  $('workloads').innerHTML=Object.entries(workloads).map(([id,option])=>
    `<button type="button" data-workload="${id}" aria-pressed="${option===workload}">${option.label}</button>`).join('');
  $('lab-cards').innerHTML=labEntries.map(([id,lab])=>
    `<a class="lab-card art-${labTones[id]}" href="#${id}"><span class="card-icon">${moduleArt(labArt[id])}</span><span><strong>${lab.label}</strong><small>${lab.subtitle}</small></span><span class="card-arrow" aria-hidden="true">↗</span></a>`).join('');
  $('lab-nav').innerHTML=labEntries.map(([id,lab])=>`<a href="#${id}">${lab.label}</a>`).join('');
}

function updateInspection(state) {
  const info=inspectionInfo(selectedModule);
  if ($('inspection').dataset.module!==selectedModule) {
    $('inspection').dataset.module=selectedModule;
    $('inspection').innerHTML=`<div class="inspection-heading"><span class="inspection-figure art-${info.tone}">${moduleArt(info.art)}</span><h3>${info.name}</h3></div>
      <p>${info.role}</p><span class="inspection-status"></span><a class="inspection-link" href="#${info.lab}">查看${labs[info.lab].label}演示 ↗</a>`;
  }
  const value=selectedModule==='page'?state.heap:actors[selectedModule]?.module==='background'
    ?state.workers[selectedModule]:selectedModule==='index'?'堆页与索引页共用缓冲区':state[selectedModule];
  $('inspection').querySelector('.inspection-status').textContent=value;
  for (const [id,node] of Object.entries(nodeElements)) {
    node.classList.toggle('selected',id===(nestedObjects[selectedModule]?.parent??actors[selectedModule]?.module??selectedModule));
  }
  for (const button of $('nodes').querySelectorAll('[data-inspect]')) button.setAttribute('aria-pressed',String(button.dataset.inspect===selectedModule));
}

function renderState(index) {
  displayedState=overviewState(workload,index);
  const state=displayedState;
  for (const field of $('nodes').querySelectorAll('[data-status]')) field.textContent=state[field.dataset.status];
  for (const phase of $('nodes').querySelectorAll('[data-phase]')) phase.classList.toggle('phase-active',phase.dataset.phase===state.phase);
  $('frame-bits').textContent=state.loaded?`pin ${state.pin} · ${state.dirty?'Dirty':'Clean'}`:'空闲';
  $('page-identity').textContent=state.loaded?'P8 · Heap Page':'等待读入 P8';
  $('page-value').textContent=state.loaded?`balance ${state.pageValue}`:'accounts/main/8';
  $('page-lsn').textContent=state.loaded?'LSN '+state.pageLsn:'';
  $('page-object').classList.toggle('loaded',state.loaded);
  $('page-object').classList.toggle('dirty',state.dirty);
  $('disk-title').textContent='P8 · balance '+state.diskValue;
  $('disk-state').textContent=`written ${state.diskWritten} · durable ${state.diskDurable}`;
  $('wal-lsn').textContent=`inserted ${state.inserted} · flushed ${state.flushed}`;
  const records=state.walRecords.map(([id,type,lsn])=>`<span title="${type} · 结束 LSN ${lsn}">${id} · ${type==='COMMIT'?'COMMIT':'UPDATE'}</span>`).join('')||'<span class="empty-record">等待 WAL 记录</span>';
  if ($('wal-records').innerHTML!==records) $('wal-records').innerHTML=records;
  for (const worker of $('nodes').querySelectorAll('[data-worker-status]')) worker.textContent=state.workers[worker.dataset.workerStatus];
  updateInspection(state);
}

function renderProgress() {
  if ($('run-progress').childElementCount!==workload.steps.length) {
    $('run-progress').replaceChildren(...workload.steps.map((event,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.dataset.event=index;
      return button;
    }));
  }
  for (const [index,button] of Array.from($('run-progress').children).entries()) {
    const title=`${index+1}. ${workload.steps[index].title}`;
    button.title=title;
    button.setAttribute('aria-label',title);
    button.classList.toggle('past',index<eventIndex);
    markCurrent(button,index===eventIndex,'step');
  }
}

function renderEvent() {
  const event=workload.steps[eventIndex];
  const routeIds=new Set(event.flows.map(flow=>flow.route));
  for (const [id,path] of Object.entries(paths)) path.classList.toggle('active',routeIds.has(id));
  for (const [id,node] of Object.entries(nodeElements)) {
    node.classList.toggle('active',event.targets.includes(id));
    node.classList.toggle('local-change',!event.flows.length&&event.targets.includes(id));
  }
  for (const button of $('nodes').querySelectorAll('[data-actor]')) button.classList.toggle('actor-active',button.dataset.actor===event.actor);
  for (const item of $('nodes').querySelectorAll('[data-inspect]')) item.classList.toggle('object-focus',item.dataset.inspect===event.focus);
  $('run-counter').textContent=`${String(eventIndex+1).padStart(2,'0')} / ${String(workload.steps.length).padStart(2,'0')}`;
  $('run-title').textContent=event.title;
  $('run-actor').textContent='执行者 · '+actors[event.actor].name;
  $('run-event').innerHTML=`<p>${event.description}</p><div class="event-flow"><span class="actor-tag">执行者 · ${actors[event.actor].name}</span><span class="action-tag">${event.action}</span></div>`;
  renderProgress();
  renderState(eventIndex-1);
}

function travelTime(flow) {
  return Math.max(650,pathLengths[flow.route]/paces[mapMode]*1000);
}

function durationForEvent(event) {
  return event.flows.length?Math.max(...event.flows.map(flow=>flow.delay+travelTime(flow))):1050;
}

function createTransfer(flow) {
  const kind=routes[flow.route].kind;
  const width=Math.max(65,27+flow.label.length*6.3);
  const element=svg('g',{class:'flow-token '+kind,'data-object-id':flow.id,opacity:0});
  element.append(svg('rect',{x:-width/2,y:-11,width,height:22,rx:kind==='page'?4:11}));
  element.append(svg(kind==='page'?'rect':'circle',kind==='page'?{x:8-width/2,y:-3,width:6,height:6,rx:1}:{cx:11-width/2,cy:0,r:3}));
  const text=svg('text',{x:6,y:0});
  text.textContent=flow.label;
  element.append(text);
  $('tokens').append(element);
  return {flow,element,duration:travelTime(flow),progress:0,opacity:0,retiredFor:0};
}

function paintTransfer(transfer,progress,opacity) {
  transfer.progress=progress;
  transfer.opacity=opacity;
  const point=paths[transfer.flow.route].getPointAtLength(pathLengths[transfer.flow.route]*progress);
  transfer.element.setAttribute('transform',`translate(${point.x} ${point.y})`);
  transfer.element.setAttribute('opacity',opacity);
}

function paintFrame(delta=0) {
  for (const transfer of transfers) {
    const time=elapsed-transfer.flow.delay;
    const progress=motion.matches ? .5 : Math.max(0,Math.min(1,time/transfer.duration));
    const opacity=motion.matches?1:Math.max(0,Math.min(1,time/160));
    paintTransfer(transfer,progress,opacity);
  }
  for (const transfer of retiring) {
    transfer.retiredFor+=delta;
    paintTransfer(transfer,transfer.progress,transfer.retiredOpacity*Math.max(0,1-transfer.retiredFor/220));
    if (transfer.retiredFor>=220||motion.matches) transfer.element.remove();
  }
  retiring=retiring.filter(transfer=>transfer.element.isConnected);
  const event=workload.steps[eventIndex];
  if (!stateApplied&&(motion.matches||elapsed>=eventDuration*(event.flows.length?1:.5))) {
    stateApplied=true;
    renderState(eventIndex);
  }
}

function selectEvent(index) {
  eventIndex=(index+workload.steps.length)%workload.steps.length;
  for (const transfer of transfers) {
    if (transfer.opacity>0) {
      transfer.retiredOpacity=transfer.opacity;
      retiring.push(transfer);
    }
    else transfer.element.remove();
  }
  elapsed=0;
  stateApplied=false;
  const event=workload.steps[eventIndex];
  transfers=event.flows.map(createTransfer);
  eventDuration=durationForEvent(event);
  stepping=!running&&!motion.matches;
  renderEvent();
  paintFrame();
}

function animate(time) {
  animationFrame=0;
  if (!(running||stepping)||!overviewVisible||document.hidden) return;
  const delta=previousTime?Math.min(250,time-previousTime)*speedInput.valueAsNumber:0;
  previousTime=time;
  elapsed+=delta;
  paintFrame(delta);
  if (elapsed>=eventDuration) {
    if (running) selectEvent(eventIndex+1);
    else {
      stepping=false;
      updateOverviewControls();
    }
  }
  if (running||stepping) animationFrame=requestAnimationFrame(animate);
}

function updateOverviewControls() {
  $('play-state').textContent=running?'播放中':stepping?'单步中':'已暂停';
  $('live-state').classList.toggle('running',running||stepping);
  $('run-toggle').textContent=running?'Ⅱ 暂停':'▶ 播放';
  $('stage').classList.toggle('motion-paused',!(running||stepping));
}

function syncOverview() {
  updateOverviewControls();
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame=0;
  previousTime=0;
  if ((running||stepping)&&overviewVisible&&!document.hidden) animationFrame=requestAnimationFrame(animate);
}

function updatePlaybackSpeed() {
  const rate = speedInput.valueAsNumber;
  const min = Number(speedInput.min);
  const max = Number(speedInput.max);
  const progress = (rate - min) / (max - min);
  speedInput.style.setProperty('--speed-fill', `${progress * 100}%`);
  speedInput.setAttribute('aria-valuetext', `${rate} 倍`);
  $('speed-value').value = `${rate}×`;
  $('stage').style.setProperty('--playback-rate', rate);
}

function modelCard(title, values, className = '') {
  return `<section class="model-card ${className}"><h3>${escape(title)}</h3><dl>${values.map(([label, value]) =>
    `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>`;
}

function modelGrid(...cards) {
  return `<div class="model-grid">${cards.join('')}</div>`;
}

function chips(values) {
  return `<div class="model-strip">${values.map(([value, variant = '']) =>
    `<span class="model-chip ${variant}">${escape(value)}</span>`).join('')}</div>`;
}

function table(label, headings, rows, variant = () => '') {
  return `<p class="model-label-row">${escape(label)}</p><div class="table-wrap" role="region" aria-label="${escape(label)}" tabindex="0"><table class="model-table">
    <thead><tr>${headings.map(heading => `<th scope="col">${escape(heading)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row, index) => `<tr class="${variant(row, index)}">${row.map((value, cell) =>
      cell === 0 ? `<th scope="row">${escape(value)}</th>` : `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

const models = {
  buffers(state) {
    return chips([[`请求页 ${state.target}`], [`时钟指针 → ${state.hand}`, 'highlight'], [state.note]]) +
      modelGrid(...state.frames.map(([block, pin, usage, dirty], i) => {
        const frame = `F${i + 1}`;
        const variant = state.focus.includes(frame) ? 'highlight' : dirty ? 'warning' : '';
        return modelCard(`Frame ${frame}`, [['Tag', `accounts/main/${block}`], ['Pin count', pin], ['Usage count', usage], ['Dirty', dirty ? 'yes' : 'no']], variant);
      })) + table('Buffer Mapping', ['页标识', '缓冲帧'], state.frames.map(([block], i) => [`accounts/main/${block}`, `F${i + 1}`]));
  },
  wal(state) {
    const highlight = id => state.focus.includes(id) ? 'highlight' : '';
    return modelGrid(
      modelCard('WAL', [['Inserted LSN', state.inserted], ['Flushed LSN', state.flushed]], highlight('wal')),
      modelCard('Shared Buffers', [['Page LSN', state.buffer], ['Dirty', state.dirty ? 'yes' : 'no']], highlight('buffer')),
      modelCard('关系文件', [['Written LSN', state.written], ['Durable LSN', state.durable]], highlight('file')),
      modelCard('事务', [['状态', state.tx]], highlight('tx'))
    ) + table('本次 WAL 记录', ['类型', '结束 LSN', '持久化状态'], state.records.length ? state.records.map(([type, lsn]) =>
      [type, lsn, parseInt(lsn.split('/')[1], 16) <= parseInt(state.flushed.split('/')[1], 16) ? '已持久化' : '待刷写']) : [['—', '—', '无新增记录']]);
  },
  mvcc(state) {
    const highlight = id => state.focus.includes(id) ? 'highlight' : '';
    return modelGrid(
      modelCard('A · 老快照', [['查询结果', state.older]], highlight('older')),
      modelCard('B · 更新者', [['事务状态', state.writer]], highlight('writer')),
      modelCard('C · 新读者', [['查询结果', state.newer]], highlight('newer'))
    ) + table('Heap Page · accounts / Block 8', ['TID', 'xmin', 'xmax', 'balance'], state.rows);
  },
  hot(state) {
    return chips([[state.index, state.focus.includes('index') ? 'highlight' : ''],
      [state.chain, state.focus.includes('page') ? 'highlight' : ''], [`老读者 · ${state.oldReader}`, state.focus.includes('reader') ? 'warning' : '']]) +
      table('Heap Page · 行指针和元组', ['行指针', '状态', '内容', 't_ctid'], state.rows, row => row[1] === 'REDIRECT' ? 'highlight' : '');
  },
  vacuum(state) {
    const highlight = id => state.focus.includes(id) ? 'highlight' : '';
    return modelGrid(modelCard('读者 A', [['快照', state.reader]], highlight('reader')),
      modelCard('Heap Page', [['行指针', state.heap], ['空间', state.space]], highlight('heap')),
      modelCard('B-tree 索引', [['索引项', state.index]], highlight('index')));
  }
};

function syncLabPlay() {
  $('lab-play').textContent = labTimer ? 'Ⅱ 暂停' : '▶ 自动播放';
}

function stopLab() {
  if (labTimer) clearInterval(labTimer);
  labTimer = 0;
  syncLabPlay();
}

function renderLabStep() {
  const lab = labs[labKey];
  const event = lab.steps[labIndex];
  const state = labState(lab, labIndex);
  if (renderMemoryScene) renderMemoryScene(state);
  else $('lab-model').innerHTML = models[labKey](state);
  $('lab-explanation').innerHTML = `<h3>${event.title}</h3><p>${event.detail}</p>`;
  $('lab-counter').textContent = `${labIndex + 1} / ${lab.steps.length}`;
  $('lab-prev').disabled = labIndex === 0;
  $('lab-next').disabled = labIndex === lab.steps.length - 1;
  $('lab-next').textContent = `${lab.steps[labIndex + 1]?.action ?? '下一步'} →`;
  for (const button of $('lab-steps').querySelectorAll('button')) {
    markCurrent(button, Number(button.dataset.step) === labIndex, 'step');
  }
}

function openLab(key) {
  const lab = labs[key];
  const moduleKey = lab.module ?? key;
  const isMemoryScene = Object.hasOwn(memoryLabs, key);
  labKey = key;
  labIndex = 0;
  $('lab-kicker').textContent = isMemoryScene ? lab.label :
    `MODULE LABS / ${String(labEntries.findIndex(([id]) => id === moduleKey) + 1).padStart(2, '0')}`;
  $('lab-title').textContent = lab.title;
  $('lab-figure').className = `lab-figure art-${labTones[moduleKey]}`;
  $('lab-figure').innerHTML = moduleArt(labArt[moduleKey]);
  $('lab-summary').textContent = lab.summary;
  $('model-title').textContent = lab.view;
  $('lab-context').textContent = lab.context;
  $('lab-legend').textContent = lab.legend;
  $('lab-source').href = lab.source;
  $('lab-steps').innerHTML = lab.steps.map((event, index) =>
    `<li><button type="button" data-step="${index}"><span>${String(index + 1).padStart(2, '0')}</span>${event.title}</button></li>`).join('');
  for (const link of $('lab-nav').children) markCurrent(link, link.hash === `#${moduleKey}`, 'page');
  $('labs').classList.toggle('memory-lab', isMemoryScene);
  $('lab-scenarios').hidden = !isMemoryScene;
  if (isMemoryScene) {
    $('lab-scenarios').innerHTML = Object.entries(memoryLabs).map(([id, scene]) =>
      `<a href="#${id}"${id === key ? ' aria-current="page"' : ''}>${scene.scene}</a>`).join('');
  }
  renderMemoryScene = isMemoryScene ? mountMemoryScene($('lab-model'), key) : null;
  renderLabStep();
}

function renderLocation(focusHeading = false) {
  const key = location.hash.slice(1);
  if (key === 'main' && (overviewVisible || labKey)) return;
  const showLab = Object.hasOwn(labs, key);
  stopLab();
  overviewVisible = !showLab;
  $('overview').hidden = showLab;
  $('labs').hidden = !showLab;
  markCurrent($('nav-overview'), !showLab, 'page');
  markCurrent($('nav-labs'), showLab, 'page');
  if (showLab) {
    openLab(key);
    $('nav-labs').href = `#${key}`;
  }
  syncOverview();
  if (focusHeading) {
    $(showLab ? 'lab-title' : 'overview-title').focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
}

setupOverview();
updatePlaybackSpeed();
selectEvent(0);
renderLocation();

speedInput.addEventListener('input', updatePlaybackSpeed);
$('workloads').addEventListener('click', event => {
  const button = event.target.closest('[data-workload]');
  if (!button || workloads[button.dataset.workload] === workload) return;
  workload = workloads[button.dataset.workload];
  for (const option of $('workloads').children) option.setAttribute('aria-pressed', String(option === button));
  selectEvent(0);
  syncOverview();
});
$('run-toggle').addEventListener('click', () => {
  running = !running;
  stepping = false;
  syncOverview();
});
$('run-next').addEventListener('click', () => { running = false; selectEvent(eventIndex + 1); syncOverview(); });
$('run-progress').addEventListener('click', event => {
  const button = event.target.closest('[data-event]');
  if (!button) return;
  running = false;
  selectEvent(Number(button.dataset.event));
  syncOverview();
});
$('nodes').addEventListener('click', event => {
  const button = event.target.closest('[data-inspect]');
  if (!button) return;
  selectedModule = button.dataset.inspect;
  updateInspection(displayedState);
  $('inspection').scrollIntoView({block:'nearest', behavior:motion.matches ? 'instant' : 'smooth'});
});

function goToLabStep(index) {
  stopLab();
  labIndex = Math.max(0, Math.min(index, labs[labKey].steps.length - 1));
  renderLabStep();
}
$('lab-reset').addEventListener('click', () => goToLabStep(0));
$('lab-prev').addEventListener('click', () => goToLabStep(labIndex - 1));
$('lab-next').addEventListener('click', () => goToLabStep(labIndex + 1));
$('lab-steps').addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (button) goToLabStep(Number(button.dataset.step));
});
$('lab-play').addEventListener('click', () => {
  if (labTimer) return stopLab();
  const lastStep = labs[labKey].steps.length - 1;
  if (labIndex === lastStep) {
    labIndex = 0;
    renderLabStep();
  }
  labTimer = setInterval(() => {
    if (document.hidden) return;
    labIndex++;
    renderLabStep();
    if (labIndex === lastStep) stopLab();
  }, renderMemoryScene ? 3200 : 2000);
  syncLabPlay();
});
window.addEventListener('hashchange', () => renderLocation(true));
document.addEventListener('visibilitychange', syncOverview);
motion.addEventListener('change', event => {
  if (event.matches) {
    running = false;
    stepping = false;
  }
  paintFrame();
  syncOverview();
});

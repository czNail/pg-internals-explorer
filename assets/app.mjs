import {modules, routes, workloads, overviewState} from './overview.mjs';
import {labs, labState} from './labs.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

const icons = {
  terminal:'<path d="m4 6 5 6-5 6m9 0h7"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',
  page:'<path d="M5 3h9l5 5v13H5zM14 3v5h5M8 12h8m-8 4h8"/>',
  disk:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14a8 3 0 0 0 16 0V5M4 12a8 3 0 0 0 16 0"/>',
  log:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

function svg(tag, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function markCurrent(element, current, value = 'true') {
  if (current) element.setAttribute('aria-current', value);
  else element.removeAttribute('aria-current');
}

const motion = matchMedia('(prefers-reduced-motion: reduce)');
let workload = workloads.mixed;
let eventIndex = 0;
let selectedModule = 'buffers';
let running = !motion.matches;
let overviewVisible = false;
let elapsed = 0;
let previousTime = 0;
let animationFrame = 0;
let activeToken = null;
let activeRoute = null;
let labKey = null;
let labIndex = 0;
let labTimer = 0;
const paths = {};
const pathLengths = {};
const nodeElements = {};

function setupOverview() {
  $('nodes').innerHTML = Object.entries(modules).map(([id, module]) =>
    `<button class="node" type="button" data-module="${id}" aria-controls="inspection" style="left:${module.x/8.2}%;top:${module.y/4.36}%;width:${215/8.2}%;height:${68/4.36}%;--node-color:var(--${module.color ?? 'sql'})">
      <span class="node-title">${icon(module.icon)}${module.name}</span><span class="node-status"></span></button>`
  ).join('');
  for (const button of $('nodes').querySelectorAll('button')) nodeElements[button.dataset.module] = button;
  $('edges').innerHTML = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L6 4 L1 7" fill="none" stroke="#81a292" stroke-width="1.25"/></marker></defs>`;
  for (const [id, route] of Object.entries(routes)) {
    const path = svg('path', {class:'route', d:route.path, 'marker-end':'url(#arrow)'});
    $('edges').append(path);
    paths[id] = path;
    pathLengths[id] = path.getTotalLength();
  }
  $('workloads').innerHTML = Object.entries(workloads).map(([id, option]) =>
    `<button type="button" data-workload="${id}" aria-pressed="${option === workload}">${option.label}</button>`).join('');
  $('lab-cards').innerHTML = Object.entries(labs).map(([id, lab]) =>
    `<a class="lab-card" href="#${id}"><span class="card-icon">${icon(lab.icon)}</span><span><strong>${lab.label}</strong><small>${lab.subtitle}</small></span><span class="card-arrow" aria-hidden="true">↗</span></a>`).join('');
  $('lab-nav').innerHTML = Object.entries(labs).map(([id, lab]) => `<a href="#${id}">${lab.label}</a>`).join('');
}

function updateInspection(state) {
  const module = modules[selectedModule];
  if ($('inspection').dataset.module !== selectedModule) {
    $('inspection').dataset.module = selectedModule;
    $('inspection').innerHTML = `<h3>${module.name}</h3><p>${module.role}</p>
    <span class="inspection-status"></span>
    <a class="inspection-link" href="#${module.lab}">查看${labs[module.lab].label}演示 <span aria-hidden="true">↗</span></a>`;
  }
  $('inspection').querySelector('.inspection-status').textContent = state[selectedModule];
}

function renderProgress() {
  if ($('run-progress').childElementCount !== workload.steps.length) {
    $('run-progress').replaceChildren(...workload.steps.map((event, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.event = index;
      return button;
    }));
  }
  for (const [index, button] of Array.from($('run-progress').children).entries()) {
    const title = `${index + 1}. ${workload.steps[index].title}`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.classList.toggle('past', index < eventIndex);
    markCurrent(button, index === eventIndex, 'step');
  }
}

function renderEvent() {
  const event = workload.steps[eventIndex];
  const state = overviewState(workload, eventIndex);
  const route = routes[event.via];
  if (activeRoute) paths[activeRoute].setAttribute('class', 'route');
  activeRoute = event.via;
  paths[activeRoute].setAttribute('class', `route active ${event.kind}`);
  for (const [id, button] of Object.entries(nodeElements)) {
    button.querySelector('.node-status').textContent = state[id];
    button.classList.remove('sql', 'page', 'wal', 'io');
    button.classList.add(event.kind);
    button.classList.toggle('active', id === route.from || id === route.to || event.targets.includes(id));
    button.classList.toggle('selected', id === selectedModule);
    button.setAttribute('aria-pressed', String(id === selectedModule));
  }
  $('run-counter').textContent = `${String(eventIndex + 1).padStart(2, '0')} / ${String(workload.steps.length).padStart(2, '0')}`;
  $('run-event').innerHTML = `<h3>${event.title}</h3><p>${event.description}</p><span class="event-object">${escape(event.object)}</span>`;
  renderProgress();
  updateInspection(state);

  const width = Math.max(53, 14 + event.object.length * 6.3);
  const rect = svg('rect', {x:-width/2, y:-10, width, height:20, rx:6});
  const label = svg('text', {x:0, y:0});
  label.textContent = event.object;
  activeToken = svg('g', {class:`flow-token ${event.kind}`});
  activeToken.append(rect, label);
  $('tokens').replaceChildren(activeToken);
  positionToken(running && !motion.matches ? 0 : .5);
}

function positionToken(fraction) {
  const point = paths[activeRoute].getPointAtLength(pathLengths[activeRoute] * fraction);
  activeToken.setAttribute('transform', `translate(${point.x} ${point.y})`);
}

function selectEvent(index) {
  eventIndex = (index + workload.steps.length) % workload.steps.length;
  elapsed = 0;
  renderEvent();
}

function animate(time) {
  animationFrame = 0;
  if (!running || !overviewVisible || document.hidden) return;
  if (previousTime) elapsed += Math.min(time - previousTime, 80) * Number($('speed').value);
  previousTime = time;
  if (elapsed >= 2700) selectEvent(eventIndex + 1);
  positionToken(motion.matches ? .5 : Math.min(elapsed / 2060, 1));
  animationFrame = requestAnimationFrame(animate);
}

function syncOverview() {
  $('play-state').textContent = running ? '播放中' : '已暂停';
  $('live-state').classList.toggle('running', running);
  $('run-toggle').textContent = running ? 'Ⅱ 暂停' : '▶ 播放';
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  previousTime = 0;
  if (running && overviewVisible && !document.hidden) animationFrame = requestAnimationFrame(animate);
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
  $('lab-model').innerHTML = models[labKey](labState(lab, labIndex));
  $('lab-explanation').innerHTML = `<h3>${event.title}</h3><p>${event.detail}</p>`;
  $('lab-counter').textContent = `${labIndex + 1} / ${lab.steps.length}`;
  $('lab-prev').disabled = labIndex === 0;
  $('lab-next').disabled = labIndex === lab.steps.length - 1;
  for (const button of $('lab-steps').querySelectorAll('button')) {
    markCurrent(button, Number(button.dataset.step) === labIndex, 'step');
  }
}

function openLab(key) {
  const lab = labs[key];
  labKey = key;
  labIndex = 0;
  $('lab-kicker').textContent = `MODULE LABS / ${String(Object.keys(labs).indexOf(key) + 1).padStart(2, '0')}`;
  $('lab-title').textContent = lab.title;
  $('lab-summary').textContent = lab.summary;
  $('model-title').textContent = lab.view;
  $('lab-context').textContent = lab.context;
  $('lab-legend').textContent = lab.legend;
  $('lab-source').href = lab.source;
  $('lab-steps').innerHTML = lab.steps.map((event, index) =>
    `<li><button type="button" data-step="${index}"><span>${String(index + 1).padStart(2, '0')}</span>${event.title}</button></li>`).join('');
  for (const link of $('lab-nav').children) markCurrent(link, link.hash === `#${key}`, 'page');
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
renderEvent();
renderLocation();

$('workloads').addEventListener('click', event => {
  const button = event.target.closest('[data-workload]');
  if (!button || workloads[button.dataset.workload] === workload) return;
  workload = workloads[button.dataset.workload];
  for (const option of $('workloads').children) option.setAttribute('aria-pressed', String(option === button));
  selectEvent(0);
});
$('run-toggle').addEventListener('click', () => { running = !running; syncOverview(); });
$('run-next').addEventListener('click', () => { running = false; selectEvent(eventIndex + 1); syncOverview(); });
$('run-progress').addEventListener('click', event => {
  const button = event.target.closest('[data-event]');
  if (!button) return;
  running = false;
  selectEvent(Number(button.dataset.event));
  syncOverview();
});
$('nodes').addEventListener('click', event => {
  const button = event.target.closest('[data-module]');
  if (!button) return;
  selectedModule = button.dataset.module;
  for (const node of Object.values(nodeElements)) {
    node.classList.toggle('selected', node === button);
    node.setAttribute('aria-pressed', String(node === button));
  }
  updateInspection(overviewState(workload, eventIndex));
  if (matchMedia('(max-width: 760px)').matches) $('inspection').scrollIntoView({block:'nearest'});
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
  }, 2000);
  syncLabPlay();
});
window.addEventListener('hashchange', () => renderLocation(true));
document.addEventListener('visibilitychange', syncOverview);
motion.addEventListener('change', event => {
  if (!event.matches) return;
  running = false;
  if (activeToken) positionToken(.5);
  syncOverview();
});

const value = field => `<span data-memory-field="${field}"></span>`;
const slots = count => `<span class="memory-slots" aria-hidden="true">${'<i></i>'.repeat(count)}</span>`;

const process = (id, name) => `
  <div class="memory-process">
    <span class="memory-process-icon" aria-hidden="true"></span>
    <strong>${name}</strong>
    ${value(id)}
  </div>`;

const restartMarkup = `
  <div class="memory-restart">
    <div class="memory-config-grid">
      <section class="memory-card" data-memory-box="config">
        <h3>配置文件 <code>postgresql.conf</code></h3>
        <dl><div><dt>max_connections</dt><dd>${value('configured')}</dd></div></dl>
      </section>
      <section class="memory-card" data-memory-box="settings">
        <h3>生效参数 <code>pg_settings</code></h3>
        <dl>
          <div><dt>setting</dt><dd>${value('setting')}</dd></div>
          <div><dt>pending_restart</dt><dd>${value('pending')}</dd></div>
        </dl>
      </section>
    </div>
    <div class="memory-instance" data-memory-box="sessions">
      <div class="memory-row-heading"><strong>实例与会话</strong>${value('instance')}</div>
      <div class="memory-processes">
        ${process('session-a', value('session-name-a'))}
        ${process('session-b', value('session-name-b'))}
      </div>
    </div>
    <section class="memory-card memory-bank" data-memory-box="layout">
      <div class="memory-row-heading"><h3>主共享内存</h3>${value('layout')}</div>
      <div class="memory-structures">
        <span><b>PGPROC</b><small>进程槽位</small></span>
        <span><b>ProcArray</b><small>活跃进程登记</small></span>
        <span><b>锁管理</b><small>共享锁状态</small></span>
      </div>
      ${slots(12)}
    </section>
  </div>`;

const dsmProcesses = [['leader', 'Leader'], ['worker-a', 'Worker A'], ['worker-b', 'Worker B']];
const dsmMarkup = `
  <div class="memory-dsm">
    <div class="memory-processes">
      ${dsmProcesses.map(([id, name]) => `<div class="memory-port" data-memory-box="${id}">
        ${process(id, name)}
        <div class="memory-wire" aria-hidden="true"><i></i></div>
      </div>`).join('')}
    </div>
    <section class="memory-card memory-segment" data-memory-box="segment">
      <div class="memory-row-heading"><h3>DSM 共享段</h3>${value('segment')}</div>
      <div class="memory-segment-info">
        <span>Handle ${value('handle')}</span><span>活跃映射 ${value('count')}</span>
      </div>
      ${slots(12)}
    </section>
  </div>`;

const onlineMarkup = `
  <div class="memory-online">
    <div class="memory-processes">
      <div data-memory-box="a">${process('backend-a', 'Backend A')}</div>
      <div data-memory-box="b">${process('backend-b', 'Backend B')}</div>
    </div>
    <svg class="memory-cross-links" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      <path data-memory-box="a-old" d="M25 0V20"/>
      <path data-memory-box="a-new" d="M25 0C25 10 75 10 75 20"/>
      <path data-memory-box="b-old" d="M75 0C75 10 25 10 25 20"/>
      <path data-memory-box="b-new" d="M75 0V20"/>
    </svg>
    <div class="memory-layouts">
      <section class="memory-card memory-bank" data-memory-box="old">
        <div class="memory-row-heading"><h3>旧布局</h3>${value('old-layout')}</div>
        <p class="memory-ref">旧引用 ${value('old-refs')}</p>
        ${slots(6)}
      </section>
      <section class="memory-card memory-bank" data-memory-box="new">
        <div class="memory-row-heading"><h3>新布局</h3>${value('new-layout')}</div>
        <p class="memory-ref">新引用 ${value('new-refs')}</p>
        ${slots(12)}
      </section>
    </div>
  </div>`;

function restartState(state, text, box) {
  const running = state.instance === 'online';
  const reconnected = running && state.layout === 'expanded';
  const session = running ? (reconnected ? '新会话已连接' : '旧会话在线') : '无会话';
  text('configured', state.configured);
  text('setting', state.setting ?? '—');
  text('pending', state.pending ?? '—');
  text('session-name-a', reconnected ? 'Backend A′' : 'Backend A');
  text('session-name-b', reconnected ? 'Backend B′' : 'Backend B');
  text('session-a', session);
  text('session-b', session);
  text('instance', { online: '接收连接', offline: '实例已停止', starting: '正在初始化' }[state.instance]);
  text('layout', { original: '原布局', none: '已释放', expanded: '新布局' }[state.layout]);
  box('settings', 'status', state.pending ? 'pending' : 'normal');
  box('layout', 'status', state.layout);
  box('sessions', 'status', state.instance);
}

function dsmState(state, text, box) {
  for (const [id] of dsmProcesses) {
    const attached = state.mapped.includes(id);
    text(id, attached ? '已挂载' : state.detached.includes(id) ? '已分离' : '待挂载');
    box(id, 'status', attached ? 'attached' : 'idle');
  }
  text('segment', { absent: '待创建', alive: '使用中', released: '已回收' }[state.segment]);
  text('handle', state.segment === 'alive' ? '0x2A' : '—');
  text('count', state.mapped.length);
  box('segment', 'status', state.segment);
}

function onlineState(state, text, box) {
  const oldRefs = [state.backendA, state.backendB].filter(layout => layout === 'old').length;
  text('backend-a', state.backendA === 'old' ? '持有旧引用' : '持有新引用');
  text('backend-b', state.backendB === 'old' ? '持有旧引用' : '持有新引用');
  text('old-layout', state.oldLayout === 'alive' ? '保留' : '已释放');
  text('new-layout', state.newLayout === 'ready' ? '已就绪' : '待建立');
  text('old-refs', oldRefs);
  text('new-refs', 2 - oldRefs);
  box('old', 'status', state.oldLayout);
  box('new', 'status', state.newLayout);
  for (const [actor, destination] of [['a', state.backendA], ['b', state.backendB]]) {
    box(actor + '-old', 'status', destination === 'old' ? 'attached' : 'idle');
    box(actor + '-new', 'status', destination === 'new' ? 'attached' : 'idle');
  }
}

const views = {
  'shared-memory': [restartMarkup, restartState],
  'shared-memory/dsm': [dsmMarkup, dsmState],
  'shared-memory/online': [onlineMarkup, onlineState]
};

export function mountMemoryScene(container, key) {
  const [markup, render] = views[key];
  container.innerHTML = markup;
  const fields = Object.fromEntries(Array.from(container.querySelectorAll('[data-memory-field]'),
    element => [element.dataset.memoryField, element]));
  const boxes = Object.fromEntries(Array.from(container.querySelectorAll('[data-memory-box]'),
    element => [element.dataset.memoryBox, element]));
  const text = (name, next) => {
    const field = fields[name];
    const content = String(next);
    if (field.textContent !== content) field.textContent = content;
  };
  const box = (name, attribute, next) => { boxes[name].dataset[attribute] = next; };
  return state => {
    for (const [name, element] of Object.entries(boxes)) element.classList.toggle('is-focus', name === state.focus);
    render(state, text, box);
  };
}

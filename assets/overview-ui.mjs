import {modules,nestedObjects,actors} from './overview.mjs?rev=semantic-v1';
import {moduleArt} from './module-art.mjs';

export function mapNodes() {
  const header = id => {
    const info = modules[id];
    return `<button type="button" class="component-head" data-inspect="${id}" aria-controls="inspection">
      <span class="component-art art-${info.tone}">${moduleArt(info.art)}</span>
      <span><span class="component-type">${info.type}</span><strong>${info.name}</strong></span></button>`;
  };
  return `
    <section class="system-node client-node art-sql" data-node="client">
      ${header('client')}<p class="node-status" data-status="client"></p>
      <span class="endpoint-note">发送查询 · 接收结果</span>
    </section>
    <section class="system-node backend-node art-sql" data-node="backend">
      ${header('backend')}
      <div class="query-pipeline" aria-label="Backend 内部执行阶段">
        <span data-phase="parse">解析 / 重写</span><span aria-hidden="true">›</span><span data-phase="plan">规划</span><span aria-hidden="true">›</span><span data-phase="execute">执行</span>
      </div>
      <p class="node-status" data-status="backend"></p>
      <button type="button" class="nested-object snapshot-object" data-inspect="snapshot" aria-controls="inspection">
        <span class="nested-label">快照 · 本地上下文</span><span data-status="snapshot"></span>
      </button>
      <div class="backend-mechanisms"><a href="#buffers">共享页访问 ↗</a><a href="#wal">WAL 操作 ↗</a></div><p class="component-note">事务上下文与执行状态属于本进程</p>
    </section>
    <section class="system-node buffer-node art-page" data-node="buffers">
      ${header('buffers')}
      <div class="buffer-frames">
        <button type="button" class="buffer-frame" data-inspect="page" aria-controls="inspection">
          <span class="frame-head"><strong>F1</strong><span id="frame-bits"></span></span>
          <span class="page-object" id="page-object"><span class="page-identity" id="page-identity"></span><span id="page-value"></span><span class="page-lsn" id="page-lsn"></span></span>
        </button>
        <div class="buffer-frame free-frame"><span class="frame-head"><strong>F2</strong></span><span>空闲帧</span></div>
      </div>
      <p class="component-note" data-status="buffers"></p>
    </section>
    <section class="system-node wal-node art-wal" data-node="wal">
      ${header('wal')}<div class="wal-records" id="wal-records"></div><p class="component-note" id="wal-lsn"></p>
    </section>
    <section class="system-node relation-node art-io" data-node="relation">
      ${header('relation')}
      <div class="file-page"><strong id="disk-title">P8 · 文件页</strong><span id="disk-state"></span></div>
      <button type="button" class="file-index" data-inspect="index" aria-controls="inspection">Index Files ↗</button>
    </section>
    <section class="system-node walfile-node art-wal" data-node="walfile">
      ${header('walfile')}<p class="node-status" data-status="walfile"></p><span class="endpoint-note">已持久化的 WAL</span>
    </section>
    <section class="system-node workers-node art-io" data-node="background">
      <div class="worker-heading">${header('background')}</div>
      <div class="worker-list">${Object.entries(actors).filter(([,info])=>info.module==='background').map(([id,info])=>
        `<button type="button" data-inspect="${id}" data-actor="${id}" aria-controls="inspection"><span>${info.name}</span><span data-worker-status="${id}"></span></button>`).join('')}</div>
    </section>`;
}

export function inspectionInfo(id) {
  if (modules[id]) return modules[id];
  if (nestedObjects[id]) return nestedObjects[id];
  const actor = actors[id];
  return {...modules.background,name:actor.name,lab:actor.lab,
    role:({walwriter:'负责在后台推进 WAL 写入和持久化。同步提交也可由 Backend 自己执行刷写。',bgwriter:'提前写出部分脏缓冲页，降低 Backend 替换缓冲帧时承担写页的概率。',checkpointer:'执行检查点相关的写页、文件同步等工作。示例突出文件同步与提交之间的独立性。',autovacuum:'后台执行 VACUUM 和 ANALYZE，处理版本回收、冻结和统计信息维护。'})[id]};
}

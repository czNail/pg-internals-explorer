export const modules = {
  client: {name:'Client', role:'发送 SQL 并接收结果。请求与结果通过当前会话往返。', lab:'mvcc'},
  backend: {name:'Backend', role:'服务端会话进程。执行语句、访问缓冲页，并在需要时插入或刷写 WAL。', lab:'buffers'},
  snapshot: {name:'MVCC 快照', role:'记录读者看到的事务视图。可见性检查将快照与行版本的事务信息结合起来。', lab:'mvcc'},
  buffers: {name:'Shared Buffers', role:'共享缓冲区保存关系页副本。帧描述符记录页标识、引用计数和 Dirty 等状态。', lab:'buffers', color:'page'},
  heap: {name:'Heap Page', role:'缓冲区中的堆页放着行指针和元组。更新可在页内创建新的行版本。', lab:'hot', color:'page'},
  wal: {name:'WAL Buffers', role:'接收新插入的 WAL 记录。插入位置与已持久化位置分别推进。', lab:'wal', color:'wal'},
  relation: {name:'关系文件', role:'存放堆和索引的数据页。写入文件与确认持久化是两个独立阶段。', lab:'wal', color:'io'},
  checkpointer: {name:'Checkpointer', role:'写出本轮检查点所需的数据页并同步文件，推进恢复起点。', lab:'wal', color:'io'},
  walfile: {name:'WAL Files', role:'持久化 WAL 记录。崩溃恢复可用已经持久化的日志重做数据页修改。', lab:'wal', color:'wal'}
};

// Coordinates place the center of each illustration. Labels sit underneath.
export const mapSizes = {wide:[920, 430], compact:[380, 576]};
export const positions = {
  client:       {wide:[114,96], compact:[68,55]},
  backend:      {wide:[207,212], compact:[200,125]},
  snapshot:     {wide:[114,337], compact:[69,199]},
  buffers:      {wide:[457,97], compact:[187,252]},
  heap:         {wide:[491,228], compact:[61,358]},
  wal:          {wide:[443,343], compact:[149,459]},
  relation:     {wide:[763,89], compact:[308,205]},
  checkpointer: {wide:[778,207], compact:[309,344]},
  walfile:      {wide:[752,334], compact:[296,502]}
};

export const routes = {
  request: {from:'client', to:'backend', kind:'sql',
    wide:'M143 104 C177 110 166 163 193 188', compact:'M93 59 C134 60 143 97 173 112'},
  response: {from:'backend', to:'client', kind:'sql',
    wide:'M210 188 C184 164 193 112 145 92', compact:'M173 124 C134 116 125 77 93 70'},
  lookup: {from:'backend', to:'buffers', kind:'page',
    wide:'M243 204 C326 195 310 104 417 96', compact:'M202 150 C241 165 239 209 203 229'},
  load: {from:'relation', to:'buffers', kind:'page',
    wide:'M733 81 C681 38 565 48 493 86', compact:'M282 194 C249 173 220 194 196 229'},
  write: {from:'buffers', to:'relation', kind:'page',
    wide:'M494 99 C556 78 654 69 732 94', compact:'M214 247 C245 242 257 211 282 207'},
  access: {from:'buffers', to:'heap', kind:'page',
    wide:'M492 107 C566 138 561 182 523 209', compact:'M161 254 C121 251 117 310 86 343'},
  snapshot: {from:'backend', to:'snapshot', kind:'sql',
    wide:'M179 227 C146 241 158 290 138 318', compact:'M174 132 C122 128 120 171 94 186'},
  insertWal: {from:'backend', to:'wal', kind:'wal',
    wide:'M240 224 C314 228 317 334 407 343', compact:'M225 131 C270 155 258 385 174 443'},
  flush: {from:'wal', to:'walfile', kind:'wal',
    wide:'M481 336 C545 290 651 298 716 328', compact:'M175 456 C217 451 239 497 269 499'},
  scan: {from:'checkpointer', to:'buffers', kind:'io',
    wide:'M744 198 C668 185 666 104 503 110', compact:'M282 337 C251 331 257 276 214 263'},
  sync: {from:'checkpointer', to:'relation', kind:'io',
    wide:'M809 192 C861 170 853 121 795 97', compact:'M332 333 C375 307 370 244 332 217'}
};

const step = (title, description, object, kind, via, updates, targets = []) =>
  ({title, description, object, kind, via, updates, targets});

const read = [
  step('发送 SELECT', '会话 A 将查询交给 Backend。这个示例使用堆页读取。', 'SELECT A', 'sql', 'request', {client:'等待 A 的结果', backend:'A · 执行 SELECT'}),
  step('取得语句快照', 'READ COMMITTED 的本条语句使用一个新快照，供接下来的行版本检查使用。', 'Snapshot A', 'sql', 'snapshot', {snapshot:'A · 语句快照'}),
  step('查询缓冲映射', 'Backend 用关系、fork 和块号定位页。这个示例从一次冷读开始。', 'accounts/8', 'page', 'lookup', {buffers:'Block 8 · 未命中'}),
  step('读入数据页副本', '将 Block 8 读入共享缓冲帧 F1。文件中的页和内存中的副本同时存在。', 'Block 8', 'page', 'load', {buffers:'F1 · Block 8 · pin 1', heap:'Block 8 · (8,1)'}),
  step('检查行版本', 'Backend 在被固定的页上检查行版本，快照 A 能看到 (8,1)。', 'Tuple (8,1)', 'page', 'access', {backend:'A · 检查 (8,1)', heap:'(8,1) · 可见'}),
  step('返回结果', '发送查询结果并释放页引用，帧保留在共享缓冲区。', 'Row 1', 'sql', 'response', {client:'收到 1 行', backend:'A · 空闲', buffers:'F1 · Block 8 · pin 0', snapshot:'A · 语句结束'})
];

const write = [
  step('发送 UPDATE', '会话 B 更新未被索引引用的列。示例假定目标页已有足够空间。', 'UPDATE B', 'sql', 'request', {client:'等待 B 提交', backend:'B · 执行 UPDATE'}),
  step('固定缓冲帧', '通过映射找到已缓存的页。引用未释放前，该帧不能被替换。', 'Frame F1', 'page', 'lookup', {buffers:'F1 · Block 8 · pin 1'}),
  step('生成新行版本', '同一堆页新增 (8,2)，旧版本的链指针连向新版本。这个例子满足 HOT 条件。', 'Tuple (8,2)', 'page', 'access', {heap:'(8,1) → (8,2)', buffers:'F1 · Dirty · pin 1'}),
  step('插入页修改 WAL', 'Backend 插入 HOT_UPDATE WAL 记录，页的 LSN 记录对应位置。', 'HOT_UPDATE', 'wal', 'insertWal', {wal:'inserted 0/220', heap:'Block 8 · LSN 0/220', buffers:'F1 · Dirty · pin 0'}),
  step('插入提交记录', 'COMMIT 产生独立的事务记录，示例采用本地同步提交。', 'XACT COMMIT', 'wal', 'insertWal', {wal:'inserted 0/260', backend:'B · 等待 WAL flush'}),
  step('刷写提交 WAL', '持久化位置推进到提交记录末端，缓冲区的数据页仍是脏页。', 'WAL 0/260', 'wal', 'flush', {walfile:'durable 0/260'}),
  step('返回提交成功', '提交的 WAL 已经持久化，Backend 可以确认事务成功。', 'COMMIT OK', 'sql', 'response', {client:'B · 提交成功', backend:'B · 空闲'})
];

const checkpoint = [
  step('挑出本轮脏页', 'Checkpointer 处理检查点需要写回的脏页。此时关系文件还保留旧的页内容。', 'Block 8', 'io', 'scan', {checkpointer:'扫描需写回的页'}),
  step('写出数据页', '页 LSN 对应的 WAL 已经持久化，因而可以把页副本写入关系文件。', 'Page write', 'page', 'write', {relation:'Block 8 · 已写待同步', buffers:'F1 · Clean'}),
  step('同步关系文件', '同步数据文件后，这个页的写入已持久化。示例在此略去其余页和检查点记录。', 'File sync', 'io', 'sync', {relation:'Block 8 · durable 0/220', checkpointer:'数据文件已同步'})
];

const base = {client:'会话 A / B', backend:'空闲', snapshot:'等待查询', buffers:'空闲帧', heap:'等待读入', wal:'inserted 0/200', relation:'Block 8 · LSN 0/200', checkpointer:'等待调度', walfile:'durable 0/200'};
const warm = {...base, buffers:'F1 · Block 8 · pin 0', heap:'Block 8 · (8,1)'};
const dirty = {...warm, buffers:'F1 · Dirty · pin 0', heap:'Block 8 · LSN 0/220', wal:'inserted 0/260', walfile:'durable 0/260'};

export const workloads = {
  mixed: {label:'混合负载', initial:base, steps:[...read, ...write, ...checkpoint]},
  read: {label:'SELECT 读', initial:base, steps:read},
  write: {label:'UPDATE 写', initial:warm, steps:write},
  checkpoint: {label:'检查点', initial:dirty, steps:checkpoint}
};

export function overviewState(workload, index) {
  return Object.assign({}, workload.initial, ...workload.steps.slice(0, index + 1).map(event => event.updates));
}

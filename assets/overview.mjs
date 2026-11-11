export const modules = {
  client: {name:'Client', type:'客户端', art:'client', tone:'sql', lab:'mvcc',
    role:'发送查询请求，接收结果行和事务完成状态。请求与响应沿相反方向传送。'},
  backend: {name:'Backend', type:'会话进程', art:'backend', tone:'sql', lab:'mvcc',
    role:'解析、重写、规划并执行 SQL。通过缓冲管理代码访问共享页，在进程内使用快照判断行版本。'},
  buffers: {name:'Shared Buffers', type:'共享内存', art:'buffers', tone:'page', lab:'buffers',
    role:'共享缓冲帧保存关系页的内存副本。Backend 持有 Pin 后访问页中的元组，页继续留在缓冲帧内。'},
  wal: {name:'WAL Buffers', type:'共享内存', art:'wal', tone:'wal', lab:'wal',
    role:'保存已插入的 WAL 记录。记录被写出并同步之后，持久化位置才向前推进。'},
  relation: {name:'关系文件', type:'文件存储', art:'relation', tone:'io', lab:'hot',
    role:'堆文件与索引文件各自保存数据页。文件中的页和缓冲帧中的页具有相同页标识，可以处于不同版本。'},
  walfile: {name:'WAL Files', type:'文件存储', art:'walfile', tone:'wal', lab:'wal',
    role:'保存写出的 WAL。本地同步提交等待相应提交记录持久化，数据页可以稍后写回。'},
  background: {name:'后台进程', type:'进程组', art:'checkpointer', tone:'io', lab:'wal',
    role:'WAL Writer 刷写日志，BgWriter 提前写出部分脏页，Checkpointer 执行检查点相关写页和文件同步。Autovacuum 处理回收。'}
};

export const nestedObjects = {
  snapshot: {name:'语句 / 事务快照', parent:'backend', art:'snapshot', tone:'sql', lab:'mvcc',
    role:'Backend 执行语句时使用的可见性视图。新旧快照可能在同一页上读到不同的行版本。'},
  page: {name:'Heap Page P8', parent:'buffers', art:'heap', tone:'page', lab:'hot',
    role:'accounts/main/8 的缓冲页副本。元组与 HOT 链在这个页内部变化，磁盘副本独立显示在关系文件区域。'},
  index: {name:'Index Files', parent:'relation', art:'relation', tone:'io', lab:'buffers',
    role:'索引也由数据页组成，并使用共享缓冲区。本轮读示例采用堆扫描，索引文件作为可深入的存储对象展示。'}
};

export const actors = {
  client: {name:'Client', module:'client'},
  backend: {name:'Backend', module:'backend'},
  walwriter: {name:'WAL Writer', module:'background', lab:'wal'},
  bgwriter: {name:'BgWriter', module:'background', lab:'buffers'},
  checkpointer: {name:'Checkpointer', module:'background', lab:'wal'},
  autovacuum: {name:'Autovacuum', module:'background', lab:'vacuum'}
};

export const mapSizes = {wide:[1100,520], compact:[390,880]};
// The rectangles also define containment. Coordinates are top-left, width, height.
export const positions = {
  client:     {wide:[18,143,145,150], compact:[4,116,120,142]},
  backend:    {wide:[221,73,228,220], compact:[151,46,222,220]},
  buffers:    {wide:[531,52,235,170], compact:[16,330,222,170]},
  wal:        {wide:[548,328,220,120], compact:[16,715,222,120]},
  relation:   {wide:[894,76,160,175], compact:[266,342,110,178]},
  walfile:    {wide:[894,328,160,154], compact:[266,719,110,145]},
  background: {wide:[220,335,232,148], compact:[151,530,222,148]}
};

export const routes = {
  sqlRequest: {from:'client',to:'backend',kind:'request',label:'SQL 请求',
    wide:'M151 181 C174 148 190 148 221 162',compact:'M113 153 C127 124 134 123 151 126'},
  sqlResponse: {from:'backend',to:'client',kind:'response',label:'结果返回',
    wide:'M221 223 C184 254 174 248 151 224',compact:'M151 218 C133 243 123 240 112 217'},
  bufferAccess: {from:'backend',to:'buffers',kind:'access',label:'定位 / Pin',
    wide:'M449 134 C476 108 497 109 531 126',compact:'M198 266 C170 286 159 307 150 330'},
  tupleRead: {from:'buffers',to:'backend',kind:'access',label:'读取可见值',
    wide:'M531 172 C494 194 486 225 449 204',compact:'M212 330 C237 309 258 290 270 266'},
  readCommand: {from:'backend',to:'relation',kind:'request',optional:true,
    wide:'M389 73 C531 2 798 2 946 76',compact:'M373 146 C387 210 384 280 325 342'},
  pageRead: {from:'relation',to:'buffers',kind:'page',label:'页读入',
    wide:'M894 113 C853 83 811 88 766 116',compact:'M266 378 C256 359 247 356 238 371'},
  pageWrite: {from:'buffers',to:'relation',kind:'page',label:'页写出',
    wide:'M766 178 C812 204 849 199 894 168',compact:'M238 442 C250 457 258 453 266 437'},
  walInsert: {from:'backend',to:'wal',kind:'wal',label:'插入 WAL',
    wide:'M404 293 C436 318 468 356 548 369',compact:'M160 266 C63 377 3 578 77 715'},
  flushCommand: {from:'backend',to:'walfile',kind:'request',optional:true,
    wide:'M449 248 C538 307 802 267 894 345',compact:'M373 239 C389 398 387 582 327 719'},
  walFlush: {from:'wal',to:'walfile',kind:'wal',label:'日志刷写',
    wide:'M768 394 C811 363 850 365 894 392',compact:'M238 770 C249 751 258 750 266 765'},
  workerAccess: {from:'background',to:'buffers',kind:'access',optional:true,
    wide:'M452 368 C486 312 512 266 605 222',compact:'M269 530 C277 513 255 488 238 479'},
  workerWal: {from:'background',to:'wal',kind:'access',optional:true,
    wide:'M452 427 C489 458 511 456 548 418',compact:'M194 678 C175 695 160 701 146 715'},
  fileSync: {from:'background',to:'relation',kind:'request',optional:true,
    wide:'M452 446 C579 505 843 491 868 309 C874 258 882 230 910 216',compact:'M373 569 C389 546 386 486 376 454'}
};

const flow = (route,id,label,delay=0) => ({route,id,label,delay});
const event = (title,description,actor,action,targets,updates={},flows=[],focus) =>
  ({title,description,actor,action,targets,updates,flows,focus});

const initial = {
  client:'等待请求',backend:'空闲',phase:'idle',snapshot:'尚未取得快照',
  buffers:'空闲帧',loaded:false,pin:0,dirty:false,pageLsn:'0/200',pageValue:'—',
  heap:'等待装入',wal:'尚无新增记录',walRecords:[],inserted:'0/200',flushed:'0/200',
  relation:'P8 · 余额 100',diskWritten:'0/200',diskDurable:'0/200',diskValue:'100',walfile:'durable 0/200',
  background:'待命',workers:{walwriter:'待命',bgwriter:'待命',checkpointer:'待命',autovacuum:'待命'}
};
const warm = {...initial,loaded:true,buffers:'F1 · accounts/main/8',heap:'(8,1) · balance=100',pageValue:'100'};

const readStart = [
  event('Q1 · 查询进入会话','客户端发送 SELECT。查询请求 Q1 和之后返回的结果 R1 分别具有自己的身份。','client','请求',['client','backend'],
    {client:'Q1 · 等待结果',backend:'Q1 · 解析与重写',phase:'parse'},
    [flow('sqlRequest','Q1','Q1 · SELECT')]),
  event('在 Backend 内生成执行计划','规划器选择本例的堆扫描路径。解析、规划和执行均发生在会话进程内。','backend','进程内处理',['backend'],
    {backend:'Q1 · 规划堆扫描',phase:'plan'}),
  event('取得快照，开始执行','Backend 为本条 READ COMMITTED 查询取得快照 S1，随后执行堆扫描。','backend','进程内处理',['backend'],
    {backend:'Q1 · 执行堆扫描',phase:'execute',snapshot:'S1 · 语句快照'},[],'snapshot')
];
const lookupMiss = event('定位 P8 · 缓冲未命中','Backend 查找 accounts/main/8 的映射，选定空闲帧 F1。本次需要读取关系文件。','backend','共享内存访问',['backend','buffers'],
  {buffers:'P8 未命中 · 分配 F1'},[flow('bufferAccess','Q1','定位 P8')]);
const fileRead = event('发起文件读取','Backend 通过存储管理层发起 P8 的读取。此处演示同步 I/O，文件数据也可能由操作系统缓存提供。','backend','I/O 请求',['backend','relation'],
  {backend:'Q1 · 等待文件读取'},[flow('readCommand','IO1','读取 P8')]);
const pageRead = event('P8 · 页内容读入 F1','关系文件中的 P8 被复制到共享缓冲帧 F1。文件页和内存页副本同时存在。','backend','页复制',['relation','buffers'],
  {loaded:true,pin:1,buffers:'F1 · accounts/main/8',heap:'(8,1) · balance=100',pageValue:'100',backend:'Q1 · 扫描 P8'},
  [flow('pageRead','P8','P8 · 页副本')],'page');
const lookupHit = event('定位 P8 · 缓冲命中','F1 已缓存 P8。Backend 增加 Pin 后直接访问这个缓冲页。','backend','共享内存访问',['backend','buffers'],
  {pin:1,buffers:'F1 · P8 命中'},[flow('bufferAccess','Q1','定位 P8')],'page');
const readEnd = [
  event('在页内检查可见性','Backend 用快照 S1 检查 P8 中的元组，取得可见值。P8 留在 F1，图中回传的是查询取得的值。','backend','页内访问',['backend','buffers'],
    {backend:'Q1 · 投影结果',heap:'(8,1) · 对 S1 可见'},[flow('tupleRead','R1','R1 · 值 100')],'page'),
  event('R1 · 返回结果行','Executor 将结果行 R1 发给客户端。语句完成后释放 Pin，缓冲区保留 P8。','backend','结果返回',['backend','client'],
    {client:'R1 · 收到 balance=100',backend:'空闲',phase:'idle',pin:0,snapshot:'S1 · 语句结束'},
    [flow('sqlResponse','R1','R1 · balance=100')])
];
const readMiss = [...readStart,lookupMiss,fileRead,pageRead,...readEnd];
const readHit = [...readStart,lookupHit,...readEnd];

const write = [
  event('Q2 · 更新请求进入会话','客户端发起 UPDATE，随后提交事务 T120。示例更新未被索引引用的 balance 列，并假设 P8 有足够空间。','client','请求',['client','backend'],
    {client:'Q2 · 等待提交',backend:'T120 · 执行 UPDATE',phase:'execute',snapshot:'S2 · 更新语句快照'},
    [flow('sqlRequest','Q2','Q2 · UPDATE')]),
  event('固定 P8','Backend 找到 F1 中的 P8 并持有 Pin，准备修改页内元组。','backend','共享内存访问',['backend','buffers'],
    {pin:1,buffers:'F1 · accounts/main/8'},[flow('bufferAccess','Q2','Pin P8')],'page'),
  event('页内生成新版本，插入 W1','P8 内形成 HOT 链 (8,1) → (8,2)。同一步中 Backend 记录修改、插入 WAL W1 并设置页 LSN。','backend','页内修改 / WAL 生成',['backend','buffers','wal'],
    {dirty:true,pageValue:'100 → 90',heap:'(8,1) → (8,2)',pageLsn:'0/220',inserted:'0/220',wal:'W1 · HOT_UPDATE',walRecords:[['W1','HOT_UPDATE','0/220']],pin:0},
    [flow('walInsert','W1','W1 · HOT_UPDATE')],'page'),
  event('插入提交记录 W2','COMMIT 为事务 T120 生成独立的 WAL 记录 W2。','backend','WAL 插入',['backend','wal'],
    {backend:'T120 · 等待 WAL 持久化',inserted:'0/260',wal:'W1 + W2 · 待刷写',walRecords:[['W1','HOT_UPDATE','0/220'],['W2','COMMIT','0/260']]},
    [flow('walInsert','W2','W2 · COMMIT')]),
  event('Backend 请求刷写 WAL','本地同步提交由 Backend 调用 XLogFlush，要求持久化位置覆盖 W2 的末端。','backend','I/O 请求',['backend','walfile'],
    {},[flow('flushCommand','SYNC1','flush 至 0/260')]),
  event('W1、W2 · 日志持久化','Backend 执行本次日志刷写。W1 与 W2 具有各自的记录身份，持久化位置推进到 0/260。','backend','日志刷写',['wal','walfile'],
    {flushed:'0/260',wal:'W1 + W2 · 已持久化',walfile:'durable 0/260'},
    [flow('walFlush','W1','W1 · UPDATE'),flow('walFlush','W2','W2 · COMMIT',330)]),
  event('C120 · 返回提交成功','提交记录已持久化。客户端收到事务 T120 的成功确认，此时缓冲页仍是 Dirty，文件仍保存旧页。','backend','结果返回',['backend','client'],
    {client:'C120 · 提交成功',backend:'空闲',phase:'idle',snapshot:'S2 · 语句结束'},
    [flow('sqlResponse','C120','T120 · COMMIT OK')])
];

const background = [
  event('WAL Writer 检查刷写边界','本例的 W1、W2 已由同步提交持久化，WAL Writer 本轮没有需要继续推进的记录。','walwriter','进程内处理',['background','wal'],
    {background:'WAL Writer · 检查日志',workers:{...initial.workers,walwriter:'已追平'}},[],'walwriter'),
  event('BgWriter 选择脏页','BgWriter 访问共享缓冲区，提前写出部分脏页。示例选择 F1 中的 P8。','bgwriter','共享内存访问',['background','buffers'],
    {background:'BgWriter · 选择 P8',workers:{...initial.workers,bgwriter:'处理 P8'}},
    [flow('workerAccess','BG1','检查 Dirty P8')],'bgwriter'),
  event('P8 · 脏页写入文件','P8 的页 LSN 0/220 已被持久化 WAL 覆盖。BgWriter 写出页副本，F1 变干净，文件写入还待同步。','bgwriter','页复制',['buffers','relation'],
    {dirty:false,diskWritten:'0/220',diskValue:'90',relation:'P8 · 已写 balance=90',background:'BgWriter · 页已写出'},
    [flow('pageWrite','P8','P8 · 写出副本')],'page'),
  event('Checkpointer 同步关系文件','Checkpointer 完成相应数据文件同步，P8 的新版本持久化。这里展示检查点相关的文件同步阶段。','checkpointer','文件同步',['background','relation'],
    {diskDurable:'0/220',background:'Checkpointer · 文件已同步',workers:{...initial.workers,checkpointer:'已同步数据文件'}},
    [flow('fileSync','FSYNC1','同步关系文件')],'checkpointer')
];
const dirty = {...warm,dirty:true,pageLsn:'0/220',heap:'(8,1) → (8,2)',pageValue:'100 → 90',
  inserted:'0/260',flushed:'0/260',walfile:'durable 0/260',wal:'W1 + W2 · 已持久化',
  walRecords:[['W1','HOT_UPDATE','0/220'],['W2','COMMIT','0/260']]};

export const workloads = {
  mixed:{label:'完整链路',initial,steps:[...readMiss,...write,...background]},
  read:{label:'读文件',initial,steps:readMiss},
  hit:{label:'缓存命中',initial:warm,steps:readHit},
  write:{label:'写入提交',initial:warm,steps:write},
  background:{label:'后台写回',initial:dirty,steps:background}
};

export function overviewState(workload,index) {
  return Object.assign({},workload.initial,...workload.steps.slice(0,index+1).map(step=>step.updates));
}

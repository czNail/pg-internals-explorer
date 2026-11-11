import { memoryLabs } from './memory.mjs';

const docs = 'https://www.postgresql.org/docs/18/';
const src = 'https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/';
const step = (title, detail, patch = {}) => ({title, detail, patch});

export const labs = {
  ...memoryLabs,
  buffers: {
    label:'共享缓冲区', title:'Shared Buffers', subtitle:'命中、Pin 与时钟扫描',
    summary:'跟踪一次缓冲命中，再观察缓冲区满时 CLOCK-sweep 如何选出可替换的帧。',
    view:'缓冲帧与映射', context:'3 个教学帧 · 关系 accounts', source:src+'storage/buffer/README',
    legend:'Pin count 表示使用中的引用。Usage count 是替换策略的计数。演示省略空闲帧、访问环及并发竞争。',
    initial:{target:'Block 8', hand:'F1', note:'等待请求', frames:[[8,0,1,false],[9,1,1,false],[12,0,0,true]], focus:[]},
    steps:[
      step('初始缓冲池', '三个帧已有页映射。F2 被另一会话固定，F3 的 Block 12 已经修改。'),
      step('命中并固定 F1', '查找 Block 8 的映射命中 F1。Pin count 增加，普通访问也可提高 usage count。', {note:'命中 F1', frames:[[8,1,2,false],[9,1,1,false],[12,0,0,true]], focus:['F1']}),
      step('使用完毕，释放 Pin', '本次引用结束。页副本继续留在 F1，usage count 仍保留。', {note:'释放 F1', frames:[[8,0,2,false],[9,1,1,false],[12,0,0,true]]}),
      step('请求新页，扫描 F1', 'Block 21 未命中。时钟扫描遇到未固定且 usage count 大于零的 F1，减一后继续。', {target:'Block 21', hand:'F2', note:'F1 usage 2 → 1', frames:[[8,0,1,false],[9,1,1,false],[12,0,0,true]]}),
      step('跳过被固定的 F2', 'F2 的 pin count 大于零。这个帧既不能被换出，也不在这一步衰减 usage count。', {hand:'F3', note:'F2 被固定', focus:['F2']}),
      step('选中脏帧 F3', 'F3 未被固定且 usage count 为零。复用前须写出脏页，并确保页 LSN 对应的 WAL 已持久化。', {hand:'F1', note:'选择 F3；写出 Block 12', focus:['F3']}),
      step('装入 Block 21', '移除旧映射、装入新页，F3 现映射 Block 21。Backend 持有新页引用。', {note:'替换完成', frames:[[8,0,1,false],[9,1,1,false],[21,1,1,false]]})
    ]
  },
  wal: {
    label:'WAL 与检查点', title:'WAL 与检查点', subtitle:'提交、写页与持久化',
    summary:'对照 WAL、共享缓冲和关系文件，逐步检查提交成功和数据页持久化的先后关系。',
    view:'WAL 与数据页的持久化状态', context:'本地同步提交 · LSN 为示例值', source:docs+'wal-intro.html',
    legend:'LSN 表示 WAL 中的位置。此处用记录末端位置比较刷写边界，略去 full-page image 等其他记录。',
    initial:{records:[], inserted:'0/200', flushed:'0/200', buffer:'0/200', dirty:false, written:'0/200', durable:'0/200', tx:'进行中', focus:[]},
    steps:[
      step('修改前', '缓冲区与持久化的关系页都处于初始状态。事务即将插入一行。'),
      step('修改缓冲页，插入 WAL', '事务在内存中修改堆页，并插入 HEAP_INSERT 记录。这个教学步骤合并了临界区内的相关动作。', {records:[['HEAP_INSERT','0/220']], inserted:'0/220', buffer:'0/220', dirty:true, focus:['wal','buffer']}),
      step('插入 COMMIT 记录', '提交生成事务记录。记录已经插入 WAL 缓冲区，本地同步提交还需要等待刷写。', {records:[['HEAP_INSERT','0/220'],['XACT COMMIT','0/260']], inserted:'0/260', tx:'等待刷写', focus:['wal','tx']}),
      step('刷写 WAL，确认提交', '持久化位置达到 0/260。提交可以返回，而关系文件里仍然是旧页。', {flushed:'0/260', tx:'提交成功', focus:['wal','tx']}),
      step('写出数据页', '写页时检查 WAL 已经覆盖页 LSN 0/220。在这次演示中，写出后缓冲页变干净，文件仍待同步。', {dirty:false, written:'0/220', focus:['buffer','file']}),
      step('同步关系文件', '示例中由 Checkpointer 完成文件同步，数据页版本持久化。检查点还包括其他工作，例如写入检查点记录。', {durable:'0/220', focus:['file']})
    ]
  },
  mvcc: {
    label:'MVCC 可见性', title:'MVCC 与事务快照', subtitle:'同一行的两种视图',
    summary:'让一个老读者跨过 UPDATE 的提交，再用新读者读取同一行，比较两份快照看到的版本。',
    view:'行版本与读者视图', context:'A: REPEATABLE READ · B: 写入 · C: 新读者', source:docs+'transaction-iso.html',
    legend:'A 已执行首条需要快照的查询。以下只演示并发更新的可见性，省略行锁、命令 ID 与提示位。',
    initial:{rows:[['(8,1)','20','—','100']], writer:'未开始', older:'100', newer:'未查询', focus:[]},
    steps:[
      step('A 建立快照', '会话 A 在 REPEATABLE READ 事务中首次查询。它看到已提交的行版本 (8,1)，余额为 100。', {focus:['older']}),
      step('B 更新行，尚未提交', 'B 的事务号为 120。旧版本的 xmax 和新版本的 xmin 都指向 B，A 仍读取余额 100。', {rows:[['(8,1)','20','120','100'],['(8,2)','120','—','90']], writer:'120 · 进行中', focus:['writer']}),
      step('B 提交', '事务 120 已提交。它的提交不会改变 A 已取得的快照，A 仍读取 (8,1)。', {writer:'120 · 已提交', focus:['writer','older']}),
      step('C 取得新快照', 'C 在 B 提交后开始查询。对 C，旧版本已被更新，新版本可见，所以返回 90。', {newer:'90', focus:['older','newer']}),
      step('A 结束事务', 'A 结束，释放老快照。是否可回收旧版本还取决于是否有其他读者保留相关视图。', {older:'快照已释放', focus:['older']})
    ]
  },
  hot: {
    label:'Heap Page / HOT', title:'堆页布局与 HOT 更新', subtitle:'行指针、版本链与剪枝',
    summary:'看非索引列在同一堆页上的更新怎样复用索引入口，以及剪枝后入口如何继续找到新版本。',
    view:'Block 8 的索引入口与行指针', context:'B-tree 索引 · 同页更新', source:docs+'storage-hot.html',
    legend:'演示索引只引用 id，更新修改 balance，并假设页内有空间。页头和元组偏移以结构示意呈现。',
    initial:{index:'id=1 → (8,1)', oldReader:'持有更新前快照', chain:'LP 1 → Tuple v1', rows:[['1','NORMAL','v1 · balance=100','(8,1)']], focus:[]},
    steps:[
      step('索引指向根行指针', '索引中保存的是 TID (8,1)。其中 8 是块号，1 是堆页上的行指针号。', {focus:['index']}),
      step('同页生成新版本', '修改 balance 后，堆页增加行指针 2 及新元组，旧元组的 t_ctid 指向 (8,2)。索引入口继续指向 (8,1)。', {chain:'LP 1 → Tuple v1 → LP 2 → Tuple v2', rows:[['1','NORMAL','v1 · balance=100','(8,2)'],['2','NORMAL','v2 · balance=90','(8,2)']], focus:['page']}),
      step('提交后沿链访问', '更新提交后，新的快照可以从索引入口进入 HOT 链并找到 v2。这里仍有老快照可能需要 v1。', {oldReader:'仍可读取 v1', focus:['index','reader']}),
      step('老快照释放，页内剪枝', '旧版本已经不再需要。剪枝移除 v1 的元组数据，把根行指针设为 REDIRECT，指向 LP 2。', {oldReader:'已释放', chain:'LP 1 ⇢ LP 2 → Tuple v2', rows:[['1','REDIRECT','指向 LP 2','—'],['2','NORMAL','v2 · balance=90','(8,2)']], focus:['page']})
    ]
  },
  vacuum: {
    label:'VACUUM', title:'VACUUM 与版本回收', subtitle:'老快照、索引清理与空间复用',
    summary:'用一个已提交的 DELETE 观察老快照为什么会阻挡回收，以及索引项和堆页槽如何被清理。',
    view:'堆页、索引与回收边界', context:'普通 VACUUM · 执行索引清理', source:docs+'routine-vacuuming.html',
    legend:'例子选择普通 VACUUM 的一种清理路径。回收的页内空间可供关系复用，文件大小在示例中不变。',
    initial:{reader:'A · 可见 (8,1)', heap:'LP 1 · NORMAL', index:'id=1 → (8,1)', space:'元组仍占用空间', focus:[]},
    steps:[
      step('A 读取旧版本', 'A 持有删除前的快照。索引仍指向堆页的行指针 1。', {focus:['reader']}),
      step('DELETE 提交', '新快照不再看到该行，老快照 A 仍可读取。删除在元组上留下事务信息。', {heap:'LP 1 · 已删除版本', focus:['heap','reader']}),
      step('首次 VACUUM 保留版本', '回收边界受 A 的老快照约束，堆版本和它的索引项仍然需要保留。', {focus:['reader','index']}),
      step('A 结束，清理堆版本', '下一次 VACUUM 确认该版本可以回收，移除元组数据并把行指针标成 LP_DEAD，等待索引项处理。', {reader:'A · 快照释放', heap:'LP 1 · DEAD', space:'元组空间已回收，槽保留', focus:['heap']}),
      step('删除索引项', '索引清理删除指向 (8,1) 的条目。堆页上的行指针槽此时仍标记为 LP_DEAD。', {index:'索引项已移除', focus:['index']}),
      step('行指针槽可以复用', 'VACUUM 再处理该堆页，把对应的行指针置为 LP_UNUSED。将来可用于新行。', {heap:'LP 1 · UNUSED', space:'空间和行指针槽可复用', focus:['heap']})
    ]
  }
};

export function labState(lab, index) {
  return Object.assign({}, lab.initial, ...lab.steps.slice(0, index + 1).map(event => event.patch));
}

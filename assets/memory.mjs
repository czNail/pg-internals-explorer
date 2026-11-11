const moduleKey = 'shared-memory';
const title = '进程与共享内存';
const configSource = 'https://www.postgresql.org/docs/18/runtime-config-connection.html#GUC-MAX-CONNECTIONS';
const dsmSource = 'https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/storage/ipc/dsm.c';

const step = (action, title, detail, patch = {}) => ({ action, title, detail, patch });

export const memoryLabs = {
  [moduleKey]: {
    label: title,
    subtitle: '连接上限、实例重启与 DSM',
    scene: '连接上限与重启',
    title: '连接上限为什么要重启',
    summary: '把 max_connections 从 100 改为 200，分别观察配置文件、运行参数和主共享内存。',
    view: '从配置到共享布局',
    context: 'PostgreSQL 18 · 实例启动路径',
    source: configSource,
    legend: '100 和 200 是连接上限。PGPROC 总槽数还受后台进程和预备事务等配置影响。画面只展示部分共享结构。',
    initial: { configured: 100, setting: 100, pending: false, instance: 'online', layout: 'original', focus: 'layout' },
    steps: [
      step(null, '旧实例接收连接', 'Backend A、B 正在使用实例启动时初始化的共享状态。当前连接上限是 100。'),
      step('修改配置', '把配置文件改为 200', '磁盘上的配置文件已更新。运行中的 postmaster 还未重读文件，正在使用的共享布局保持原样。', { configured: 200, focus: 'config' }),
      step('重载配置', '重载后等待重启', 'postmaster 读到新值。max_connections 属于启动期参数，pg_settings 仍返回 100，并标记 pending_restart。原有会话继续使用原布局。', { pending: true, focus: 'settings' }),
      step('停止旧实例', '会话退出，旧布局结束', '重启开始。旧 Backend 退出，这一代主共享内存的生命周期结束。此时无法查询 pg_settings。', { setting: null, pending: null, instance: 'offline', layout: 'none', focus: 'sessions' }),
      step('初始化主共享内存', '按新配置建立共享布局', '新 postmaster 读取 200，按新上限计算共享资源需求并初始化相关结构。画面中的 PGPROC、ProcArray 和锁管理结构都属于新实例。', { instance: 'starting', layout: 'expanded', focus: 'layout' }),
      step('接收新连接', '新实例使用连接上限 200', '初始化完成后，新 Backend 可以连接。pg_settings 返回 200，pending_restart 恢复为 false。', { setting: 200, pending: false, instance: 'online', focus: 'sessions' })
    ]
  },
  [moduleKey + '/dsm']: {
    label: title,
    module: moduleKey,
    scene: 'DSM 挂载与回收',
    title: 'DSM 的最后一个使用者',
    summary: '跟随 Leader 和两个 Worker，观察进程分离后，共享段何时仍要保留、何时可以回收。',
    view: '一个共享段，三个进程',
    context: 'PostgreSQL 18 · 普通未固定 DSM 段',
    source: dsmSource + '#L803',
    legend: '映射数是这个场景中仍 attach 的进程数。假设无段级 pin、无其他映射，并且底层释放成功。',
    initial: { mapped: [], detached: [], segment: 'absent', focus: 'leader' },
    steps: [
      step(null, '任务即将开始', 'Leader 准备一块本次任务共用的动态共享内存。两个 Worker 尚未挂载。'),
      step('创建 DSM 段', 'Leader 创建并挂载', 'dsm_create() 返回本进程的映射。Leader 把段的 handle 交给 Worker，它们可以用同一个 handle 找到同一段。', { mapped: ['leader'], segment: 'alive', focus: 'leader' }),
      step('挂载 Worker A', 'Worker A 通过 handle 挂载', 'Worker A 用 dsm_attach() 得到自己的映射。两个进程的虚拟地址可以不同，访问的是同一块共享数据。', { mapped: ['leader', 'worker-a'], focus: 'worker-a' }),
      step('挂载 Worker B', '三个进程共享一个段', 'Worker B 也完成挂载。每个进程各有一份映射，段里仍只有一份共享数据。', { mapped: ['leader', 'worker-a', 'worker-b'], focus: 'worker-b' }),
      step('分离 Leader', '创建者离开，段仍保留', 'Leader 解除自己的映射。两个 Worker 仍持有引用，因此它们可以继续访问这个段。', { mapped: ['worker-a', 'worker-b'], detached: ['leader'], focus: 'leader' }),
      step('分离 Worker A', '只剩 Worker B', 'Worker A 解除自己的映射。Worker B 仍在使用该段，回收条件还未满足。', { mapped: ['worker-b'], detached: ['leader', 'worker-a'], focus: 'worker-a' }),
      step('分离 Worker B', '最后一份映射离开', 'Worker B 分离后，没有其他进程映射这个段，也没有段级 pin。DSM 可以回收，原 handle 不再指向可挂载的段。', { mapped: [], detached: ['leader', 'worker-a', 'worker-b'], segment: 'released', focus: 'segment' })
    ]
  },
  [moduleKey + '/online']: {
    label: title,
    module: moduleKey,
    scene: '对照：假设在线扩容',
    title: '在线换布局，旧引用怎么办',
    summary: '假设运行中的实例能准备一份更大的共享结构。观察旧布局要等到什么时候才能释放。',
    view: '新旧布局的引用交接',
    context: '假设模型 · 只示意引用与回收',
    source: configSource,
    legend: '这是双布局迁移的教学对照。真实 PostgreSQL 通过实例重启应用这个配置，图中也省略了在线方案所需的数据同步和故障处理。',
    initial: { backendA: 'old', backendB: 'old', oldLayout: 'alive', newLayout: 'absent', focus: 'old' },
    steps: [
      step(null, '两个 Backend 都在用旧布局', 'A 和 B 各自持有指向旧共享结构的引用。现在尝试为同一组共享状态准备一个更大的布局。'),
      step('准备更大的布局', '新内存已经准备好', '假设新布局已完成初始化和所需的状态准备。两条引用仍指向旧布局。', { newLayout: 'ready', focus: 'new' }),
      step('让 A 切换', 'A 已切换，B 还持有旧引用', 'A 到达切换点并转向新布局。B 还没有到达切换点，旧布局必须继续存在。', { backendA: 'new', focus: 'b' }),
      step('让 B 切换', '两条引用都指向新布局', 'B 到达切换点，也释放了旧引用。此时这两个参与者都已经完成切换。', { backendB: 'new', focus: 'b' }),
      step('回收旧布局', '旧布局可以释放', '确认已无旧引用后，才可以回收旧布局。真正的在线协议还需要防止切换期间产生新的旧引用。', { oldLayout: 'released', focus: 'old' })
    ]
  }
};

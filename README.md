# PostgreSQL Internals Explorer

交互式演示 PostgreSQL 内核各模块的工作机制。

首页是一张固定的运行拓扑。选择负载后，可以观察 SQL 请求、缓冲页副本、WAL 记录和后台 I/O 随事件变化。点选拓扑中的模块可查看它的当前状态，并进入对应机制演示。

| 模块 | 演示内容 |
| --- | --- |
| Shared Buffers | 缓冲映射、Pin、Usage count、CLOCK-sweep |
| WAL 与检查点 | WAL 插入、同步提交、数据页写出与文件同步 |
| MVCC | 同一次更新在新旧快照中的可见性 |
| Heap Page / HOT | 行指针、HOT 链、索引入口、页内剪枝 |
| VACUUM | 老快照、索引清理与行指针槽复用 |

全局负载和模块步骤是基于 PostgreSQL 18 的确定性教学模型。模型中的帧数、LSN 和事件间隔均为示例值。模块页链接到相应的 PostgreSQL 文档或源码说明。

## 本地运行

```sh
python3 -m http.server 4173
```

打开 <http://localhost:4173/>。需要 Python 3，无需安装前端依赖。使用 Node.js 执行 `node --test` 可检查事件引用与提交、写页、文件同步的状态边界。

## 发布与主页接入

GitHub Pages 从 `main` 的仓库根目录发布即可。页面使用相对资源路径，可部署在项目子路径。项目根目录的 `homepage.json` 声明工具入口，个人主页在重新同步项目目录并部署后即可读取。

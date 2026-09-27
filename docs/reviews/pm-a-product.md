# DSH 插件评审 · 产品经理 A（用户价值视角）

评审对象：dsh-websearch 2.7.0 / dsh-message-ops 0.2.0 / dsh-session-lazy-view 0.2.0 / dsh-devkit 0.1.0
评审人：pm-product-a · 视角：目标用户、场景价值、可发现性、设置与命名体验、旅程断点
方法：全部结论基于本地源码与 README 通读，证据标注 file:line。

---

## 一、逐插件评估（六维度，1–5 分）

### 1. dsh-websearch v2.7.0

| 维度 | 分 | 证据与说明 |
|---|---|---|
| 目标用户与核心场景 | 5 | 每个 web 会话都会触发搜索，是四个插件里唯一「日常高频、不可缺席」的场景。零配置（4 个无 key 后端）让首用即成功：README.md:8,14。 |
| 功能完整度 vs MVP | 4 | v2.7 三功能均为默认开、保守值、不改变既有语义（README.md:118-141）；熔断器 fail-open 设计（breaker.js:8-10「can never make search WORSE」）体现了正确的克制，无 YAGNI 违例。小瑕疵：history 环形 50 条 + 两个 HTTP 端点目前没有任何 UI 消费方，属「有 API 无用户旅程」。 |
| 可发现性 | 4 | 设置入口是顶级分区「搜索 / Web Search」（README.md:75，client.js:556 注入 settings.section），新手可找到。但 `/api/websearch/history` 是纯开发者接口，面板/命令面板均无入口，普通用户不知道它的存在。 |
| 设置体验 | 4 | 6 个新设置项命名直白（cacheEnabled/breakerEnabled/historyEnabled，index.js:155-165），默认值保守，`cacheTtl` 描述还主动解释了「0 语义请直接关闭 cacheEnabled」（index.js:158）——很贴心。扣分点：`breakerThreshold`/`breakerCooldownMs` 对新手偏术语化，描述未解释「熔断」对用户的可感知效果。 |
| 命名与心智模型 | 4 | `/api/websearch/history`、`/api/websearch/history/clear` 与其他插件 `/api/<插件名>/*` 一致；遥测行 `[websearch backends]` / `[websearch cache]`（README.md:96,126）格式统一，模型可自诊断。 |
| 用户旅程断点 | 3 | 关键断点在安装后接线：README.md:59-71 要求用户手改 profile 的 cordis.patch.yml 才能把内置 web_search 指向 unified——这是所有插件里最重的一步手工配置，非技术用户在此流失。 |

**P0/P1 建议**
- **P0**：把「切换到 unified 搜索」做成设置页一键开关（插件自己写 patch 行或给出复制即用的完整 yaml 块），消灭手改 patch 的断点。
- **P1**：给搜索历史一个可见出口——例如设置页「最近搜索」折叠区读 `/api/websearch/history`，或注册为 devkit 命令「查看搜索历史」。

### 2. dsh-message-ops v0.2.0

| 维度 | 分 | 证据与说明 |
|---|---|---|
| 目标用户与核心场景 | 4 | 「说错话想反悔 / 对话跑偏想分叉 / 导出留档」是真实中频场景；会话头部按钮 + 侧栏菜单双入口（README.md:3-4）贴合使用时刻。 |
| 功能完整度 vs MVP | 4 | 最大亮点是 restore 的预期管理：引擎能力查证写进 ops-core.js:5-18 头注释，README.md:67-85 明确「恢复是重放而非解除遮蔽」并给出语义差异四条（新 seq、新时间戳、`[恢复]` 前缀、中间上下文不抹）+ 替代方案（用 branch 干净分叉）。这是对用户预期最诚实的处理。缺口：restore 的 UI 端预期提示尚未逐条落在确认对话框里（见断点）。 |
| 可发现性 | 3 | 回滚/删除/分支有按钮入口；但 restore 只能通过「选中一次 revert/delete 标记事件的 seq」触达（README.md:69-70），普通用户不知道标记事件是什么、seq 从哪看；agent 工具 `message_ops` 依赖 dsh-tools 装载，用户侧不可见。 |
| 设置体验 | 3 | 无设置项——对本插件合理（操作型插件），风险确认已内置（README.md:33）。给 3 分为中性。 |
| 命名与心智模型 | 4 | `/api/message-ops/*` 六端点动词清晰（revert/delete/branch/restore/export 与 UI 概念一一对应）；OpsError 带语义状态码（ops-core.js:20-24）HTTP 直接映射；工具描述英文准确（index.js:176）。唯一别扭：README 标题说「三合一」但实际 0.2.0 已是五操作，心智模型略滞后于功能。 |
| 用户旅程断点 | 3 | 断点在「破坏性操作的心理门槛」与「restore 的 seq 认知门槛」：回滚/删除需勾选风险确认（README.md:33）是必要摩擦，但 restore 弹窗里若不内联解释重放语义，用户恢复后会因「消息带 [恢复] 前缀、seq 变了」而困惑，产生不信任流失。 |

**P0/P1 建议**
- **P0**：restore 确认对话框内联重放语义说明（新 seq / `[恢复]` 前缀 / 不可重放事件计数），把 README 的诚实搬到 UI。
- **P1**：消息列表把 revert/delete 标记事件渲染成可点的「恢复此操作」按钮，消灭「找 seq」的认知负担。

### 3. dsh-session-lazy-view v0.2.0

| 维度 | 分 | 证据与说明 |
|---|---|---|
| 目标用户与核心场景 | 3 | 「不打开整份会话日志，瞄一眼最近发生了什么 / 在大会话里找一句话」是真实但偏开发者/排障的低频场景；对大文件的成本优势（成本与文件总大小无关，README.md:11-14）是清晰价值点。 |
| 功能完整度 vs MVP | 4 | v0.2 三功能（search/stats/export）全部保持纯只读零写入（README.md:86-90），已知限制诚实列出（README.md:66-75），性能取舍写明（README.md:105-115）——边界感极好，无过度设计。 |
| 可发现性 | 2 | **全场最差**：面板是独立 URL `/lazyview`，主界面没有任何入口（无侧栏项、无会话行按钮、未注册 devkit 命令）。用户必须「知道这个插件装了 + 记住 URL」才能用第一次。index.js:182-228 全部端点都只能从面板 HTML 或手输 URL 触达。 |
| 设置体验 | 3 | 无设置项；对纯只读工具可接受。 |
| 命名与心智模型 | 3 | `/lazyview/api/*` 前缀风格与其余三家的 `/api/<插件名>/*` 不一致，开发者需要记两套路由心智；端点命名（tail/search/stats/export）本身清晰。 |
| 用户旅程断点 | 2 | 双重断点：① 安装要手改 cordis.patch.yml（README.md:38-48，方式 B/C 更繁琐）；② 装完没有任何入口提醒去 `/lazyview`。发现→首用在多数用户身上会直接断掉。 |

**P0/P1 建议**
- **P0**：注册一条 devkit 命令「打开会话查看器」（或会话行右键菜单项），让面板从命令面板可达；同时安装后 Toast 提示 `/lazyview` URL。
- **P1**：路由改 `/api/lazyview/*` 对齐生态惯例（保留旧路径 301 兼容）。

### 4. dsh-devkit v0.1.0

| 维度 | 分 | 证据与说明 |
|---|---|---|
| 目标用户与核心场景 | 4 | 高频键盘用户的效率场景 + 全体插件的统一入口层。Ctrl+K 命令面板是已验证的心智模型（VS Code），移植判断正确（README.md:32）。 |
| 功能完整度 vs MVP | 4 | 面板/和弦/Toast/devinfo 四件套 + registerCommand 贡献点（client.js:305-320），边界清晰；「侧边栏零改动」是用户明确的硬约束而非自作主张（README.md:30），产品判断成熟。依赖各插件时独立降级（README.md:90）。 |
| 可发现性 | 5 | 它本身就是可发现性的基础设施：Ctrl+K/Ctrl+Shift+P/会话头部 🔍 三入口（README.md:12），中英关键词过滤（client.js:150-153），无匹配提示快捷键。 |
| 设置体验 | 3 | 无设置项；和弦 1.5s 窗口、输入框豁免规则靠 README 解释，可考虑进速查表。 |
| 命名与心智模型 | 4 | 命令 id `devkit.session.*` 前缀规范（client.js:437-444），`window.__dshDevkit` 全局命名明确；重复 id 抛错保证来源可追溯（README.md:59）。 |
| 用户旅程断点 | 4 | 安装即刷新可用，摩擦最低。断点在**跨插件集成的完整性**：`devkit.websearch.settings` 派发 `dsh-websearch:open-settings`（client.js:431），但 **websearch 的 client.js 没有任何监听者**（grep 无 CustomEvent/addEventListener）——这条命令目前点了没反应；message-ops 侧则有真实监听（dsh-message-ops/src/client.js:26,406），同类命令一好一坏，用户会归因为「devkit 不靠谱」。 |

**P0/P1 建议**
- **P0**：修复 `dsh-websearch:open-settings` 事件无人监听的问题（websearch client.js 加监听，或 devkit 改为直接打开设置页 URL），死命令最伤「统一入口」的信任。
- **P1**：把 slv 的 `/lazyview`、websearch 的 `/api/websearch/history` 收编为面板命令，让 devkit 成为四插件事实上的统一入口。

---

## 二、市场与竞品对照（pm-product-b 合并节）

### 竞品 / 替代品结论

| 插件 | 竞品/替代 | 结论 |
|---|---|---|
| dsh-websearch | 官方 dsh-web / dsh-web-search-deepseek；生态内各家单后端 provider 插件 | **护城河明确**：11 后端 fan-out + URL 去重 + 熔断 + 缓存的组合在生态内无对应物；单后端插件（如 dav web-search-deepseek）只覆盖一路且无降级。风险是官方若内置多后端聚合则被收编——先发 + 遥测自诊断是差异化。 |
| dsh-message-ops | DSH 原生无消息级回滚；Trajectory 类工具做导出不做写操作 | **近乎独占**：surface-replace 语义约束下的安全回滚/分支没有已知同类；restore 重放语义是引擎限制下的诚实妥协，不是竞品劣势。 |
| dsh-session-lazy-view | archived-sessions（列会话不解压）、export_bundle/import_chat（CLI 侧） | **差异化在「惰性」与 web 面板**：tail 只解压末帧的能力无人做；但 CLI 侧工具（scan_discover、export_bundle）覆盖了部分需求，web 面板的不可发现性让差异优势打折扣。 |
| dsh-devkit | VS Code 心智的命令面板在 DSH 生态无先例；better-sidebar 等侧栏插件做的是导航不是命令层 | **先发定义品类**：贡献点 registerCommand 若被 message-ops/websearch/slv 采纳，即成为生态的命令基础设施——网络效应一旦形成很难被替换。当前风险是贡献点尚无第三方消费者。 |

### dshmarket 上架就绪度

对照 manifest 契约（aggregation-weball.md §4：`{ id, name, rank, nameEn, author, description, descriptionEn, repo, npm?, category, subcategory }`，npm 字段可选、有则显示下载量并走 pluginManager 安装通路）：

| 插件 | npm 已发布 | repo | 中英双描述 | 就绪度 | 缺口 |
|---|---|---|---|---|---|
| dsh-websearch | ✅（npm badge + NPM_PUBLISH.md） | ✅ github.com/240xu/dsh-websearch | ⚠️ description 仅英文 | **高** | 提 manifest 条目时补 descriptionEn/中文名即可；keywords 完整（package.json:17-30）利于检索 |
| dsh-message-ops | ✅（README 安装命令用 npm 名） | ✅ | ⚠️ description 仅英文 | **高** | 同上；category 建议「会话工具」 |
| dsh-session-lazy-view | ✅（README 方式 A 用 npm 名） | ✅ | ⚠️ 仅中文 description | **中高** | 补英文名/描述；`engines: node>=24` 高于其余插件，manifest 备注里应写明避免差评 |
| dsh-devkit | ❌ README.md:70 明写「已发布 npm 包后」，即未发布 | ✅ | ⚠️ description 仅英文 | **低（阻塞）** | **未上 npm = 市场安装通路不可用**（NPM_SPEC 白名单只收 npm 名，file:// 被拒，aggregation-weball.md §4:49）；先发包再提条目 |

共性缺口：四包的 package.json description 都是单语，manifest 条目要求 nameEn + descriptionEn 双语，四家都需要在提条目时人工补写。建议在上架前统一补齐中英双语物料。

### 四个 release 的一句话主张（中英）

- **dsh-websearch 2.7.0**： eleven-backend search that gets faster when backends fail — cache, breaker, and history, all on by default.
  十一后端聚合搜索，越挫越强：磁盘缓存 + 熔断器 + 搜索历史，全部默认开。
- **dsh-message-ops 0.2.0**： revert, delete, branch, restore and export your conversation — safely, on the append-only log.
  回滚、删除、分支、恢复、导出五合一——在 append-only 日志上安全完成。
- **dsh-session-lazy-view 0.2.0**： peek into any session's recent frames in milliseconds, search it, export it — read-only, always.
  毫秒级窥探任意会话最近帧，可搜索、可导出——永远纯只读。
- **dsh-devkit 0.1.0**： the command palette DSH deserved — Ctrl+K for everything, a contribution point for every plugin.
  DSH 缺了很久的命令面板——Ctrl+K 触达一切，贡献点开放给每个插件。

---

## 三、总分表

| 插件 | 场景 | 完整度/MVP | 可发现性 | 设置体验 | 命名心智 | 旅程断点 | 均分 |
|---|---|---|---|---|---|---|---|
| dsh-websearch 2.7.0 | 5 | 4 | 4 | 4 | 4 | 3 | **4.0** |
| dsh-message-ops 0.2.0 | 4 | 4 | 3 | 3 | 4 | 3 | **3.5** |
| dsh-session-lazy-view 0.2.0 | 3 | 4 | 2 | 3 | 3 | 2 | **2.8** |
| dsh-devkit 0.1.0 | 4 | 4 | 5 | 3 | 4 | 4 | **4.0** |

## 四、最该先修的 3 件事

1. **P0 · devkit 死命令**：`devkit.websearch.settings` 派发的 `dsh-websearch:open-settings` 在 websearch client.js 中无任何监听者（devkit src/client.js:431 vs websearch lib/client.js 全文无该事件）——点了没反应直接摧毁「命令面板 = 统一入口」的信任。修复成本极低，收益是入口层信誉。
2. **P0 · slv 双断点**：安装需手改 cordis.patch.yml + 面板无主界面入口，是四插件中唯一「装了也几乎用不上」的产品。最小修法：注册一条 devkit 命令 + 安装后 Toast 提示 `/lazyview`。
3. **P1 · devkit 上 npm**：dshmarket 安装通路（NPM_SPEC 白名单）只接受 npm 包名，devkit 未发布即被市场拒之门外；同时四包 manifest 条目所需的中英双语描述（nameEn/descriptionEn）应统一补齐，一次提齐四条上架。

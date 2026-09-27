# VS Code 功能图谱 → DSH 生态映射（vscode-parity）

> 作者：UX 研究员（dsh-plugin-hub 专家组）。目标：把 VS Code / JetBrains / Cursor 等成熟 IDE 中「对 agent-harness 用户高度友好」的功能系统化整理，映射到 DSH 生态，给出可执行的插件规划。
>
> **硬约束前提**：
> - DSH 是 "Everything is a Plugin" 的 agent harness，web 端 `http://127.0.0.1:3080`。
> - 现有生态：better-sidebar（文件/终端/Git/侧边对话/子代理页——**侧边栏注册面已被用户锁定，禁止扩展**）、chat-import（历史导入）、websearch（v2.7 在途：缓存/熔断/历史）、message-ops（回滚/删除/分支）、session-lazy-view（惰性查看）、session-delete、devkit（在途：VS Code 式命令面板 + 快捷键 + toast）。
> - 插件可用兼容面：`shell.overlay` 槽、`conversation.session.header.actions` 槽、自持 HTTP 端点、`defineTool`（agent 工具）、设置段注册。
> - **禁区**：侧边栏注册面（better-sidebar 已锁定）。本文所有建议均不依赖侧边栏。

每节结构：**VS Code 功能 → DSH 现状 → 差距 → 建议 → 优先级 → 依赖的兼容面**。

---

## 1. 命令面板范式（Command Palette / Quick Open）

### VS Code 侧功能细节

- **模糊匹配 + 排序**：Quick Open / 文件搜索是 fzf 风格模糊匹配；命令面板历史上刻意按名称排序保持结果稳定可记忆（见 vscode#1964 官方讨论），而文件检索按模糊得分排序。两者是不同 trade-off。
- **模式前缀**：`>` 执行命令、`@` 跳符号、`#` 全工作区符号、`:` 跳行号、无前缀 = 文件模糊搜索；Visual Studio 的 Go To 也用前缀/图标切换过滤（见 Go To 文档的前缀表）。
- **最近使用优先（MRU）**：命令面板与 `Ctrl+Tab` 编辑器切换都把最近使用项排前。
- **Chords 快捷键**：`Ctrl+K Ctrl+W` 等两段式键位，`when` 子句控制上下文（见 keybindings 文档）。
- **UX 规范**：命令命名带分类前缀（如 "GitHub Issues: ..."）、合适的默认键位、不用 emoji（见 extension UX guidelines - Command Palette）。

### DSH 现状

devkit 在途，包含 VS Code 式命令面板 + 快捷键 + toast。目前仅此一处统一入口；无模式前缀体系、无 MRU、无 chord。

### 差距 → 建议

| 建议 | 归属 | 说明 |
|---|---|---|
| 模式前缀路由 | devkit | `>` 命令；`@` 会话内消息锚点；`#` 跨会话搜索（接 dsh-session-search，见 §3）；`:` 跳消息序号 |
| MRU 记忆 | devkit | 命令执行频次/最近时间本地持久化（localStorage 或插件自持端点），排序 = f(得分, MRU) |
| fzf 风格打分 | devkit | 子序列匹配 + 连续段/词首加分；命令保持名称稳定排序（沿用 VS Code 官方决策理由） |
| Chords 键位 | devkit | `Ctrl+K` 前缀段 + when 化作用域（面板打开时/会话页时） |

### 优先级

- **P0**：模式前缀 + MRU（devkit v2 核心，直接提升所有插件的可达性）。
- **P1**：chords。**P2**：命令分类前缀规范（文档约定即可）。

### 兼容面

全部走 `shell.overlay` + 设置段注册 + 自持端点。**不依赖侧边栏**。

### 来源

- https://github.com/microsoft/vscode/issues/1964 （命令面板模糊搜索与排序 trade-off，官方回复）
- https://code.visualstudio.com/api/ux-guidelines/command-palette
- https://code.visualstudio.com/docs/configure/keybindings （键位规则、chords、when 子句）
- https://learn.microsoft.com/en-us/visualstudio/ide/go-to?view=visualstudio （Go To 前缀过滤范式）

---

## 2. 编辑器体验（多标签 / diff / breadcrumb / minimap / Zen / 分屏）

### VS Code 侧功能细节

- **多标签 + 编辑器组**：`Ctrl+Tab` 在组内按 MRU 切换；分屏（编辑器组）支持对照阅读。
- **Diff 编辑器**：并排/内联两种模式，SCM 提交前审查必经（见 source control overview）。
- **Breadcrumbs**：编辑器上方的路径 + 符号层级，点击弹同级下拉快速跳转（见 Code Navigation）。
- **Minimap / Zen Mode**：minimap 为代码全景；Zen Mode 为无干扰全屏写作态。

### DSH 现状

对话主体是单一滚动流，better-sidebar 提供了文件/终端/Git 页但侧边栏不可再扩展。message-ops 的回滚对话框有消息级操作能力；无多视图、无对照、无 breadcrumb。

### 差距 → 建议

| VS Code 功能 | 映射到 DSH | 归属 | 说明 |
|---|---|---|---|
| 分屏/多标签 | 「会话对照视图」：overlay 全屏层左右分栏同时开两个会话（如原会话 vs 分支会话） | 新候选插件 `dsh-session-compare` | 跨会话 diff 消息树；message-ops 分支功能天然需要"看两个会话" |
| Diff 编辑器 | 消息级 diff 查看器（回滚前预览将被遮蔽的范围） | message-ops 增强 | 已有 surface replace 语义，补一个并排预览 |
| Breadcrumbs | 会话面包屑：profile → session → 分支链（parentSession）→ 当前消息 #n | devkit 或 `dsh-session-compare` | header.actions 槽放当前路径，点击弹兄弟分支下拉 |
| Minimap | 会话事件密度条（右侧细条标注 tool 调用/错误/回滚点，点击跳转） | session-lazy-view 增强 | lazy-view 已有帧扫描能力，天然适合 |
| Zen Mode | 阅读模式：隐藏一切 chrome，只留对话流 + 键位翻页 | devkit | 纯 CSS/overlay，成本低 |

### 优先级

- **P1**：会话对照视图（分支工作流刚需）、diff 预览（message-ops 安全性）。
- **P2**：密度条、面包屑、Zen Mode。

### 兼容面

全部 `shell.overlay` / header.actions。**不依赖侧边栏**。

### 来源

- https://code.visualstudio.com/docs/editing/editingevolved （breadcrumbs、Go to Symbol）
- https://code.visualstudio.com/docs/sourcecontrol/overview （diff 编辑器在提交审查中的角色）
- https://code.visualstudio.com/docs/core-editor/overview

---

## 3. 搜索体验（全局搜索 / Go to Symbol / Go to Definition）

### VS Code 侧功能细节

- **全局搜索**：跨文件搜索、按文件分组结果、展开预览命中行、正则 + include/exclude glob；Search Editor 把结果变成一个完整的独立视图（见 codebasics 文档）。
- **Go to Definition / Symbol**：符号级跳转、Peek 预览、`Ctrl+T` 工作区符号（见 Code Navigation）。
- **Go to File**：模糊文件名 + 路径模糊匹配。

### DSH 现状

跨会话全文搜索是明显空白：chat-import 能把历史导入为可继续会话，但"在所有历史里找一句话/一次报错"没有入口。session-lazy-view 提供按帧惰性解压查看最近事件——**它本身就是"帧扫描"基础设施**，只差一个索引层和查询层。websearch v2.7 在途的"历史"（搜索历史缓存）是另一种历史，不覆盖会话内容。

### 差距 → 建议

| VS Code 功能 | DSH 映射 | 归属 | 说明 |
|---|---|---|---|
| 全局搜索（跨文件分组） | **跨会话全文搜索**：按会话分组结果、展开预览命中消息帧 | 新候选插件 `dsh-session-search` | 后台增量扫描 `~/.dsh/sessions` session.jsonl(.zstd)，建轻量倒排索引（会话 id + 帧 seq + 命中偏移），自持 HTTP 端点供查询；UI 走 overlay 全屏结果页（等价 Search Editor） |
| Go to Symbol | **Go to Session**：命令面板 `#` 前缀输入会话名/标题模糊跳转 | devkit × session-search | devkit 提供面板，session-search 提供数据源（插件间经自持端点协作） |
| Go to Definition | **Go to Message**：搜索结果点击 → lazy-view 定位到该帧并展开上下文 N 帧 | session-lazy-view 增强 | lazy-view 增加深链 `?session=..&frame=..&context=N` |
| Peek 预览 | 命中行上下文内联预览（不离开结果页） | session-search | 索引时存 ±3 行文本即可 |

### 优先级

- **P0**：跨会话全文搜索（dsh-session-search）——当前生态最大空白，且完全复用 lazy-view 的帧扫描底子，无侧边栏依赖。
- **P1**：Go to Session/Message 深链打通。

### 兼容面

自持 HTTP 端点（索引/查询）+ overlay（结果页）+ defineTool（把 `session_search` 暴露为 agent 工具，agent 自己也能查历史——这是 VS Code 没有的增量价值）。**不依赖侧边栏**。

### 来源

- https://github.com/microsoft/vscode-docs/blob/32cf423e3e727302480acb2aa4383dcda6febbcd/docs/editor/codebasics.md （全局搜索 + Search Editor）
- https://code.visualstudio.com/docs/editing/editingevolved （Go to Symbol/Definition、Peek）

---

## 4. 任务与终端（Tasks / Problems / Output）

### VS Code 侧功能细节

- **Tasks**：tasks.json 声明式任务运行器，`presentation` 控制输出面板 reveal/focus/panel 复用策略，`problemMatcher` 从输出中结构化抽取问题（见 tasks schema 附录）。
- **Problems 面板**：全工作区问题的统一聚合视图，可点击定位。
- **Output 通道**：多通道输出日志，按通道切换。

### DSH 现状

Agent 任务（后台 job、子代理、roundtable）在 web 端可见性弱：job 列表/输出分散，失败要翻日志。无"问题聚合"概念——但 DSH 天然有一个对应物：**会话流里的错误/重试/审批事件**。

### 差距 → 建议

| VS Code 功能 | DSH 映射 | 归属 | 说明 |
|---|---|---|---|
| Output 通道 | 任务输出聚合页：所有运行中 job / 子代理的输出流式视图，多任务 tab 切换 | 新候选插件 `dsh-task-panel` 或 devkit 扩展 | 自持端点代理 job_output 轮询；overlay 抽屉层 |
| Problems 面板 | **会话问题聚合**：扫描当前/最近会话的 tool error、exit code≠0、审批拒绝，聚合成可点击列表 → 跳转消息帧 | session-search 附带能力或 `dsh-task-panel` | 与 §3 共用索引；problemMatcher 的角色由规则（正则匹配错误行）承担 |
| Tasks reveal 策略 | 任务完成 toast + 可选自动展开 | devkit | 事件驱动：job 完成/失败推 toast（devkit 已有 toast），点击进任务页 |

### 优先级

- **P1**：任务输出聚合页（多 job 并行时刚需）。
- **P2**：会话问题聚合。

### 兼容面

自持 HTTP 端点 + overlay + devkit toast 事件。**不依赖侧边栏**。

### 来源

- https://code.visualstudio.com/docs/reference/tasks-appendix （tasks.json schema、presentation/problemMatcher）
- https://github.com/microsoft/vscode-docs-archive/blob/main/docs/editor/tasks.md

---

## 5. Git/历史（Timeline / blame / SCM gutter）

### VS Code 侧功能细节

- **Timeline 视图**：当前文件的时序事件流（Git 提交 + 本地保存），支持类型过滤、输入即筛选、点击提交开 diff；timeline source 可被扩展贡献（见 1.44 release notes + history 文档）。
- **Source Control Graph**：分支/提交图谱，incoming/outgoing 标注。
- **Git blame / gutter 装饰**：行级作者标注、行变更 gutter 标记，点击展开内联 diff。

### DSH 现状

DSH 会话日志是 **append-only 时间线**——语义上与 Git 历史同构：每帧事件 ≈ commit，message-ops 的回滚 = revert（surface replace 遮蔽而非删除，可恢复），message-ops 的分支 = branch（parentSession 关联）。session-lazy-view 已经能按帧解压时间线，底子完全齐备；缺的是"时间线视图 + blame + diff"三件套的 UI。

### 差距 → 建议

| VS Code 功能 | DSH 映射 | 归属 | 说明 |
|---|---|---|---|
| Timeline | 会话 Timeline 页：帧序列按角色（user/assistant/tool）/类型着色，输入即筛，点击跳帧 | session-lazy-view 增强（它已有帧扫描） | lazy-view 从"查看器"升级为"时间线浏览器"，深链复用 §3 的 `?frame=` |
| Git blame | **消息 blame**：任一消息标注来源（本会话产生 / chat-import 导入 / 分支 parentSession / 回滚遮蔽恢复） | message-ops + lazy-view 协作 | message-ops 持有遮蔽/分支元数据，lazy-view 渲染 |
| SCM gutter + 点击 diff | 帧间 diff：时间线上相邻两帧或任意两帧开并排 diff | `dsh-session-compare`（§2） | 同一 diff 组件复用 |
| Source Control Graph | 分支谱系图：parentSession 树可视化 | message-ops 增强 | P2 |

### 优先级

- **P0**：Timeline 升级 lazy-view（成本低、复用度最高）。
- **P1**：消息 blame；**P2**：分支谱系图。

### 兼容面

自持端点（读 session.jsonl[.zstd]）+ overlay。**不依赖侧边栏**。

### 来源

- https://code.visualstudio.com/docs/sourcecontrol/history （Timeline / blame / Graph）
- https://code.visualstudio.com/updates/v1_44 （Timeline 视图设计细节、可扩展 timeline source）

---

## 6. 协作/其他（Settings Sync / Profiles / Keybindings 编辑器 / Snippets）

### VS Code 侧功能细节

- **Settings Sync**：跨机同步 settings/keybindings/snippets/tasks/UI state/extensions/profiles；machine 域设置默认不同步（见 settings-sync 文档）。
- **Profiles**：命名的配置集（设置+扩展+键位+**MCP servers**+snippets+tasks），一键切换，可与 Sync 配合跨机迁移（见 profiles 文档）。
- **Keybindings 编辑器**：可视化搜索 + 改键 + when 子句。
- **Snippets**：前缀触发的模板插入，出现在补全与专用 picker 中。

### DSH 现状

DSH 有 profile 概念（`dsh plugin --profile <profile>`），但插件清单/配置在不同机器（本机 Termux ↔ Windows）间靠 hub README 手工记录；无同步、无键位编辑器（devkit 在途会带来键位）、无提示词片段管理。

### 差距 → 建议

| VS Code 功能 | DSH 映射 | 归属 | 说明 |
|---|---|---|---|
| Settings Sync | **插件清单导出/导入**：一键导出 `dsh plugin list` 为 manifest（hub README 已是半人工版），另一端导入恢复 | CLI 侧工具或新候选 `dsh-profile-sync` | Web 端做导出按钮 + 文件/二维码；machine 域（路径类配置）默认排除——对齐 VS Code machine-settings 语义 |
| Profiles | 会话工作档：把"插件组合 + 常用 prompt + 默认模型"存为命名 profile，命令面板一键切换 | devkit + 设置段 | 呼应 DSH 自身 profile 体系 |
| Keybindings 编辑器 | devkit 快捷键设置页内搜索改键（在途功能补全方向） | devkit | P2 |
| Snippets | **Prompt Snippets**：常用提示词片段库，命令面板 Insert Snippet 式插入输入框 | 新候选 `dsh-prompt-snippets` | 若输入框注入面不可用则降级为"复制到剪贴板"；defineTool 也可让 agent 调用片段库 |

### 优先级

- **P1**：插件清单导出/导入（跨机体验痛点，hub README 已验证需求）。
- **P2**：Prompt Snippets、Profiles、键位编辑器。

### 兼容面

设置段注册 + 自持端点 + devkit 命令面板。**不依赖侧边栏**。

### 来源

- https://code.visualstudio.com/docs/configure/settings-sync
- https://code.visualstudio.com/docs/configure/profiles
- https://code.visualstudio.com/docs/configure/keybindings
- https://code.visualstudio.com/docs/editing/userdefinedsnippets

---

## 下一轮 3 个最值得做的（推荐）

1. **`dsh-session-search`（跨会话全文搜索）— P0**
   理由：整个生态最大的功能空白。用户已有几十个历史会话（chat-import 还在持续导入更多），"找不到之前那次排查"是日常痛点；session-lazy-view 的帧扫描已解决"大会话解压贵"的问题，索引层只需在其上做增量缓存，工程风险低。且能通过 defineTool 把搜索暴露给 agent，形成 VS Code 没有的差异化。

2. **session-lazy-view 升级为 Timeline 浏览器 + Go to Message 深链 — P0**
   理由：与 #1 共享索引与深链协议（`?session=&frame=&context=`），一次打通 §3 与 §5 两章；append-only 时间线 + message-ops 的回滚/分支语义已经齐备，只差渲染层，性价比最高。

3. **devkit 命令面板加模式前缀 + MRU — P0**
   理由：devkit 在途是所有插件的统一入口，前缀体系（`>` 命令 / `@` 消息 / `#` 会话搜索 / `:` 行号）决定后续每个插件的可达性；MRU 是 VS Code 官方验证过的易学性关键。现在定协议成本最低，晚了就要各插件各自造入口。

（三者构成一条主线：**搜索 → 时间线 → 面板入口**，互相引用、无侧边栏依赖、全部落在已验证的兼容面上。）

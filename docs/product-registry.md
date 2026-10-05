# @240xu 六包产品登记册（product-registry）

> **定位**：后续所有产品评估的基线文档。常驻产品经理维护，每轮评审先读本表、再评增量。
> **范围**：dsh-websearch / dsh-message-ops / dsh-session-lazy-view / dsh-devkit / dsh-session-search / dsh-suite。
> **来源**：要点合并自 `reviews/pm-a-product.md`（产品 A：场景/可发现性/旅程六维）与 `reviews/pm-b-market.md`（市场 B：竞品/叙事/就绪度），标注 [A]/[B]；断点状态以本登记册为准（评审时点之后的新版本可能已修复，标「待复核」）。
> **维护规则**：版本号每轮核实 package.json；断点条目只增不删，修复后改状态不抹历史（保留用户实测证据链）。
> **R2 更新（真实反馈驱动轮）**：登记用户真实信号（REQ-1 查全查多、UPB-1 销账）；六包版本刷新（websearch 2.8.0 在途）；销账 3 项（devkit 死命令 ✅、CHANGELOG 断档 ✅、一键接线 ❌ 仍开放）；新增 websearch 2.8.0 用户价值说明（§1，供 README 引用）。
> **R3 更新（0.3.x/0.4.0 叙事刷新 + 断点复查）**：message-ops 0.3.0–0.3.2 三连发（官方 assistant-actions 槽原生回撤按钮、opencode 式一键、去重官方 branch、官方图标、Playwright 实测全过），0.4.0 在途（composer 回填+回撤 dock）；websearch 2.8.1 含 SettingsForms 真适配（0.2.0 设置面板有完整表单——大卖点）；**UPB-2 关闭、一键接线自动（销账）、restore UI 语义销账（0.3.0）**；新增 UPB-3（dsh-message-edit 三方崩溃，处置建议：禁用互斥）；suite 0.1.3 依赖出列 devkit（观察 OB-2）。

---

## ⚡ 最高优先级栏目：用户可感知断点（User-Perceivable Breakpoints）

> 定义：用户装了插件但**得不到承诺的结果**，或承诺的结果与实际行为不符。这类断点跳过一切评分直接置顶上报。
> 跟进 SOP：用户实测反馈 → 定位根因 → 修复发版 → 本表登记（含根因与验证方式）→ 下一轮冒烟复核。

| # | 状态 | 断点 | 根因 | 修复 | 验证 |
|---|---|---|---|---|---|
| UPB-1 | ✅ 已修复（0.2.3）→ R2 销账 | **message-ops「没生效」**：用户实测插件对最新会话无效 | DSH 已升级 v4 持久化（`session.v4.jsonl.zstd`），`findSessionDirs` 只探测 v3 → 最新会话全部 "session log not found"；旧单帧 `session.jsonl.zstd` 读取路径还会直接崩 | 0.2.3 探测序列改 **v4→v3→旧单帧**，读取统一逐行扫描路径，分支写回沿用原格式版本（README §0.2.3） | 40 项测试全绿 + 真实 v4 会话日志实测通过；0.2.4 已发（toast 收尾）；**R2：未再收到同类报告，销账** |
| UPB-2 | ✅ 已关闭（R3） | **suite 子包依赖未安装**：suitetest profile 子包缺失、suite 端到端从未验证 | link: 安装后未跑 `pnpm install` 级联解析依赖 | suite 0.1.1–0.1.3 补齐：caret 刷新到当前版本（2.7.3/0.2.3/0.3.1/0.2.3/0.1.2），suite 目录 pnpm install + 端到端矩阵（含 .pnpm 副本故障注入、standalone 共存）全过，见 suite README「端到端验证结果」 | 端到端验证表 6 项全 ✅；R3 销账。后续观察：0.1.3 依赖表已收敛为**四个子包（devkit 出列）**，见 OB-2 |
| UPB-3 | 🆕 R3 登记（lead 通报；本机无该包源码，登记于 §四.C） | **dsh-message-edit（三方插件）崩溃**：与 message-ops 同装时用户遭遇崩溃 | 三方插件与 message-ops 0.3.x 竞争同一官方槽位（`conversation.chat.assistant-actions`），双注入冲突 | **处置建议：禁用其一（保 message-ops）**——0.3.x 槽按钮已覆盖 message-edit 的核心场景（AI 消息旁回撤），且有 Playwright 实测 + 官方图标 + toast 反馈；产品侧应在 message-ops README 写明「与 message-edit 类槽位插件互斥」，检测到同装时 toast 提示 | 待 message-ops 加同装探测后复核 |

**历史教训沉淀**（评审断点 ≠ 用户断点）：架构评审的安全/性能项（围栏、渲染分批）重要但用户不可直接感知；用户断点的共同特征是「安装成功 + 首屏承诺 + 实际无结果」。凡用户报告「没生效/找不到/点不动」，默认按 UPB 流程走，不先怀疑用户操作。**R3 新教训：用户可感知断点不只来自自家 bug——三方插件在同一官方槽位上的冲突，用户会归因于后装的那个；生态位冲突要按 UPB 级别对待。**

### 用户需求表（真实反馈 → 产品语言）

| # | 用户原话 | 产品语言 | 承接 | 状态 |
|---|---|---|---|---|
| REQ-1 | 「websearch 要查多查全」 | 单次搜索的**覆盖面**不足：用户要的不是更大的 numResults，而是一次提问覆盖更多角度与更深来源——期望把一个查询改写成多个互补查询并发扇出、跨查询去重合并，得到一份「查全」的结果集，而非单一查询的前 N 条 | websearch 2.8.0（multiQuery RRF 融合 + deepCoverage 条数×1.5，**已发布**；双开关默认关、启发式从严、原查询全权重参与，门控依据 arXiv:2404.01037 防「盲目多查询劣化」——产品判断克制） | ✅ 已发布 2.8.0 |
| REQ-2 | 「message-ops 没生效」 | 即 UPB-1（格式兼容类用户断点） | 0.2.3 修复，0.2.4 跟进 toast 收尾 | ✅ 已闭环 |

---

## 一、六包登记

### 1. dsh-websearch — 当前 **2.8.1**（2.8.0 查全查多 + 2.8.1 SettingsForms 真适配）

- **目标用户**：所有 DSH web 会话的用户（搜索是日常高频动作）；重度用户配 key 解锁付费后端。 [A]
- **核心场景**：会话中触发 web_search → 11 后端并发扇出、URL 去重合并，部分后端宕机/缺 key 仍出结果；复杂问题可选 multiQuery/deepCoverage 查全查多。 [A]
- **一句话主张**（采 [B] §2 建议版）：零配置即可用的 DSH 聚合搜索——11 个后端并发兜底，部分宕机照样出结果。/ Zero-config aggregated web search for DSH — 11 backends fan out with caching, circuit breakers, and results even when backends go down.
- **R3 大卖点**：**0.2.0 设置面板有完整表单了**——2.8.1 把 Config 的 `meta.volatile` 标记修正（0.2.0 SettingsForms 的 volatileForm 只保留 volatile 字段，此前 websearch 表单为空），现整棵 Config 成为 0.2.0 表单（README §v2.8.1，裁决见 reviews/cross-settings-forms.md）。此前「0.1.7 无 shim 即无设置 UI」的兼容顾虑**随之销账**：三代宿主（0.1.5/0.1.7/0.2.0）均有可用设置面。
- **已知断点**：
  - ~~CHANGELOG 断档~~ **✅ 销账（R2）**：CHANGELOG.md 2.5.0 起无断档。
  - ~~一键接线~~ **✅ 销账（R3）**：cordis.patch.yml 现自带两行——insert 插件行 + 把内置 web_search 指向 unified（patch 注释原文「previously a manual cordis.patch.yml edit, now automatic」）；suite 0.1.2 起聚合路径同样自动接线。**遗留文档债（P2，OB-3）**：README 安装节 46-75 行仍写「只需在 cordis.patch.yml 里手改」的旧指引，与新现实矛盾，待改写。
  - 搜索历史 API 无 UI 出口（[A] P1；2.8.0 已给 history 加 backends 观测数组，devkit 收编仍是现成解法）。
- **下一步**：P0 改写 README 安装节对齐自动接线现实 / P1 history 收编进 devkit 面板命令 + 2.8.0 价值段进 README 首屏。

**websearch 2.8.0 用户价值说明（供 README 引用）**：

> **一次提问，查全查多。** 你问一个问题，不再只赌某一个搜索角度——2.8.0 会把你的问题自动改写成多个互补查询并发去搜（multiQuery），再把跨查询的结果合并、去重、按相关性排序（deepCoverage）。对你意味着三件事：① **少问第二次**：角度单一导致的关键遗漏明显减少，第一次就拿到更全面的结果集；② **来源更多样**：不同改写路径命中的是不同站点的不同页面，不再是一页结果反复换皮；③ **成本仍然可控**：多路查询只在你的问题确实复杂时展开，简单问题照旧单查直答，缓存与熔断语义不变。/ **Ask once, get it all.** Your question is rewritten into complementary queries fanned out in parallel, then merged and deduped across all of them — fewer critical misses on the first try, more diverse sources, and no extra cost for simple questions (multi-query only kicks in when it matters; cache and breaker semantics unchanged).

### 2. dsh-message-ops — 当前 **0.3.2**（0.3.0–0.3.2 三连发；0.4.0 在途）

- **目标用户**：对会话历史有「反悔/分叉/留档」需求的用户；以及要让 agent 自己动手改会话的进阶用户。 [A][B]
- **核心场景**：0.3.x 起从「对话框里的操作」升级为**就地操作**：每条 AI 消息旁的官方 `conversation.chat.assistant-actions` 槽原生回撤按钮，opencode 式一键回滚/删除（无对话框、devkit toast 反馈、宿主 chat store 原生响应即时呈现）；统一对话框仍在（侧栏入口，含恢复/导出/分支）；`message_ops` agent 工具六操作。 [A]
- **一句话主张（R3 升级版）**：**任意位置**回滚、删除、恢复你的会话——每条 AI 消息旁的原生按钮一键即达，而官方只有最后一条消息的分支按钮；模型也能自己动手（agent 工具），日志永远 append-only 可恢复。/ Roll back, delete, or restore any message from its own native action button — not just the official last-turn branch. The agent can do it too, and the log stays append-only.
- **叙事要点（vs 官方）**：官方 0.2.0 原生分支按钮仅限已完成轮次**最后一条**消息；message-ops 覆盖任意历史位置 + 回滚/删除/恢复三语义 + 非破坏承诺，去重处理已写明（0.3.0「与官方易混淆项」段）——README 明确差异，官方用户不会觉得重复造轮子。
- **已知断点**：
  - ~~UPB-1 v4 格式「没生效」~~ ✅ 销账（R2）。
  - ~~restore 确认弹窗未内联重放语义~~ **✅ 销账（R3）**：0.3.0「恢复（restore）补完」——选中 revert/delete 落定的 replace 标记行时对话框直接给恢复入口（README §0.3.0），「找 seq」认知负担消除。
  - **UPB-3 三方冲突**：与 dsh-message-edit 同装崩溃（见顶栏），处置建议禁用 message-edit；待加同装探测。
  - 0.x 心智需用「非破坏承诺」对冲（[B] 风险 2）；0.3.x 三连发后 README 首屏仍是「三合一」旧叙事——**P1 文档债**。
- **下一步**：P0 README 首屏升级为 R3 主张（原生槽按钮是第一眼卖点）/ P1 同装探测（message-edit 类冲突 toast）+ 0.4.0 composer 回填+回撤 dock 落地后更新场景表。

### 3. dsh-session-lazy-view — 当前 0.3.3（R2 刷新；源目录 ~/slv-check）

- **目标用户**：排查/巡检会话日志的开发者与重度用户；超大文件场景独占。 [A][B]
- **核心场景**：不碰整份 zstd 文件，秒开任意会话最近帧；会话内全文搜索、统计、导出 md、0.3.0 起 Timeline 视图（0.1.4 的 session-search「在 Timeline 打开」深链 `/lazyview?session=<id>&seq=` 已打通两包联动）。纯只读零写入。 [A]
- **一句话主张**（[B] 版）：10GB 会话文件也能秒开末尾——只解压最后几帧，绝不写会话目录。/ Peek at the tail of any DSH session file in milliseconds — decompresses only the last zstd frames, cost independent of file size, zero writes.
- **已知断点**：
  - 可发现性（[A] 评分 2）已在 0.2.1 缓解（复制链接 + devkit Ctrl+K 指引）；session-search 0.1.4 深链又添一入口——**基本缓解，devkit 命令注册仍待冒烟确认**。
  - 0.3.3 为可访问性补齐轮（README §v0.3.3）。
  - Node ≥24 最挑剔（[B] 风险 3），市场条目需备注；官方吸收风险：守「零写入 + 极端大文件」约束（[B] 风险 4）。
- **下一步**：P0 devkit 命令注册冒烟确认 / P1 Timeline 进 README 首屏（价值点未进首句）。

### 4. dsh-devkit — 当前 **0.2.7**（R3 刷新）

- **目标用户**：键盘效率用户；以及所有想进面板的插件作者（贡献点）。 [A][B]
- **核心场景**：Ctrl+K 命令面板统一触达会话操作、其他插件功能（消息操作、websearch 设置、session-search 面板）、快捷键速查、Toast；0.2.7 代已具备 >/#/@ 模式前缀 + MRU 最近使用（§四.4）。 [A]
- **一句话主张**（[B] 版）：给 DSH web 一个 Ctrl+K 命令面板——一条 `registerCommand`，让你装的每个插件都进面板。/ Ctrl+K for DSH web — a command palette and toast layer every plugin can plug into with one `registerCommand` call. Zero sidebar changes.
- **已知断点**：
  - ~~死命令~~ ✅ 销账（R2）；~~版本漂移~~ 0.2.3 守卫。
  - npm 发包状态与 README 截图占位（README:6-7 仍引 screenshot-palette.png 等占位、:71 仍写「已发布 npm 包后」）：**仍开放（[B] 🔴 项）**——R3 未复核到变化。
  - **R3 新观察（OB-2）**：suite 0.1.3 依赖表已把 devkit 出列（四依赖）——devkit 回归纯 standalone，发布与叙事需自站立；对「统一入口」卡位是好事（不被 suite 版本列车拖住），但市场安装通路（npm）更加是前置条件。
  - 0.x 心智：0.2.7 连发后 API 面趋于稳定，1.0 提上日程。
- **下一步**：P0 发包 + 真实截图（市场按钮被 npm 阻塞中）/ P1 slv 面板、websearch history、session-search 收编为内置命令。

### 5. dsh-session-search — 当前 0.1.4（R2 刷新）

- **目标用户**：记不清「这句话在哪次会话说过」的所有用户；agent 跨会话检索。 [A]
- **核心场景**：对全部历史会话建消息级全文索引，一条关键词查回 sessionId+seq+摘录；独立面板 `/api/session-search/panel`，devkit 装了可 Ctrl+K 直达；信任围栏与 message-ops 0.2.1 同款。 [A]
- **一句话主张**：一条关键词，查回所有历史会话的命中位置——本地索引、零依赖、对 sessions 目录零写入。/ One keyword, every past session — local full-text index over all DSH session logs, zero dependencies, zero writes to your sessions.
- **已知断点**：
  - 与 message-ops/slv 三处有意重复实现（fence / 帧扫描 / messageText），待 suite 聚合层收口（README 自认）——技术债不是用户断点，但拖慢三包联动升级（UPB-1 类修复要改三处）。
  - 首屏截图/En 描述等上架物料空白（[B] 共性）。
- **R2 增量**：0.1.4 命中项新增「在 Timeline 打开」深链直达 lazy-view `/lazyview?session=<id>&seq=<seq>`（README §v0.1.4）——跨包联动第一例，生态「一套」叙事有了实证。
- **下一步**：P0 随 suite 端到端验证一起冒烟 / P1 上架物料 + 「会话维护三件套」叙事（[B] §5）。

### 6. dsh-suite — 当前 **0.1.3**（R3 刷新；UPB-2 已关闭）

- **目标用户**：想一次装齐 @240xu 全家的新用户；逐行开关/回滚的谨慎用户。 [A]
- **核心场景**：一条 `dsh plugin add @240xu/dsh-suite` 装齐子包 + x240-* family 行；shell 壳单行故障隔离；逐行 disable 回滚；**web 入口自动接线（searchProvider: unified，0.1.2 起）**。 [A]
- **一句话主张**：一键装齐 @240xu 插件全家——单插件故障只降级自己，逐行开关即回滚，搜索入口自动接好。/ Install the @240xu plugin family in one command — per-row fault isolation, per-row enable/disable, instant rollback, and the search provider wired automatically.
- **已知断点/观察**：
  - ~~UPB-2 依赖未装/端到端未验证~~ **✅ 关闭（R3）**：0.1.1–0.1.3 端到端矩阵全过（含 .pnpm 副本故障注入、standalone 共存）。
  - **OB-2（R3）**：0.1.3 package.json 依赖收敛为**四个子包，devkit 出列**——README 首屏「五子包/装五包」表述与现实不符（P2 文档债）；产品含义：devkit 回归纯 standalone 自站立，suite 专注「搜索+会话三件套」的普通用户包，边界反而更清晰，但 README 与 manifest 描述需同步。
  - caret 区间下限随子包演进（websearch 已 ^2.8.0）。
- **下一步**：P0 README/manifest 对齐四子包现实 / P1 发布后接管安装 CTA（[B] §5「一套」叙事）。

### R3（叙事刷新 + 断点复查）记录 — 见 §三.R3

---

## 二、基线评分快照（来源 pm-a-product.md，评审对象为上轮版本）

| 插件 | 场景 | 完整度 | 可发现性 | 设置 | 命名 | 旅程 | 均分 |
|---|---|---|---|---|---|---|---|
| websearch 2.7.0 | 5 | 4 | 4 | 4 | 4 | 3 | 4.0 |
| message-ops 0.2.0 | 4 | 4 | 3 | 3 | 4 | 3 | 3.5 |
| slv 0.2.0 | 3 | 4 | 2 | 3 | 3 | 2 | 2.8 |
| devkit 0.1.0 | 4 | 4 | 5 | 3 | 4 | 4 | 4.0 |
| session-search / suite | — | 未评 | | | | | 下轮起纳入同表 |

市场就绪度（来源 pm-b-market.md §4）：websearch 🟡 / message-ops 🟡 / slv 🟡 / devkit 🔴（当时未发包+占位截图）；共性缺口：截图全缺、En description 全缺/过长、CHANGELOG 断档。

## 三、每轮固定动作（常驻 PM SOP）

1. **版本核实**：六包 package.json version 与上一轮登记值 diff，版本变了必看 CHANGELOG/README 增量。
2. **首屏扫描**：六包 README 首屏（主张是否仍是架构陈述、Node 门槛、安装步骤是否仍需手改 patch）。
3. **端点冒烟**（suitetest 或运行中实例）：逐包打 health/list 端点，记录状态码；suite 重点查 degraded 列表。
4. **断点上报**：发现用户可感知断点 → 顶栏 UPB 表登记 → send_message 报 lead；发现待复核项 → 逐条销账。

### R1（登记册创建轮）冒烟记录

- 环境：本机运行中的 `dsh web`（:3080）；suitetest profile 为 link 安装（suite + devkit）。
- `/api/websearch/history` 200 ✅；`/lazyview` 与 `/lazyview/api/list` 200 ✅；`/api/message-ops/messages?sessionId=x` 400（端点活、参数校验正常）✅。
- `/api/devkit/*`、`/api/session-search/panel`、`/api/dsh-suite/degraded` 均返回 401 unauthorized——信任围栏生效（curl 无 Origin 属预期拒答），**但注意**：`/api/message-ops/messages` 的 GET 对同样的 curl 放行（400），各包围栏对「无 Origin 的本机 GET」策略不一致——记 **观察 OB-1（P2）**：围栏行为不统一，外部工具按 README 消费 `/api/devkit/commands` 时会 401，与「供外部工具/文档消费」的声明冲突，需统一口径（要么 README 写明要求 Origin，要么 GET 白名单）。
- 断点 UPB-2 登记；R1 断点计数：UPB 1（新）+ OB 1 + 待复核 6。

### R2（真实反馈驱动轮）记录

- **版本核实**：message-ops 0.2.3→0.2.4、devkit 0.2.2→0.2.3、slv 0.3.2→0.3.3、session-search 0.1.2→0.1.4、suite 0.1.0 不变；websearch 本机 2.7.3、2.8.0 在途（package.json 未 bump，multiQuery/deepCoverage 尚无本机源码痕迹，以 lead 通报为准）。
- **用户信号**：REQ-1「要查多查全」登记需求表并转化为产品语言；UPB-1 销账；UPB-2 复查仍未修复。
- **销账 3 项**（证据见各包条目）：devkit 死命令 ✅（0.2.2 探测式派发 + websearch 2.7.1 ack 事件，lead 通报实测通过）、websearch CHANGELOG 断档 ✅（2.5.0–2.7.3 已补全至 2.0.5 无断档）、websearch 一键接线 ❌（README.md:59-65 仍手改指引，仍开放）。
- **R2 断点计数：UPB 开放 1 个（UPB-2）+ 开放断点 4 条（websearch 接线、websearch history 出口、message-ops restore UI、devkit 发包/截图）+ OB-1 持续。无新增用户可感知断点。**

### R3（0.3.x/0.4.0 叙事刷新 + 断点复查）记录

- **版本核实**（package.json 实测）：websearch **2.8.1**、message-ops **0.3.2**、devkit **0.2.7**、suite **0.1.3**、slv 0.3.3 不变、session-search 0.1.4 不变。
- **UPB 复查**：UPB-2 **关闭**（suite 0.1.1–0.1.3 端到端矩阵全过）；UPB-3 **新增**（dsh-message-edit 三方同装崩溃，处置建议禁用 message-edit 保 message-ops——0.3.x 槽按钮已覆盖其核心场景）。
- **销账 2 项**：websearch 一键接线 ✅（cordis.patch.yml 自带 unified 接线，patch 注释原文为证；suite 0.1.2 起聚合路径同样自动）；message-ops restore UI 语义 ✅（0.3.0 恢复补完，选中标记行即给恢复入口）。
- **大卖点登记**：websearch 2.8.1 SettingsForms 真适配（`meta.volatile` 修正，0.2.0 面板从空表单变完整表单）——三代宿主设置面全部可用，原「无 shim 即无设置 UI」顾虑销账。
- **叙事升级**：message-ops 一句话主张升级为「任意位置回滚/删除/恢复 + 原生槽按钮」（vs 官方仅最后一条分支）；suite 主张补「搜索入口自动接好」。
- **新观察**：OB-2 suite 依赖出列 devkit（四子包，README「五子包」表述过时）；OB-3 websearch README 安装节仍写手改 yaml（文档债）；message-ops 首屏「三合一」未反映 0.3.x（P1 文档债）。
- **R3 断点计数变化**：UPB 开放 1→1（UPB-2 关闭、UPB-3 新增）；开放断点 4→**2**（接线 ✅、restore UI ✅ 销账；仍开放：websearch history UI 出口、devkit 发包/截图）；文档债/观察新增 3 条（OB-2/OB-3/message-ops 首屏）。**下一轮冒烟重点：0.4.0 composer 回填+回撤 dock 落地复核、UPB-3 同装探测、devkit 发包状态。**


---

## 四、自研插件全量清单（2026-09-30 核实版）

### A. 核心六包（npm + GitHub 双发布，suite 聚合覆盖）

**1. @240xu/dsh-websearch 2.8.1** — 统一网页搜索（R3：+SettingsForms 真适配，0.2.0 面板完整表单）
- 职能：11 后端并发扇出（Exa/Parallel/DDG/SearXNG 免钥 + DeepSeek/Anthropic/OpenAI/Brave/Tavily/Serper/Mojeek 需钥）、URL 去重、可选重排、逐后端健康遥测
- 查全查多：multiQuery 复杂查询派生 ≤3 变体 + RRF(k=60) 融合；deepCoverage 条数×1.5 + Tavily advanced/SearXNG 多类目/Exa category 推断
- 稳定性：磁盘结果缓存（TTL 900s/LRU 200）、后端熔断（3 败→60s 冷却，全冷却 fail-open）、ddg/searxng 5s 超时上限
- 系统性提示词：查询整形（剥寒暄/1500 字符钳制）、双语结果呈现头（要求逐条引用 URL）
- 端点：GET /api/websearch/history（含 backends 观测）、POST /history/clear、GET /api/unified-search/health
- 设置项：11 项（后端开关/keys/numResults/rerank/cache/breaker/history/multiQuery/deepCoverage）

**2. @240xu/dsh-message-ops 0.3.2** — 消息回滚/删除/分支/导出（R3：官方 assistant-actions 槽原生按钮、opencode 式一键、官方图标，Playwright 实测全过；0.4.0 composer 回填+回撤 dock 在途）
- 职能：surface replace 语义（append-only 可恢复）的回滚（遮蔽尾部）/单条删除（遮蔽单条）/恢复（重放语义——引擎无 unshadow）；磁盘级分支 fork（parentSession 关联）；Markdown 导出
- agent 工具：message_ops（list/revert/delete/branch/restore/export，容错注册）
- UI：头部按钮 + 侧栏行菜单 + 统一对话框（消息列表可见性标注、风险确认、分批渲染 50 条/页）
- 端点：GET messages、POST revert/delete/branch/restore、GET export
- 兼容：v4/v3/legacy 三代会话格式、dsh 0.1.x/0.2.0 双线、Windows/Termux

**3. @240xu/dsh-session-lazy-view 0.3.3** — 会话惰性查看器（纯只读）
- 职能：stat-only 列出全部会话；只解压末尾 N 帧秒开大会话；会话内全文搜索（流式+可中止）；统计（fast/full）；Markdown 导出；Timeline 时间线视图（turn 分组折叠 + Go-to-Message 深链 /lazyview?session=&seq= + 遮蔽标注）
- 端点：GET /lazyview（面板）、/api/list、tail、search、stats、export
- 可访问性：44px 触控、aria-live、键盘可达折叠头

**4. @240xu/dsh-devkit 0.2.7** — VS Code 式开发者体验（侧边栏零占用；R3：已从 suite 依赖出列，纯 standalone）
- 职能：Ctrl+K 命令面板（>/#/@ 模式前缀 + MRU 最近使用）、和弦快捷键（Ctrl+K Ctrl+S 速查表）、Toast 标准件（aria-live/reduced-motion）、dev info 面板、开放贡献点 registerCommand/toast（同 id 幂等去重）
- 端点：GET /api/devkit/commands、/api/devkit/health
- 兼容：0.1.5/0.1.7/0.2.0 三代宿主（settingsScope feature-detect 由 websearch 侧对等实现）

**5. @240xu/dsh-session-search 0.1.4** — 跨会话全文搜索
- 职能：增量索引全部会话消息（mtime+size 门控，缓存 $DSH_HOME/cache，零写 sessions）；子串搜索（mtime 新→旧、±60 窗口 snippet、project 过滤）；独立面板页（深链 /lazyview?session=&seq= 直达 Timeline）
- agent 工具：session_search（容错注册）
- 端点：GET /api/session-search、/refresh、/panel、/health
- 实测：185 会话首建 1.5s，中文/英文/project 过滤全过

**6. @240xu/dsh-suite 0.1.3** — 一键聚合全家桶（R3：依赖收敛为四子包，devkit 出列；README「五子包」表述待对齐）
- 职能：一条命令装五包；shell 壳故障隔离（单行失败只降级自己，degraded 端点可查）；逐行 disable 回滚；web 入口自动接线（searchProvider: unified）；caret 区间随子包演进
- 已验证：真实 pnpm 布局端到端 + 故障注入隔离 ×2（symlink 与 .pnpm 双布局）

### B. 治理与配套（npm 发布、独立启用）

- **@240xu/dsh-tech-lead 1.0.0**（bundle 0.3.1 / plugin 0.3.1 / core 0.3.0）：技术负责人生命周期 21+ 只读工具（classify/state/plan/evidence/gates/release/install-audit），零写入零子进程
- **dsh-themis 1.5.0**：治理仲裁扩展（23 工具 + capability discovery）——注意 0.2.0-rc.2 下 peerDeps 待跟进（当前被版本门跳过）

### C. 本机在用的第三方（非自研）

session-delete 0.3.1（@huanlin，会话删除——0.2.0 版本门跳过中）、chat-import 0.11.0（240xu fork 维护，同跳过中）、archived-sessions 0.1.2、**message-edit（R3：与 message-ops 0.3.x 同装崩溃，见 UPB-3——处置建议禁用 message-edit）**、message-rail、better-sidebar 0.24.1、openviking memory（0.2.0 跳过）、opencode-go-quota 0.3.2

### D. 实验室/历史（不随 suite 发布）

dsh-true-revert 0.1.0（回撤实验源，已并入 message-ops）、dsh-settings-scope-shim（0.1.5/0.1.7 兼容垫片，按需启用）、dsh-opencode-go-quota（GLFzr 原作本地版）

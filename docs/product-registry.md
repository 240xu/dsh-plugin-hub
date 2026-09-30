# @240xu 六包产品登记册（product-registry）

> **定位**：后续所有产品评估的基线文档。常驻产品经理维护，每轮评审先读本表、再评增量。
> **范围**：dsh-websearch / dsh-message-ops / dsh-session-lazy-view / dsh-devkit / dsh-session-search / dsh-suite。
> **来源**：要点合并自 `reviews/pm-a-product.md`（产品 A：场景/可发现性/旅程六维）与 `reviews/pm-b-market.md`（市场 B：竞品/叙事/就绪度），标注 [A]/[B]；断点状态以本登记册为准（评审时点之后的新版本可能已修复，标「待复核」）。
> **维护规则**：版本号每轮核实 package.json；断点条目只增不删，修复后改状态不抹历史（保留用户实测证据链）。

---

## ⚡ 最高优先级栏目：用户可感知断点（User-Perceivable Breakpoints）

> 定义：用户装了插件但**得不到承诺的结果**，或承诺的结果与实际行为不符。这类断点跳过一切评分直接置顶上报。
> 跟进 SOP：用户实测反馈 → 定位根因 → 修复发版 → 本表登记（含根因与验证方式）→ 下一轮冒烟复核。

| # | 状态 | 断点 | 根因 | 修复 | 验证 |
|---|---|---|---|---|---|
| UPB-1 | ✅ 已修复（0.2.3） | **message-ops「没生效」**：用户实测插件对最新会话无效 | DSH 已升级 v4 持久化（`session.v4.jsonl.zstd`），`findSessionDirs` 只探测 v3 → 最新会话全部 "session log not found"；旧单帧 `session.jsonl.zstd` 读取路径还会直接崩 | 0.2.3 探测序列改 **v4→v3→旧单帧**，读取统一逐行扫描路径，分支写回沿用原格式版本（README §0.2.3） | 40 项测试全绿 + 真实 v4 会话日志实测通过；**下轮冒烟需在 v4 会话上复核 listMessages** |
| UPB-2 | 🆕 本轮发现 | **suite 子包依赖未安装**：suitetest profile 的 `node_modules/@240xu/` 下只有 dsh-devkit、dsh-suite 两个 link，suite 声明的五个 dependencies（websearch ^2.7.2 / message-ops ^0.2.2 / slv ^0.3.0 / devkit ^0.2.2 / session-search ^0.1.0）一个都没装 | link: 安装后未跑 `pnpm install` 级联解析依赖（或依赖声明晚于上次安装） | 在 suitetest 跑一次依赖安装并端到端冒烟（suite README「端到端验证步骤（发布前必做）」就是为此写的） | `dsh web` 后五行 x240-* 全部降级可查 `GET /api/dsh-suite/degraded` |

**历史教训沉淀**（评审断点 ≠ 用户断点）：架构评审的安全/性能项（围栏、渲染分批）重要但用户不可直接感知；用户断点的共同特征是「安装成功 + 首屏承诺 + 实际无结果」。凡用户报告「没生效/找不到/点不动」，默认按 UPB 流程走，不先怀疑用户操作。

---

## 一、六包登记

### 1. dsh-websearch — 当前 2.7.3（上轮评审时 2.7.0）

- **目标用户**：所有 DSH web 会话的用户（搜索是日常高频动作）；重度用户配 key 解锁付费后端。 [A]
- **核心场景**：会话中触发 web_search → 11 后端并发扇出、URL 去重合并，部分后端宕机/缺 key 仍出结果。 [A]
- **一句话主张**（采 [B] §2 建议版）：零配置即可用的 DSH 聚合搜索——11 个后端并发兜底，部分宕机照样出结果。/ Zero-config aggregated web search for DSH — 11 backends fan out with caching, circuit breakers, and results even when backends go down.
- **已知断点**：
  - 安装后需手改 profile cordis.patch.yml 把内置 web_search 指向 unified（[A] P0，2.7.3 是否已提供一键接线：**待复核**）。
  - 搜索历史 API 无 UI 出口（[A] P1；devkit 联动是现成解法）。
  - CHANGELOG 停在 2.4.0，2.5–2.7 叙事断档（[B]；2.7.3 是否补：**待复核**）。
- **下一步**：P0 一键接线 / P1 补 CHANGELOG + En 短描述 + 把 history 收编进 devkit 面板命令。

### 2. dsh-message-ops — 当前 0.2.3（上轮 0.2.0）

- **目标用户**：对会话历史有「反悔/分叉/留档」需求的用户；以及要让 agent 自己动手改会话的进阶用户。 [A][B]
- **核心场景**：回滚到某条消息、单条删除、从任意消息分叉新会话、恢复被遮蔽消息（重放语义）、导出 Markdown；`message_ops` agent 工具让模型直接执行六操作。 [A]
- **一句话主张**（[B] 版）：让会话历史变得可回滚、可分支、可导出——人可以点，模型也可以自己动手（agent 工具）。/ Roll back, branch, and export any DSH conversation — from the UI or straight from the agent via a `message_ops` tool. Non-destructive: logs stay append-only.
- **已知断点**：
  - UPB-1 v4 格式「没生效」——已修复（0.2.3），见顶栏。
  - restore 确认弹窗未内联重放语义（新 seq / `[恢复]` 前缀 / 不可重放计数）（[A] P0，0.2.2/0.2.3 未提及修复：待复核）。
  - 0.x 心智需用「非破坏承诺」对冲（[B] 风险 2）。
- **下一步**：P0 restore UI 内联语义说明 / P1 健康端点自检会话格式兼容性（防下一轮持久化格式变更重演 UPB-1）。

### 3. dsh-session-lazy-view — 当前 0.3.2（上轮 0.2.0；源目录 ~/slv-check）

- **目标用户**：排查/巡检会话日志的开发者与重度用户；超大文件场景独占。 [A][B]
- **核心场景**：不碰整份 zstd 文件，秒开任意会话最近帧；会话内全文搜索、统计、导出 md、0.3.0 起 Timeline 视图。纯只读零写入。 [A]
- **一句话主张**（[B] 版）：10GB 会话文件也能秒开末尾——只解压最后几帧，绝不写会话目录。/ Peek at the tail of any DSH session file in milliseconds — decompresses only the last zstd frames, cost independent of file size, zero writes.
- **已知断点**：
  - 可发现性（[A] 评分 2）已在 0.2.1 缓解：面板页加「复制链接」+ README 注明 devkit Ctrl+K 打开——**待复核** devkit 是否已实际注册该命令。
  - Node ≥24 最挑剔（[B] 风险 3），市场条目需备注。
  - 官方吸收风险：守「零写入 + 极端大文件」两个约束（[B] 风险 4）。
- **下一步**：P0 复核 devkit 命令联动落地 / P1 v0.3 Timeline 的 README 首屏露出（价值点未进首句）。

### 4. dsh-devkit — 当前 0.2.2（上轮 0.1.0）

- **目标用户**：键盘效率用户；以及所有想进面板的插件作者（贡献点）。 [A][B]
- **核心场景**：Ctrl+K 命令面板统一触达会话操作、其他插件功能（消息操作、websearch 设置、session-search 面板）、快捷键速查、Toast。 [A]
- **一句话主张**（[B] 版）：给 DSH web 一个 Ctrl+K 命令面板——一条 `registerCommand`，让你装的每个插件都进面板。/ Ctrl+K for DSH web — a command palette and toast layer every plugin can plug into with one `registerCommand` call. Zero sidebar changes.
- **已知断点**：
  - `dsh-websearch:open-settings` 死命令（[A] P0，client.js:431 派发无人监听）——0.2.2 是否修复：**待复核（下轮冒烟第一项）**。
  - npm 发包状态与 README 引用截图是否仍为占位（[B] 🔴 项）——0.2.2 后**待复核**。
  - 0.x 心智对「贡献点标准」卡位最致命，API 稳定后尽快 1.0（[B] 风险 2）。
- **下一步**：P0 复核/修复 open-settings 死命令 / P1 把 slv 面板、websearch history、session-search 收编为内置命令，坐实「统一入口」。

### 5. dsh-session-search — 当前 0.1.2（新纳入评审范围）

- **目标用户**：记不清「这句话在哪次会话说过」的所有用户；agent 跨会话检索。 [A]
- **核心场景**：对全部历史会话建消息级全文索引，一条关键词查回 sessionId+seq+摘录；独立面板 `/api/session-search/panel`，devkit 装了可 Ctrl+K 直达；信任围栏与 message-ops 0.2.1 同款。 [A]
- **一句话主张**：一条关键词，查回所有历史会话的命中位置——本地索引、零依赖、对 sessions 目录零写入。/ One keyword, every past session — local full-text index over all DSH session logs, zero dependencies, zero writes to your sessions.
- **已知断点**：
  - 与 message-ops/slv 三处有意重复实现（fence / 帧扫描 / messageText），待 suite 聚合层收口（README 自认）——技术债不是用户断点，但拖慢三包联动升级（UPB-1 类修复要改三处）。
  - 首屏截图/En 描述等上架物料空白（[B] 共性）。
- **下一步**：P0 随 suite 端到端验证一起冒烟 / P1 上架物料 + 与 slv 打包「会话维护三件套」叙事（[B] §5）。

### 6. dsh-suite — 当前 0.1.0（骨架验证期）

- **目标用户**：想一次装齐 @240xu 全家的新用户；逐行开关/回滚的谨慎用户。 [A]
- **核心场景**：一条 `dsh plugin add @240xu/dsh-suite` 引入五子包 + 五条 x240-* family 行；shell 壳把单行故障收窄为降级不拖全家；逐行 disable 即回滚。 [A]
- **一句话主张**：一键装齐 @240xu 插件全家——单插件故障只降级自己，逐行开关即回滚。/ Install the whole @240xu plugin family in one command — per-row fault isolation, per-row enable/disable, instant rollback.
- **已知断点**：
  - **UPB-2（本轮）**：suitetest 子包依赖未安装，端到端装载从未验证（README 自认「尚未验证」）——这是 1.0 之前的唯一硬门槛。
  - caret 区间下限滞后（README 表格写 ^0.2.2 message-ops，UPB-1 修复在 0.2.3——区间已兼容，但骨架验证期建议锁到已知好版本）。
- **下一步**：P0 跑完端到端验证（装依赖 → `dsh web` → 五行 live → degraded 空）/ P1 发布后接管四包安装 CTA（[B] §5 「一套」叙事）。

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

### 本轮（登记册创建轮）冒烟记录

- 环境：本机运行中的 `dsh web`（:3080）；suitetest profile 为 link 安装（suite + devkit）。
- `/api/websearch/history` 200 ✅；`/lazyview` 与 `/lazyview/api/list` 200 ✅；`/api/message-ops/messages?sessionId=x` 400（端点活、参数校验正常）✅。
- `/api/devkit/*`、`/api/session-search/panel`、`/api/dsh-suite/degraded` 均返回 401 unauthorized——信任围栏生效（curl 无 Origin 属预期拒答），**但注意**：`/api/message-ops/messages` 的 GET 对同样的 curl 放行（400），各包围栏对「无 Origin 的本机 GET」策略不一致——记 **观察 OB-1（P2）**：围栏行为不统一，外部工具按 README 消费 `/api/devkit/commands` 时会 401，与「供外部工具/文档消费」的声明冲突，需统一口径（要么 README 写明要求 Origin，要么 GET 白名单）。
- **断点 UPB-2**：suitetest 子包依赖未装（见顶栏）。
- **本轮断点计数：用户可感知断点 1 个（UPB-2，新发现）+ 观察项 1 条（OB-1 围栏口径）+ 待复核销账项 6 条（websearch 接线/CHANGELOG、message-ops restore UI、slv-devkit 联动、devkit 死命令/发包/截图）。**

# 0.2.0 兼容审计 C · 前端/UI 面（compat-02-c）

> 审计人：常驻 UI 设计大师（三线审计第三线）。对象：**0.2.0-rc.2 客户端运行时**（安装于 `/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh/`，client 侧实现在 `node_modules/@deepseek-ai/dsh-client-*` 与编译产物 `dsh-web-frontend/dist/assets/`）。方法：读运行时源码/类型/产物，对照六包 client 代码逐维核对。只读审计。
>
> 事实基线：0.2.0 的 client-modules 系统实现 = `dsh-client-modules/lib/client.js`（883 行）；boot 图 + 槽位声明 = `dsh-cordis-client-runner/lib/client.js`（含全部 slot key 目录）；布局槽渲染 = `dsh-client-ui-layout/lib/client.js`。

## 六包 × 六维矩阵

图例：✅ 兼容 · ⚠ PARTIAL（降级/部分） · ❌ BROKEN（功能断裂，见断裂面） · — 不适用

| 包 | 1 ModuleLoader 协议 | 2 require 面 | 3 slots key/props | 4 --dsw-* 令牌 | 5 ctx 服务探测 | 6 window 事件/CSP |
|---|---|---|---|---|---|---|
| dsh-devkit | ✅ | ✅ react+primitives 均在 seed | ✅ overlay/header.actions 均在 | ⚠ surface-primary、interactive-bg-selected 已不存在（fallback 兜住） | ❌ sessions face 变更：list/open/refreshList/create 全探测落空 | ✅ |
| dsh-message-ops | ✅ | ✅ Modal 仍导出且 props 同形 | ✅ header.actions + Modal 用法 | ✅ 用到的令牌全部存活 | ⚠ 仅 refreshList 变 no-op（分支后文案 stale）；OpsButton 的 useSessions 是 0.2.0 标准 prop，反而更稳 | ✅ |
| dsh-session-lazy-view | — | — | — | —（自持页硬编码，不依赖令牌） | ✅ webServer 服务在（host-webserver:158） | ✅ |
| dsh-session-search | — | — | — | ⚠ 用了 6 个从未存在的令牌名（bg-canvas/input-bg/bg-elevated/warn/info/danger），全靠 fallback 渲染 | ✅ webServer + defineTool 面 | ✅ |
| dsh-websearch | ✅ | ✅ | ✅ settings.section 槽仍在（runner key 目录，registrant 选项 id/order/label） | ✅ | ❌ settingsScope 服务已删（0 命中）——内置降级生效：设置卡禁用 + console.warn 面包屑 | ✅ open-settings/ack 协议原样 |
| @huanlin/session-delete | ✅ | ❌ **IconTrashOutline16 已从 primitives 移除**（现仅 Permission/Reference 图标族） | ✅ | ⚠ 同 devkit 部分令牌 | ❌ 同 devkit：svc.list/refreshList/open 探测落空 | ✅ |

矩阵计数：36 格 = ✅ 25 · ⚠ 2 · ❌ 4 · — 4（lazy-view/session-search 无 client require/slots 面）。另 1 个 ⚠ 级 minor（message-ops refreshList no-op）计入备注。

## 逐维结论

### 维度 1 · ModuleLoader classic-script 协议：✅ 完整保留
`window.__ModuleLoader__.load({ id, factory })` 仍是 0.2.0 的注册协议（dsh-client-modules/lib/client.js:1-3 即协议自述；注册/去重逻辑 :560-578）。变化（信息级，非断裂）：
- 重复注册同一 bundle factory 现在**显式 throw**（:575 "duplicate factory registration"），boot 审计对"加载了但没注册"也会报错（:625）——devkit 0.2.2 的 registerCommand 幂等去重（client.js:336-345）已对齐这 stricter 语义。
- `require()` 解析失败从静默变为 loud throw（:705 "missed the module table"）——对六包是好事，问题会浮出而非静默白屏。

### 维度 2 · require 面：seed 表实证
编译产物里的平台 seed 工厂（index-5SrrfWpU.js 内 `function rM()`）逐字列出：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`…。
- `require('react')` ✅ 六包全兼容。
- `require('@deepseek-ai/dsh-client-ui-primitives').Modal` ✅ **仍在且 props 同形**（types/Modal.d.ts：open/onClose/title/closeLabel/description/footer 全部保留；新增可选 headless/contentClassName/backdropBlur/shortcutModal）。message-ops 的 Modal 用法零改动兼容。
- ❌ **`IconTrashOutline16` 不存在了**——primitives 现仅导出 Permission/Reference 图标族（types/index.d.ts export 行）。session-delete 的解构拿到 undefined，渲染到该图标时 React "Element type is invalid" 崩该组件树。**断裂面 B1。**

### 维度 3 · slots API：三个 key 全部存活，props 形状加固
- `shell.overlay`：✅ dsh-client-ui-layout/lib/client.js:617（kind:"list", scope:"root"）。
- `conversation.session.header.actions`：✅ runner client.js:3496（kind:"list", scope:"session"），自带示例与现役 occupant 名单；registrant 选项 `id`（必需）/`order`/`label`——六包传的 id/order 兼容，`label` 是 0.2.0 新推荐项（可传 thunk 跟随 locale）。
- `settings.section`：✅ runner key 目录（kind:"list"，ownerProps.close 是 shell 交给 section 的唯一壳 affordance）。
- props 形状：slot 组件现在收一组**标准 props**（useSessions/useWorkspaces/sessionId/useResource/useProjection…），`t` seat 经 `register(options.locale)` 继续生效（dsh-client-ui-slots/lib/index.js:98、:217）——devkit/message-ops/websearch 的 `locale: NS` 写法兼容。`t` seat 的 bind 语义见 runner :1240 区域文档（"the framework-injected `t` seat"）。

### 维度 4 · 主题令牌：核心存活，别名漂移
对 0.2.0 CSS 产物（index-BPHePDI_.css + vendor-BNsW4eBh.css）grep 计数：
- **存活**：`--dsw-alias-label-primary`(47)、`-label-secondary/tertiary`、`--dsw-alias-border-l1`(3)/`-l2`(11)、`--dsw-alias-state-success/warn/error-primary`(10/6/13)、`--dsw-alias-interactive-bg-hover`(16)、`--dsw-alias-brand-primary`(6)。
- **已消失**：`--dsw-alias-surface-primary`(0)、`--dsw-alias-interactive-bg-selected`(0)——devkit 面板底色与选中行高亮会落到 fallback 字面量（深色值），**浅色主题下观感错误**；`--dsw-alias-bg-canvas/input-bg/bg-elevated`、短名 `warn/info/danger`(0)——session-search 这六个令牌**从未是标准名**，一直在吃 fallback。
- 0.2.0 新别名族（bg-base/bg-layer-*/bg-mask-*/label-caption/label-dimmed…）提示 alias 层经历过更名。**断裂面 B4（PARTIAL 级）**：不崩但主题失真。dsh-ui-spec S2 令牌清单需按 0.2.0 重写。

### 维度 5 · ctx 服务探测面：两处断裂
- `sessions`：**face 整体重塑**。0.2.0 = retain/using/retainInfo/refreshProjections/search/fork/scope/binding（runner client.js:1266-1360）。devkit/session-delete 探测的 `svc.list.getSnapshot()` / `svc.open(id)` / `svc.refreshList()` / `svc.create|new|createSession|newSession` **全部不存在**；会话打开迁到 `uiWorkspace.openSession/startSession/forkSession`（:1486 区），会话列表快照改为 `useWorkspaces` → `WorkspaceSnapshot { items: WorkspaceView[], … }`（api-workspace-controller model.d.ts）。**devkit 的切换会话/新建/删除后自动打开/导出/messageOps 入口全部降级为 warn toast**（探测有守卫，不崩）；session-delete 同样降级。**断裂面 B2。**
- `settingsScope`：0.2.0 全树 0 命中，确认已删。websearch client 内置兼容路径正确触发（client.js:552-560：feature-detect → console.warn 面包屑 → 设置卡停装，fiber 不崩）。设置 UI 的新正路是 `settings.section` 槽（维度 3）——websearch 迁移时把 UnifiedSearchCardController 的 scope 绑定改接新 config 面。**断裂面 B3（有设计的降级，非崩溃）。** dsh-settings-scope-shim 在 0.2.0 能否继续供服务未在本线验证（属 server 线）。
- `webServer` ✅（host-webserver/lib/index.js:158 `super(ctx, "webServer")`）——lazy-view/session-search/websearch 的自持端点注册面不变。
- `locale` ✅（runner :1170；`BuiltInLocaleId = ["zh","en"]`，locale-settings.d.ts——六包 zh+en 双字典恰好满足 0.2.0 新增的"bilingual balance"注册校验；**若未来宿主加第三语言，三包 register 会 throw**，记入前瞻风险）。
- `tools` ✅（dsh-tools/lib/index.js:2704）。

### 维度 6 · window 事件协议：✅ 无影响
host-webserver 的注入机制本身就是 inline `<script>` 拼页（lib/index.js:25-45），**全树未发现 Content-Security-Policy 头生成**——`CustomEvent`/`addEventListener` 协议（dsh-message-ops:open、dsh-websearch:open-settings(:ack)、chameleon:*）纯浏览器层，不受影响。另确认：`TIMER_REDIRECT` 陷阱（runner :41-53：动态包 client half 里 setTimeout 抛教学错误）只作用于 **cordis 动态包的 evaluateClientHalf 路径**（:137-166，host.call/harness 分模型），classic client-modules bundle 不经此沙箱——devkit/message-ops 的 setTimeout 用法安全。

## 断裂面清单与修复建议

| # | 级 | 对象 | 断裂 | 修复建议 |
|---|---|---|---|---|
| B1 | **P0** | session-delete | `IconTrashOutline16` 导出已删，解构得 undefined → 渲染崩 | 改用内联 SVG（message-ops BRANCH_PATH 模式）或 primitives 现役图标；一行改动 |
| B2 | **P0** | devkit、session-delete | sessions 服务 face 重塑：list/open/refreshList/create 探测全落空，会话命令群降级 | 探测顺序扩为两级：先旧 face（≤0.1.x），再 0.2.0 面——列表走 `useWorkspaces`/WorkspaceSnapshot（slot 组件内）或 sessions.search；打开走 `ctx.get('uiWorkspace').openSession`；新建走 `uiWorkspace.startSession`；刷新列表由 Workspace snapshot 订阅天然替代。devkit 是高扇出方，优先修 |
| B3 | P1 | websearch | settingsScope 已删 → 设置卡禁用（设计内降级，有面包屑） | 迁移到 `settings.section` 槽注册 + 0.2.0 config 读取面；短期可继续依赖 shim，但 shim 自身兼容性归 server 线确认 |
| B4 | P2 | devkit、session-search（、spec） | 令牌漂移：surface-primary/interactive-bg-selected 消失；session-search 六个幻影令牌 | devkit 面板底/选中行改用存活令牌（如 bg-layer 族）并保 fallback；dsh-ui-spec.md S2 按 0.2.0 产物重写令牌清单，把 session-search 的短名令牌标记为非标准 |
| B5 | P3 | message-ops | refreshList no-op 后「列表刷新后可见」文案过时 | 文案改为中性（"新会话已创建"），或 uiWorkspace 可用时主动 openSession 新分支 |
| B6 | 信息 | 全部 | client-modules 重复注册/loud throw 语义变严 | 无需动作；六包现有幂等/守卫已覆盖，回归时留意 console |

**断裂面计数：4（B1、B2 为 P0 必修；B3、B4 可随 0.2.0 迁移一并做）+ 2 项信息级。**

## 交叉线提示

- B2/B3 的 server 侧配套（uiWorkspace/startSession 的 host 面、settings 新 config 面在 server ctx 的读法）归 server 线核对；本线结论以 client 侧类型与产物为据。
- B4 的规范落地：令牌清单更新属于 dsh-ui-spec.md S2 的下一次修订（本审计只登记，不改规范文件）。

---

## 附：交叉验证轮收尾（2026-09-30）

- **sessions face 分歧裁决**（reviews/cross-sessions-face.md）：两个 face 各对一半——useSessions slot prop 未重塑（message-ops PASS），ISessions 服务 face 确已重塑（open→uiWorkspace.openSession、refreshList→refresh）。devkit 0.2.5 修复派发中；message-ops P3 顺带。
- **SettingsForms 联合裁决**（reviews/cross-settings-forms.md）：A 线机制考证对但结论错——volatileForm 门控（meta.volatile）才是表单来源。websearch **2.8.1** 已落地全方案（meta.volatile 一行 + 删 warn 同批 + 18 字段 description + 回归守卫），已发 npm。C 线 B3 短期出路改判：volatile 表单，非 shim。
- **架构更正**（official-contract-matrix.md）：dsh-src 0.1.0-rc.5 是最老存档非前向线；现役线恒为 startSeq/endSeq + VERSION=4。R1「前向雷」撤销。
- **lazy-view v4**：agg-researcher 的 P1#1 为过期信息——0.3.2 已修（lib/artifact.js vN 形状正则），实测确认。

# DSH 0.2.0-rc.2 客户端契约全景（08-client-contract）

> 状态：**骨架（调研进行中，增量落盘）**
> 调研员：client-contract（第二次派遣）
> 代码基线：`/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-*/lib/client.js`
> 已知实证（先前调研，可直接引用）：用户消息动作行 `.xzv4MW_actions`（含 Copy）、`[data-chat-flow-kind="user"]`、`data-actions-reveal` 显隐、虚拟化库为 `virtua`。
> 行号为当前安装版本实测；哈希类名可能随版本漂移，结构性选择器（data-*）更稳。

## 1. Slot 全景表

## 1. Slot 全景表

### 1.0 槽位机制要点（SlotCore，dsh-client-ui-slots/lib/types/index.d.ts）

- 四种 kind：`single`（单格遮蔽）/ `list`（按 `id` 分格、`order` 升序展示）/ `keyed`（按 `key` 分格）/ `chain`（selector 选举）。
- **遮蔽规则**：同 cell（single=槽本身；keyed=同 key；list=同 id）多个占用者按 `priority` 升序排列，**priority 最低者渲染**；同 cell 同 priority 的第二次注册抛错（fail-loud）。list 的 `order` 只影响展示顺序，不影响遮蔽。
- **chain 选举**：每个占用者提供纯函数 `select(owner)`，按 `priority` 升序（默认 0，同序按注册序）依次尝试，第一个非 null 当选并把结果注入为组件的 `matched` prop；全 null 渲染 owner fallback。`overlay:true` 时 fallback 保活挂载（display:none 隐藏而非卸载），**唯一消费者是 `conversation.composer`**（index.d.ts ChainRenderOpts 注释 + conversation/lib/client.js:16313-16318）。
- 声明即授权：register 的 `children` 表声明（并独占）子槽；条目崩溃可 abdicate 让位（single/keyed/list）。
- 唯一天生声明：`root`（renderer/lib/types/client/registry.d.ts:15-33），被 ui-layout 的 AppFrame 占用；**文档明确警告勿注册 root**（single 遮蔽 + 动态注册 priority 更低反而胜出 → 整页只剩你的组件）。全屏浮层请注册 `shell.overlay`（list、点击穿透）。
- 本版安装中未发现名为 `session.header.*` 前缀的独立槽族；**"session.header" 组实为 `conversation.session.header.*`**（见 1.2）。

### 1.2 conversation.*（声明：dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:122-232；渲染：conversation/lib/client.js）

| 槽 | kind/scope | 渲染位置（client.js:行） | owner props | 内置占用者（id/priority/order，证据） |
|---|---|---|---|---|
| main.conversation | single/session-maybe | conversation:16354 | — | conversation 包自身 register（18143 name:"main.conversation"） |
| conversation.session | single/session | conversation:16202 | `view?` | conversation:18209 |
| conversation.header | single/session-maybe | conversation:16021、16374 | — | conversation:18247 |
| conversation.session.header | single/session | conversation:16375 | `hideChrome:boolean` | conversation:18260 |
| conversation.session.header.lineage | single/session | conversation:16494（fallback=原 title） | lineageSessionId/displayTitle/openTitle? | subagent 包（subagent client.js:963-966，注册 lineage） |
| conversation.session.header.actions | list/session | conversation:16502（title 旁，升序） | 无（marker） | subagent-catalog **-30**（subagent:969-973）；agent-team **-20**（agent-team:486-490）；agent-preset **-10**（agent-preset:1651-1655）；job-list **20**（jobs:611-613） |
| conversation.session.header.utilities | list/session | conversation:16506（右对齐，升序） | 无（marker） | open-in-app **-10**（open-in-app:841-844）；schedule-catalog **-5**（schedule:6824-6827）；session-log-download 未给 order→默认 0（session-log-export:286-289） |
| conversation.session.header.corner | single/session | conversation:16510 | 无（marker）；无内容时不占位 | 未发现内置占用者（空槽） |
| conversation.header.leading | single/root | conversation:16374 | 无（marker） | 未发现内置占用者 |
| conversation.view | list/session | conversation:16415（一次渲染一个 View） | inspectCall/viewRequest/openView/completeViewRequest | chat 目标（chat 包注册 View，见 chat client.js ChatViewSlotProps 声明 slots.d.ts:216-219） |
| conversation.hero.workspace | single/root | conversation:16268 | open/anchorRef?/selectedId?/onPick/onClose | conversation 包 register（18436） |
| conversation.hero.brand.mark | single/root | conversation:16184 | size:number, className? | 未发现其他内置占用者 |
| conversation.hero.agentPreset | single/session-maybe | conversation:16283 | children?:never（marker） | agent-preset:1645-1649 |
| conversation.content（Factory） | factory/session-maybe | 由 presentation host 经 renderFactorySlot 实例化（conversation:16021） | variant/phase/hero | conversation:18143-18151；局部槽 views、widthControls |

### 1.3 chat.*（声明：dsh-client-ui-chat/lib/types/client/contract/slots.d.ts:235-296；渲染：chat/lib/client.js）

| 槽 | kind/scope | 渲染位置 | owner props | 内置占用者 |
|---|---|---|---|---|
| conversation.chat.node | keyed/session | chat:1770（`{ entryKey: node.kind }` 分派） | typed node + Turn hook | chat 包为每个 ChatNodeKind 注册一个 key（chat:6780 起 ≥10 处 `name:"conversation.chat.node"`）；复用同 key=替换该节点渲染器，未占用 kind 不渲染该行 |
| conversation.message.images | single/session | chat:5214 | images/loadImage/align | 未注册时图片整体省略（slots.d.ts:252-258） |
| conversation.chat.commandview | keyed/session | chat:6139 | 命令折叠生命周期 | 未占用 key 用通用卡片（slots.d.ts:262-267） |
| conversation.chat.turnTail | list/session | chat:6580（完成 Turn 动作行之前） | Turn/闭序列/file opener | 未发现本版内置注册 |
| conversation.chat.assistant-actions | list/session | chat:6591（`{ messageId }`） | messageId | 未发现内置注册；无条目时保留标准动作行 |
| shell.quota-notice | chain/root | 宿主在 shell.overlay 的 Chat 持有件（chat slots.d.ts:282-296） | notice code | chat 包提供 one live notice；选择器认领 code 后接管，全 decline 渲染通用 Toast；宿主在 Chat 面板外，切面板不掉线 |

### 1.4 composer.*（conversation.composer / composer.bar / input.*，含 dock 三件套）

| 槽 | kind/scope | 渲染位置 | owner props | 内置占用者 |
|---|---|---|---|---|
| conversation.composer | **chain**/session | conversation:16313（`overlay:true`，fallback=composerBar，无 session 时 fallbackOnly） | sessionId/session/pendingInteraction | subagent **priority -10**（selectReadOnlySubagent，subagent:971-977）；user-questions **默认 0**（select PendingQuestion，user-questions:1906-1912）；approval **priority 1**（select PendingApproval，approval:340-346）→ 选举顺序：只读代驾 → 提问 → 审批 → 常驻 bar |
| conversation.composer.bar | single/session-maybe | conversation:16287 | variant:'hero'\|'composer'/blocked?/disabled?/workspacePickerOpen?/placeholder?/accessory? | conversation:18293 |
| conversation.input.dock | list/session | conversation:16309（composer 卡片上方，全宽） | `{session, input}` | conversation 自身两处（15678、17752）；goal（goal:558） |
| conversation.input.overlay | list/session | conversation:17452（composer 卡片内浮动） | 无 owner | commands:1431；input-trigger:1262；message-feedback:838 |
| conversation.composer.dock | list/session | conversation:17615（composer 卡片下方环境位） | 无 owner | chat:12498 |
| conversation.input.left | list/session | conversation:17524（工具行左侧） | 无 owner | 未发现内置占用者（扩展位） |
| conversation.input.right | list/session | conversation:17532（提交动作之前） | 无 owner | 未发现内置占用者（扩展位） |
| conversation.input.activity | single/session | conversation:17536 | locked + onActiveChange（展开时收起普通 accessory，须在卸载时释放） | voice-input:5794 |
| conversation.input.attachments | single/session-maybe | conversation:17458（草稿附件轨+拖放目标） | attachments/canAcceptDrop/onAddFiles/onRemoveAttachment/uploads/onRetryFile | attachment:875 |
| conversation.input.plan | single/session | conversation:17522 | locked | plan:701 |
| conversation.input.permission | single/session | conversation:17522（plan 左侧同一行） | locked | permission-presets:816 |
| conversation.input.model | single/session | conversation:17532 | locked；行内空间不足时经 `--dsh-composer-model-text-display/-icon-display` 切紧凑显示（slots.d.ts:214-221） | model-selection:1249 |

### 1.5 session.header.* = conversation.session.header 族小结

- 组内槽：`.lineage`（single，替换面包屑标题）/ `.actions`（list，标题旁）/ `.utilities`（list，右缘）/ `.corner`（single，超出 utilities 边缘、进入 header 自身 padding 的最右角）。
- 渲染顺序（conversation:16494-16510）：lineage（或原 title）→ actions → utilities → corner。list 组内按 `order` 升序：actions 现值 -30→-20→-10→20；utilities -10→-5→0。
- corner 特性：占用者不渲染内容则整个角位不布局，utilities 顶到边缘（slots.d.ts:178-182）。

### 1.6 框架级参照（非本次四组，但影响定位）

`root`（registry.d.ts:15-33）→ `sidebar` / `main`(keyed) / `rightbar` / `shell.overlay`(list) / `shell.leading`（声明：layout/lib/types/client/index.d.ts:33-115；渲染：layout client.js:118、300、312-313、338）。`main` 的 entryKey=当前面板 id，保留键 `conversation` 承载会话。sidebar 族（sidebar.* 28 键）声明于 sidebar 包契约，属另一篇文档范围。


## 2. 设计令牌规范

（调研中）

## 3. 消息渲染层级图

（调研中）

## 4. DOM 注入安全区分级

（调研中）

## 5. 虚拟化边界（virtua）

（调研中）

## 2. 设计令牌规范（实测补充）

最小集（message-ops 0.7.0-0.8.1 全部使用，暗/亮自适应验证通过）：
`--dsw-alias-label-primary/secondary/tertiary`（文字三级）、
`--dsw-alias-interactive-bg-hover`（hover 底）、`--dsw-alias-border-l1/l2`（描边）、
`--dsw-alias-bg-layer-1`（卡底）、`--dsw-specific-input-major`（输入卡底）、
`--dsw-radius-md/xl/panel`、`--dsh-composer-card-max-width`（输入卡宽同源）、
`--dsh-content-font-size(-secondary)`。暗/亮切换由宿主根节点变量翻转自动生效，
插件**禁止硬编码色值**。

## 3. 消息渲染层级图（用户消息，实测）

```
[data-chat-flow-kind="user"]（flowItem）
└─ Sixlwa_userRow（column, align-end, gap6）
   ├─ Sixlwa_userStack（max-width min(748*.702, 82%), gap8）
   │  ├─ Sixlwa_bubble（radius-xl, padding 10px 16px, pre-wrap）  ← 文本
   │  └─ attachmentRow（有附件时）
   └─ .xzv4MW_actions（height28, gap8, opacity0→[data-actions-reveal]）  ← 动作行
      ├─ [clock timeStart]
      └─ Copy 按钮（.xzv4MW_action）
```
类名哈希前缀（Sixlwa/xzv4MW/hWmORq）随构建漂移：**结构性选择器
（data-* 属性 + 类名后缀片段如 `_actions`）为长治久安之道**。

## 4. DOM 注入安全区分级（0.7.0-0.8.1 实战定级）

| 级别 | 注入点 | 依据 |
|---|---|---|
| 稳定 | 官方动作行内 append（找 `_actions` 类后缀 / Copy 按钮反查父级） | 0.7.0 上线，跨多次宿主无恙 |
| 稳定 | `[data-chat-flow-kind="user"]` 属性锚 | 官方 CSS 选择器在用 |
| 半稳定 | `.mopsRd` 自有类（自控）+ composerStack 位置（宿主 gap 变量） | 依赖 `--dsh-composer-*` 变量存在 |
| 易碎 | innerText 文本匹配定位消息块 | 虚拟化 + 分组渲染随时变 |
| 易碎 | 任何哈希类全名（Sixlwa_userRow 等） | 构建间可能漂移；用后缀匹配兜底 |

## 5. 虚拟化边界

- 库：`virtua`（子代理临终留言确认 + DOM 窗口行为一致）。
- 行为：**只渲染可见窗口**——3 条消息可只 2 块在 DOM；scrollIntoView 触发窗口移动。
- 对注入：MutationObserver + 滚动扫描是必须；**块不在 DOM 就无从注入**（不是 bug）。
- 对 e2e：断言前必须先让目标块进入视口并等渲染（chain3/l2 教训）。

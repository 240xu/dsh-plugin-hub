# DSH 插件生态 UI 规范 · dsh-ui-spec（1 页纸）

> 维护人：常驻前端 UI 设计大师。来源：fe-ui.md C3 建议的正式版 + 两轮评审沉淀。
> 适用对象：所有在宿主页面内渲染 UI 的插件（devkit / message-ops / 未来包）与自持面板页（lazy-view / session-search）。
> 原则：**规范从既有最佳实现提炼，不从零发明**——devkit 是标准件提供者，message-ops 是宿主内嵌 UI 的模范，lazy-view/session-search 是自持页的模范。

## S1 · 标准件：devkit toast / overlay

- **弹层**：一律 `shell.overlay` 槽；`role="dialog" aria-modal="true" aria-label`；开时焦点进首个可交互元素，关时还原 `prevFocus`；Tab 陷阱必做且**必须适配面板内全部可聚焦元素**（多元素用首/尾循环，参照 devkit client.js:838-853）。
- **通知**：一律 `window.__dshDevkit.toast(msg, { kind: 'info'|'ok'|'warn'|'error' })`；容器 `role="status" aria-live="polite"`（devkit 已实现，client.js:389-390）。插件**不得自绘 toast**。

## S2 · 令牌（--dsw-*）

- 宿主内嵌 UI：只用 `--dsw-alias-*` 且**必须带字面量 fallback**（如 `var(--dsw-alias-border-l1, rgba(128,128,128,.35))`）；禁止硬编码色值。
- 自持面板页（自有端点直出 HTML）：推荐同样走 `var(--dsw-alias-*, fallback)`（session-search 模式，panel.js:18-36）；最低要求是调色板抽成 `:root` 变量并在 README 标注"不随宿主主题"。
- 当前清单位：surface（bg-canvas / bg-elevated / surface-primary / input-bg）、label（primary/secondary/tertiary）、border（l1/l2）、state（success/warn/error）、interactive（bg / bg-hover / bg-selected）、brand-primary。新令牌先在本文件登记再使用。

## S3 · 触控目标 44px

- 所有可点击/可聚焦目标命中区 ≥44×44px：视觉可以小（28px 图标钮），但需 padding/外扩 hit-area 补足（lazy-view button `min-height/min-width:44px` 为范本）。命令列表行视高 ≥44px。

## S4 · 焦点管理三原则

1. **进入**：弹层打开即 focus 首个可交互元素（devkit client.js:809-812）。
2. **循环**：Tab 永不出弹层——单元素弹回自身，多元素首尾循环（client.js:838-853）。
3. **归还**：关闭时 focus 还原到打开前的 `document.activeElement`（client.js:817-825）。

## S5 · 错误与状态提示统一规则

- 操作失败 → devkit toast(kind:'error')；表单内校验/内联错误 → 红字 + `role="alert"`（message-ops errStyle 为范本）；异步状态文本（loading/结果计数）→ `role="status" aria-live="polite"`（lazy-view #status、session-search #status 为范本）。
- 禁止裸文本错误（无任何 live/alert 语义）。

## S6 · 刷新禁令

- 禁止裸 `window.location.reload()` 作为操作成功路径（丢滚动位置、重置全部插件状态）。优先：局部刷新 / `__sessionsSvc.refreshList()` / 宿主失效事件；无宿主事件时给用户可点击的"刷新"按钮而非自动整页刷。

## S7 · 可访问性语义

- 可折叠区块：clickable div 必须是 `<button>` 或补 `role="button" tabindex="0"` + Enter/Space 处理 + `aria-expanded`（展开/收起状态对读屏可见）。
- radio 组：`<fieldset><legend>` 或容器 `role="radiogroup" aria-label`。
- 视觉隐藏/弱化的内容（如遮蔽消息 opacity 0.55）必须伴随文本标注（"已遮蔽" badge，lazy-view 模式）。
- 所有动效加 `@media (prefers-reduced-motion: reduce)` 关断（devkit toast 注入样式为范本）。

## S8 · 国际化

- 宿主内嵌 UI：locale 服务注册 zh/en dict + fallback（devkit/message-ops 模式）；**新增 UI 字符串必须两语言同步**（如 message-ops `dialog.showMore` zh:40 / en:74 双侧齐备）。
- 自持页：中文为主可接受，交互控件需 aria-label。

## S9 · 禁用面

- **侧边栏注册面 = 禁区**（用户锁定）。所有 UI 只走：`shell.overlay`、`conversation.session.header.actions`、自持 HTTP 端点、`defineTool`、设置段注册。
- 侧栏 DOM 注入类 hack（如 message-ops menu item 注入）仅限既有模式且需 MutationObserver 过滤 + 调度（见 GAP G-M4 现状）。

## S10 · 跨插件导航（生态增量）

- 能用深链就用深链：`/lazyview?session=<id>&seq=<n>`（Go to Message，Timeline.parseDeepLink）是生态定位协议；搜索结果页/工具输出应提供"在 Timeline 打开"直达，而不是"复制定位串 + 手工找"。

## S11 · 双提交防护

- 触发网络请求的按钮在请求飞行中必须 disabled（devkit confirmDelete busy 态、message-ops state:'busy' 为范本）。

## S12 · 版本真实性

- 插件代码内 VERSION 常量与发布 commit/包版本一致（devinfo 面板会展示）。

---
---

# 附：GAP 清单（本轮六包对照规范，R2 后现状）

> 范围：devkit v0.2.2、message-ops v0.2.3、lazy-view v0.3.2、session-search（首审）、websearch 设置（无新 UI，R2 的 W1/W2/W4 顺延不再重列）。
> 好消息先行：R2 的 N1（Tab 循环，devkit:838-853）、D2（combobox 接线，:1050/:1084）、N2（VERSION 0.2.2）、D7（MRU/模式前缀已实现）均已修；message-ops M1 分批渲染已落地（PAGE_SIZE=50 + 显示更多，client.js:199-200、309-335，双语 key 齐备 client.js:40/74）。

## GAP 计数：13 条 = P1×5、P2×5、P3×3

### devkit v0.2.2

| # | 级别 | 规范 | 位置 | 问题与建议 |
|---|---|---|---|---|
| G-D1 | P2 | S3 | client.js:740（rowStyle `padding:'9px 16px'` ≈38px 行高）、header 按钮 28px | R2 的 D6 顺延：列表行与头部按钮命中区仍 <44px。行 padding 上下加到 12px；头部按钮外扩 hit-area |

### message-ops v0.2.3

| # | 级别 | 规范 | 位置 | 问题与建议 |
|---|---|---|---|---|
| G-M1 | **P1** | S6 | client.js:296 | 回滚/删除成功仍 900ms 后裸 `location.reload()`（R2 M5 顺延）。先做低成本版：成功 toast + "刷新"按钮由用户触发；branch 路径（refreshList）与 revert 路径行为拉齐 |
| G-M2 | P2 | S7 | client.js:322-339（列表）、343-350（模式组） | radio 组仍无 fieldset/legend（R2 M3 顺延）。容器加 `role="radiogroup" aria-label={t('dialog.pick')}` |
| G-M3 | P2 | S3 | client.js:155-158（行高 26px）、radio 原生 16px | R2 M4 顺延：行 padding 上下 8px + radio 18px |
| G-M4 | P3 | S9 | client.js:504-522 | MutationObserver 已改进（只对新增 menu 节点触发 + setTimeout 调度合并）——肯定；但仍 observe 整个 body subtree，且菜单若以 class 切换（非插入节点）打开会漏触发。观察范围缩到侧栏根 + 保留 body 兜底防抖 |
| G-M5 | P3 | S5/S1 | client.js:390（doneMsg 内联）、:174-179（danger 禁用 opacity .5 仍红底） | R2 M6/M7 顺延：成功走 devkit toast；danger 禁用加灰化 |

### session-search（panel.js，首审）

| # | 级别 | 规范 | 位置 | 问题与建议 |
|---|---|---|---|---|
| G-S1 | **P1** | S3 | panel.js:24-25（按钮 `padding:6px 12px` ≈32px）、:33（.acts 按钮 font 11px + `padding:2px 8px` ≈20px） | 全页可点目标 <44px，主按钮与"复制定位"在手机上难点准。补 `min-height:44px;min-width:44px`（.acts 可 36px 下限） |
| G-S2 | P1 | S10 | panel.js:76-77 | 只提供"复制定位"文本 + 提示"在主界面打开后用 message-ops 定位"——把导航成本全推给用户。加一个「在 Timeline 打开」按钮：`/lazyview?session=<id>&seq=<n>` 直达（生态定位协议已存在，一行 href） |
| G-S3 | P2 | S11 | panel.js:59-66（run 无禁用） | 搜索请求飞行中"搜索"按钮可重复点击；Enter 连击亦然。加 `go.disabled = true` + finally 恢复 |

**session-search 做得好**：--dsw 令牌 + fallback 全覆盖（比 lazy-view 更早达标 S2）；`#status` role=status aria-live（:41）；esc 覆盖引号；lang/viewport 正确。

### lazy-view v0.3.2 Timeline（新 UI 首审）

| # | 级别 | 规范 | 位置 | 问题与建议 |
|---|---|---|---|---|
| G-L1 | **P1** | S7 | panel.html:46（.ghead 可点 div）、:268-274（click 绑定） | 分组折叠头是 div+click：无键盘可达（无 tabindex/Enter/Space）、无 role=button、无 aria-expanded——键盘与读屏用户无法展开任何 turn 组。ghead 改 `<button>`（样式重置）或补 role/tabindex/keydown，并同步 aria-expanded 到 groupOpen Map |
| G-L2 | **P1** | S7（功能性 bug） | panel.html:284（`el.classList.add("target")`） | **CSS 里没有 `.target` 规则**（只有 .masked/.badge/.active）——Go to Message 深链定位后高亮完全不可见，功能静默失效。补一条：`.ev.target { outline: 2px solid #8ab4f8; border-radius: 4px; }` |
| G-L3 | P2 | S5 | panel.html:158/162（topbar .hint） | Timeline 模式提示/错误写进 topbar hint span，不在任何 live region 内，读屏不可闻。给 hint 容器加 `role="status" aria-live="polite"`（或复用页首 #status） |
| G-L4 | P3 | S2 | panel.html:9-43 | 硬编码配色（S4 顺延）：自持页豁免成立，建议按 session-search 模式迁到 `var(--dsw-alias-*, fallback)`，一步到位免维护两套 |

**Timeline 做得好**：masked 语义完整（opacity + "已遮蔽" badge，S7 范本）；1600 帧翻页上限防失控（:256）；折叠状态跨重建恢复（groupOpen Map）；深链未找到有明确提示（:363-365）；数据层（timeline.js）纯函数 + 测试共用，parseDeepLink/applySurfaceOps/buildGroups 设计干净。

### websearch

无新 UI。R2 的 W1（FIELD_LABELS 映射）、W2（breakerCooldownS）、W4（真实分组）顺延；W1 最终判定仍依赖 V5 视觉验证。

## 最该先修的 2 项

1. **G-L2**（lazy-view `.target` CSS 缺失）——Go to Message 深链是生态定位协议的另一半，高亮静默失效等于功能不存在；一行 CSS 即修，且 session-search G-S2 的"在 Timeline 打开"按钮马上会放大这条深链的流量。
2. **G-M1**（message-ops 裸 reload）——规范 S6 唯一的 P1 违规项：破坏性操作成功后整页刷新丢状态，是日常路径而非边缘路径；低成本改造（toast + 手动刷新按钮）一轮可完成。

（G-L1 与 G-S1 紧随其后：一个是新交互的键盘可达性硬伤，一个是新页面的触控目标硬伤，都属"发布前就该有"的基线。）

## 视觉验证待办（承接 V1-V8，新增项标注）

V1-V8 全部仍开放（见 r2-fe.md）。新增：
- **V9**：Timeline 折叠组在 360px 的展开/收起触控与 aria-expanded 表现（修 G-L1 后验证）。
- **V10**：Go to Message 深链端到端：session-search 结果 → lazy-view Timeline 高亮可见（修 G-L2/G-S2 后验证）。
- **V11**：message-ops "显示更多"渐进展开在 200 条大会话上的滚动流畅度（替代原 V4 的部分目标）。

# 前端评审 · fe-ui（本轮四交付 UI/UX/可访问性）

> 评审人：UX 研究员（转前端评审）。范围：dsh-devkit、dsh-message-ops、dsh-session-lazy-view、dsh-websearch 设置文案。
> 只评审不改代码。行号以评审时源码为准。severity：P0=阻断/严重可用性缺陷，P1=明显影响体验或可访问性，P2=应修，P3=建议。

## 总览

| # | 插件/文件 | 发现数 | P0 | P1 | P2 | P3 | 最关键问题 |
|---|---|---|---|---|---|---|---|
| 1 | dsh-devkit `src/client.js`（+core.js） | 7 | 1 | 3 | 3 | 0 | 无焦点陷阱，Tab 可穿透弹层 |
| 2 | dsh-message-ops `src/client.js` | 7 | 0 | 2 | 3 | 2 | 200 条列表无虚拟化 + 全 body MutationObserver |
| 3 | dsh-session-lazy-view `lib/panel.html` | 5 | 0 | 1 | 2 | 2 | 表格 nowrap 在 360px 横向溢出 |
| 4 | dsh-websearch `lib/index.js` 设置段 | 4 | 0 | 0 | 2 | 2 | 设置项 label 是 camelCase 键名非用户语言 |
| — | 跨插件一致性 | 3 | 0 | 0 | 1 | 2 | devkit toast/overlay 宜定为生态标准件 |

**合计 26 条：P0×1、P1×6、P2×9、P3×7、加分项若干（见各节"做得好"）。**

**最影响体验的 3 项**：
1. **D1 devkit 无焦点陷阱**（P0）——键盘用户 Tab 一次就"掉进"弹层背后的页面，Esc 语义随即混乱；这是面板作为生态统一入口的硬伤。
2. **D3 devkit 双层 backdrop-filter blur(24px)+blur(6px)**（P1）——每次打开面板都在低端安卓上触发两次全屏高斯模糊合成，掉帧直接可感；面板是高频操作。
3. **M1+M2 message-ops 200 行无虚拟化 + 全局 MutationObserver**（P1）——低端机开对话框即卡、且 observer 在整个会话期间持续扫描 DOM。

---

## 1. dsh-devkit（src/client.js + src/core.js）

**做得好**：打开即 focus 输入框（client.js:578-584）；选中项滚动跟随 `scrollIntoView({block:'nearest'})`（client.js:620-624）正确且不会拖动背景页；listbox/option/aria-selected 骨架已就位（client.js:689-708）；`isTextInputTarget` 豁免聊天输入框（client.js:138-144, 480）；chord 状态机纯函数化有测试参照（core.js:139-171）。core.js 本身无发现。

### D1 · P0 · 无焦点陷阱（focus trap）
`client.js:725` 声明了 `role="dialog"`，但没有任何 Tab 拦截：焦点可以走出面板落到被遮罩的背景页，Esc 虽能关闭，但 Tab 后用户以为 Esc 在操作面板。修复（在 overlay 的 Esc 监听同处加 Tab 处理）：

```js
// DevkitOverlay 的 keydown effect（client.js:588-599）内追加：
if (e.key === 'Tab') {
  e.preventDefault() // 单输入框场景：焦点只有输入框，Tab 循环回自身即可
  // 若后续面板出现多焦点元素，改为首/尾元素循环
}
```
同时关闭时还原焦点：打开前记录 `document.activeElement`，`close()` 后 `prevFocus?.focus()`（当前 client.js:586 直接 setMode(null)，焦点丢失到 body）。

### D2 · P1 · dialog 缺 aria-modal，listbox 未与输入框做 combobox 关联
- `client.js:725`：`role="dialog"` 应加 `aria-modal="true"`，否则读屏器仍可漫游背景内容。
- `client.js:679-689`：input 与 listbox 是分离的两个元素，推荐补成 combobox 模式：input 加 `role="combobox" aria-expanded="true" aria-controls="devkit-list" aria-activedescendant="devkit-opt-{selected}"`，list 加 `id="devkit-list"`，每个 option 加唯一 `id`。这样读屏器朗读"第 N 项，已选中"。

### D3 · P1 · backdrop-filter 双层模糊，低端安卓性能
`client.js:495`（backdrop 6px）+ `client.js:505`（panel 24px）：两个 fixed 层同时开 backdrop-filter，在 Mali/G52 级 GPU 上每帧都是全屏离屏合成。建议：panel 保留 blur（面积小），backdrop 改纯色遮罩 `rgba(0,0,0,.45)`；或统一用 CSS 变量 + `@supports` 检测降级：

```js
const backdropStyle = { ..., background: 'rgba(0,0,0,.45)' } // 去掉 backdropFilter
```

### D4 · P1 · Toast 无 aria-live
`client.js:243-278`：toast 容器没有 `aria-live`，读屏用户完全听不到"导出成功/删除失败"。修复一行：

```js
host.setAttribute('role', 'status')          // polite
host.setAttribute('aria-live', 'polite')     // error 类可另起 aria-live="assertive" 容器
```

### D5 · P2 · 动画未尊重 prefers-reduced-motion
`client.js:227-233` 的 toast 进出场 keyframes 无 media gate。在注入的 style 里追加：

```css
@media (prefers-reduced-motion: reduce) {
  [data-devkit-toast] { animation: none }
  [data-devkit-toast].dsh-devkit-toast-out { animation: none }
}
```

### D6 · P2 · 触控目标不足 44px
命令行高约 9+20+9=38px（`client.js:518-521`），头部按钮 28×28（`client.js:785-790`）。建议行 padding 上下加到 12px 或用透明 hit-area 扩到 min-height 44px；头部按钮可保持视觉 28px 但外包 44px 点击区（padding 或伪元素）。

### D7 · P2 · 无 MRU/使用频次排序
`matchCommands`（client.js:157-165）纯子串匹配、注册顺序输出。不阻塞本版，但与 vscode-parity 规划（MRU + fzf 打分）呼应：至少给"上次执行的命令"置顶。归属下一版。

---

## 2. dsh-message-ops（src/client.js）

**做得好**：label 包裹 radio 天然可达（client.js:322-339）；错误 `role="alert"`（client.js:391）；运行中警告/风险确认勾选流程完整；locale 双语 + 刷新菜单标签（client.js:504）；Modal 复用宿主 primitives 而非自绘。

### M1 · P1 · 200 条消息列表无虚拟化
`client.js:304`（`visible.slice(-MAX_RENDER)`，MAX_RENDER=200）+ `client.js:317-339`：200 个 label+radio+span 渲染在 maxHeight 260px 的滚动容器里。低端机两点开销：初始 200 个 DOM 节点（每行 3 个元素 = 600+ 节点），以及滚动时 `ellipsis` nowrap 的布局抖动。低成本改造（不必上虚拟化库）：
- 分批渲染：先渲染 50 条，`list` 滚动到顶时再向前补 50（复用 lazy-view 的 sentinel 思路）；
- 或 `MAX_RENDER` 降为 50 并把 `dialog.more` 文案改为"显示最近 50 条（共 {n}）——在 lazy-view 中查看全部"。

### M2 · P1 · document.body 全量 MutationObserver
`client.js:470-477`：`observe(document.body, {childList:true, subtree:true})`，每次 DOM 变化都跑 `querySelectorAll('[class*=sessionRow]') + querySelector('[role=menu]')`。会话运行时消息流高频变化，这是持续的后台开销。建议：
- 检测目标改为只观察侧栏根节点（找到一次后记引用，找不到时退化为 body 观察但用防抖）；
- 或 MutationObserver 回调内 `requestAnimationFrame` 合并 + 首行早退（menu 未开直接 return，当前实现至少早退成本低，但 querySelector 本身就是成本）。

### M3 · P2 · radio 组缺 fieldset/legend（或 aria-label）
`client.js:316-322`：「选择一条消息：」是普通 div，与下面的 radio 组无程序关联；操作模式组（`client.js:341-350`）同理。读屏用户听到的是 200 个无组名的 radio。修复：

```js
React.createElement('fieldset', { style: { border: 'none', margin: 0, padding: 0 } }, [
  React.createElement('legend', { style: metaStyle }, t('dialog.pick')),
  React.createElement('div', { style: listStyle, role: 'radiogroup' }, ...),
])
```

### M4 · P2 · 触控目标不足
radio 原生 ~16px、行高 4+18+4=26px（`client.js:155-158`）。360px 手机上 200 行列表点选极易误触。label 已扩大点击区到整行，但行本身 26px 仍偏小：行 padding 上下改 8px（高 34px）+ radio 加 `width/height:18px` 或 `accent-size`，可达 40px+。

### M5 · P2 · 成功后 `window.location.reload()` 粗暴
`client.js:291`：回滚/删除成功后 900ms 整页刷新——丢失滚动位置、重置所有插件状态（devkit 面板、websearch 设置展开等），在手机上还有一次全量白屏。局部刷新改造成本评估：
- **低成本（推荐先做）**：改用 `location.reload()` 之外的软恢复——调 `__sessionsSvc.refreshList()`（分支路径 client.js:284 已这么做）+ 派发宿主会话重载事件（若宿主提供；无则保留 reload 但把提示从"即将刷新"改为可点击的"刷新"按钮，让用户选时机）；
- **中成本**：宿主若无 surface 失效事件，推动 DSH 核心加一个 `session:invalidate` 事件（本插件场景就是第一个消费者）。
- 注意 `done.branch` 分支成功后弹层留在原地、回滚/删除却强制 reload，两条路径行为不一致，统一为"成功 → toast + 弹层关闭 + 局部刷新"。

### M6 · P3 · danger 视觉一致性
`client.js:174-179`：danger 按钮用 error 色作填充底，OK；但禁用时 `opacity:0.5` 保留红底（client.js:382），与 cancel 禁用同样式，危险按钮禁用态建议加灰化（`filter:grayscale(.4)`）避免"红色但点不动"的歧义。另外模式 radio + 确认按钮是两级确认，回滚的 ack 文案（client.js:47）很好，保持。

### M7 · P3 · 成功提示只用内联文本，未接 devkit toast
`client.js:390` doneMsg 内联展示；既然 devkit toast 已是生态件，成功/失败统一走 `window.__dshDevkit.toast(msg,{kind})`，弹层只负责流程。

---

## 3. dsh-session-lazy-view（slv-check/lib/panel.html）

**做得好**：viewport meta 正确（panel.html:5）；`lang="zh-CN"`（panel.html:2）；哨兵+视口锚定预载设计对手机浏览器确定性高、注释清楚（panel.html:126-133, 198-208）；搜索框打开即 focus（panel.html:239）；AbortController 透传取消上次搜索（panel.html:67）；导出为普通 `<a download>`。整体是我见过移动端考虑最多的自持页。

### S1 · P1 · 360px 移动端表格横向溢出
`panel.html:13`（`td,th { white-space:nowrap }`）+ `panel.html:221-226`：session id（uuid 级长度）+ format + size + mtime + 两个按钮全部 nowrap，360px 宽必然横向滚动，按钮可能被推到屏幕外。修复：

```css
td, th { padding: 3px 8px; border-bottom: 1px solid #232a35; text-align: left; }
td { white-space: nowrap; }
td.session-id { max-width: 9em; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 480px) {
  .hide-sm { display: none }   /* mtime 列加 class，360px 上隐藏 */
}
```
mtime 列 `panel.html:221` 加 `class="hide-sm"`；session id 列加 `td.session-id`。

### S2 · P2 · 触控目标不足 44px
`panel.html:16` 按钮 `padding:2px 10px` ≈ 26px 高；「打开」「搜索」「↑ 加载更早」「统计」全受影响。改 `padding:8px 12px`（≈36px）并加 `min-height:36px`，或外扩 hit-area。手机上这是主操作按钮，建议 ≥44px：`padding:10px 14px`。

### S3 · P2 · 统计展开 CLS
`panel.html:94-97`：展开全量统计时 `info.innerHTML` 重写并插入类型计数的额外 `<div class="meta">`，下方内容整体下跳；fast→full 两段式各自高度不同。修复：给 `.sinfo` 预留 `min-height:20px`，展开 full 前把 byType 行用固定占位（或 `content-visibility:auto`）；最简单是 `statsInfo.style.minHeight = statsInfo.offsetHeight + 'px'` 在替换前锁定。

### S4 · P3 · 硬编码配色，未用 --dsw-* 令牌
`panel.html:9-35` 全部 `#11151c` 系硬编码。作为**独立自持页**（非宿主内嵌面板）可豁免——它不在宿主主题域内。建议文档化此豁免，但把调色板抽成 `:root` 变量（8 个变量即可），便于未来换主题。

### S5 · P3 · #status 无 aria-live
`panel.html:40` + `panel.html:217,245`：加载/错误状态文本更新读屏不可闻。`<div id="status" role="status" aria-live="polite">`。

---

## 4. dsh-websearch 设置项文案（lib/index.js）

**做得好**：description 全部是中文、面向用户语言且解释了默认值与边界（如 `index.js:158`「0 语义请直接关闭 cacheEnabled」主动消歧）；`enableExa` 等开关直接用后端友好名作 description（`index.js:170-177`）。

### W1 · P2 · 6 个新设置项的 label 是 camelCase 键名
`index.js:154-166`：`cacheEnabled / cacheTtl / breakerEnabled / breakerThreshold / breakerCooldownMs / historyEnabled`——若宿主 installSection 用 schema 键名当 label（需真机确认，见视觉验证待办 V5），用户看到的是代码名。修复：确认宿主是否支持 per-field label；若不支持，把字段名改成语义化（`cacheTtlS`）或在 Config 层提供 label 映射（参照 `DEFAULT_LABELS` 模式，index.js:109）：

```js
const FIELD_LABELS = {
  cacheEnabled: '磁盘缓存', cacheTtl: '缓存有效期(秒)',
  breakerEnabled: '后端熔断器', breakerThreshold: '熔断阈值(次)',
  breakerCooldownMs: '熔断冷却(毫秒)', historyEnabled: '搜索历史',
}
```

### W2 · P2 · 同组单位不一致：cacheTtl 用秒、breakerCooldownMs 用毫秒
`index.js:155-163`：一个组里 "900s" 与 "60000ms" 混排，用户换算负担大。建议统一为秒：新增 `breakerCooldownS`（默认 60），`breakerCooldownMs` 保留为兼容别名（resolve 时二选一，index.js:297 处已有 Math.max 兜底，加一行优先读秒版即可）。

### W3 · P3 · 条件显隐
`breakerThreshold/breakerCooldownMs` 在 `breakerEnabled=false` 时仍然显示且可改。若宿主设置段支持条件显隐（需查 `installSection` 能力），加 `when: 'breakerEnabled'`；不支持则至少在 description 里加「仅在熔断器开启时生效」。

### W4 · P3 · 分组与排序
6 个新项插在 `resultTelemetry` 与后端开关之间（`index.js:154-166`），逻辑上合理（都是"管线行为"），但平铺无小节标题。建议 description 首词统一前缀或在宿主支持分组时按「缓存 / 熔断 / 历史」三小节排；后端 enable 开关区保持置后不变。

---

## 5. 跨插件一致性

### C1 · P2 · --dsw-* 令牌使用不一致
- devkit：✅ 全量 `--dsw-alias-*` + 优雅 fallback（client.js:236-241, 503-534）。
- message-ops：✅ 同样规范（client.js:129-183）。
- session-lazy-view：❌ 硬编码（S4，自持页可豁免但需文档化）。
- websearch 设置：N/A（宿主渲染）。
**规范建议**：宿主内嵌 UI 必须只用 `--dsw-alias-*` 且带 fallback；独立自持页（自有 HTTP 端点直出的 HTML）豁免，但调色板须抽成 `:root` 变量并在 README 标注"不随宿主主题"。

### C2 · P3 · 错误提示风格三种并存
devkit = toast(kind:'error')（client.js:390）；message-ops = 内联红字 role=alert（client.js:391）；lazy-view = `error: ${message}` 纯文本（panel.html:79,175）。建议统一为：**操作失败 → devkit toast(kind:'error')；表单内校验错误 → 内联 role=alert；两者可叠加**。lazy-view 作为独立页用 `role="alert"` 即可。

### C3 · P3 · devkit toast/overlay 定为生态标准件（1 页纸规范建议）
现状已是事实标准（message-ops 的弹层走 shell.overlay、devkit 命令面板已联动 websearch/message-ops）。建议沉淀为 `docs/dsh-ui-spec.md` 一页纸，要点：
1. **弹层**：一律 `shell.overlay` 槽；`role="dialog" aria-modal="true"`；开焦点进首个可交互元素、关焦点还原；Tab 陷阱必做（参照 D1 代码）。
2. **通知**：一律 `window.__dshDevkit.toast(msg, {kind})`，kind ∈ info/ok/warn/error；容器 `role="status" aria-live="polite"`（devkit 实现）。
3. **令牌**：宿主内嵌只用 `--dsw-alias-*` + fallback；禁止硬编码色值。
4. **触控**：交互目标 ≥44×44px（视觉可 28px + hit-area 扩展）。
5. **文案**：中文为主，description 写清默认值与边界（websearch 风格为准）；双语走 locale 服务（zh/en dict + fallback，devkit/message-ops 模式）。
6. **动效**：所有 keyframes 加 `@media (prefers-reduced-motion: reduce)` 关断。
7. **刷新**：禁裸 `location.reload()`；优先局部刷新/宿主失效事件（M5 路线）。

---

## 视觉验证待办（必须真机截图/实测确认）

| # | 项 | 方法 | 关联发现 |
|---|---|---|---|
| V1 | devkit 面板 360px 宽度与高度：键盘弹起后 56vh 面板是否被输入法遮住、行是否可点 | 360px 视口截图（Android Chrome，键盘展开态） | D6 |
| V2 | devkit backdrop blur 在低端机的帧率：打开/关闭面板时是否掉帧 | Termux 本机 Chrome devtools performance 录制 5s | D3 |
| V3 | devkit toast 在 360px 下不遮挡底部输入框；连续 5 条 toast 堆叠不溢出 | 连续触发导出/删除失败 toast 截图 | D4 |
| V4 | message-ops 200 行对话框滚动流畅度（大会话 500+ 消息） | 大会话真机滚动录屏；对比 MAX_RENDER=50 | M1 |
| V5 | websearch 设置面板：6 个新项实际显示的 label 是键名还是 description；分组视觉 | 打开宿主 Settings 面板截图 | W1/W4 |
| V6 | lazy-view 列表页 360px：mtime 列是否被推出视口；表格横向滚动条是否出现 | 360px 截图 sessions 列表页 | S1 |
| V7 | lazy-view 统计展开前后的布局跳动幅度（CLS） | Chrome devtools CLS 面板实测 | S3 |
| V8 | 深色/浅色两套宿主主题下 devkit + message-ops 的令牌 fallback 是否漏白 | 切主题截图对比 | C1 |

（V1–V8 本轮未执行——无真机截图通道；下一轮评审前由各插件作者自测并在本文档勾销。）

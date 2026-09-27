# 前端复审 R2 · r2-fe（R1 修复交叉勾销）

> 复审对象（均为 R1 修复后代码，只读复审）：
> - dsh-devkit v0.1.1（commit 3cdad38，`~/dsh-plugins-src/dsh-devkit/src/client.js`，963 行）
> - dsh-message-ops v0.2.1（`src/client.js` 本轮未动，md5 ce11fb65…，改动在服务端信任围栏）
> - dsh-session-lazy-view v0.2.1（commit 05dd611，`~/slv-check/lib/panel.html`，273 行）
> - dsh-websearch v2.7.1（commit c6b28de，`lib/index.js` 设置段）
>
> verdict 口径：**FIXED**（按建议落地）/ **PARTIAL**（部分落地或有边界缺口）/ **OPEN**（未动）。行号为复审时源码。

## 勾销表（fe-ui 26 条）

### dsh-devkit（v0.1.1）

| # | R1 发现 | verdict | 证据 |
|---|---|---|---|
| D1 | P0 焦点陷阱/还原 | **PARTIAL** | 还原 ✅：开时记录 `prevFocusRef`（client.js:627），`close()` 还原（client.js:650-658）。Tab 拦截 ✅（client.js:674-677 全局 preventDefault）。**缺口**：v0.1.1 新增的 confirmDelete 模式有 **两个可聚焦按钮**（取消 client.js:769、确认 client.js:773），而 Tab 拦截是全局硬 preventDefault——键盘用户被钉死在确认按钮上，无法 Tab 到"取消"再 Esc；代码注释（client.js:669-673）自己写的"若面板出现多焦点元素需改为首尾循环"的条件已经触发但未实现。修复：Tab 处理改为按 `panel.querySelectorAll('button,input,[tabindex]')` 首尾循环（约 10 行）。**另见新发现 N1。** |
| D2 | P1 aria-modal + combobox 关联 | **PARTIAL** | `aria-modal="true"` ✅（client.js:834）。combobox/`aria-activedescendant`/option id 仍未做（input client.js:788-797 无 role=combobox，listbox client.js:798 无 id，option client.js:809-819 无 id）——读屏器仍听不到"第 N 项已选中" |
| D3 | P1 双层 backdrop-filter | **FIXED** | backdrop 改纯色 scrim `rgba(0,0,0,.45)`（client.js:542-548，注释点名 fe-ui D3）；panel 保留 24px blur（面积小，符合 R1 建议） |
| D4 | P1 toast 无 aria-live | **FIXED** | 容器 `role="status" aria-live="polite"`（client.js:278-279）。注：error 类 toast 也是 polite（R1 建议可另起 assertive 容器），可接受 |
| D5 | P2 reduced-motion | **FIXED** | toast 注入样式的 `@media (prefers-reduced-motion: reduce)` 关断（client.js:251-254） |
| D6 | P2 触控目标 <44px | **OPEN** | 命令行仍 `padding:'9px 16px'`（client.js:570-573，约 38px）；头部按钮仍 28×28（client.js:894-896）。新 confirmDelete 按钮 minHeight 36（client.js:771,779）仍不足 44 |
| D7 | P2 MRU 排序 | **OPEN** | matchCommands 仍纯子串+注册序（client.js:173-181），无变化（R1 即标注"归属下一版"） |

**devkit 超出范围的加分项**：删除当前会话改为确认弹层（client.js:757-782）＋运行中警告、websearch 死命令探测（ack 300ms + readiness flag，client.js:470-483）、registerCommand 幂等去重（client.js:336-345）、双源一致性测试（client.js:24-26）。均好。

### dsh-message-ops（v0.2.1，client.js 未动）

| # | R1 发现 | verdict | 证据 |
|---|---|---|---|
| M1 | P1 200 行无虚拟化 | **OPEN** | `MAX_RENDER=200` 与列表渲染逻辑原样（R1 client.js:304/317-339 → 本版同位） |
| M2 | P1 全 body MutationObserver | **OPEN** | `observe(document.body,{childList:true,subtree:true})` 原样（R1 client.js:474-477） |
| M3 | P2 radio 缺 fieldset/legend | **OPEN** | 「选择一条消息：」仍为普通 div |
| M4 | P2 触控目标不足 | **OPEN** | 行高仍 26px、radio 原生尺寸 |
| M5 | P2 location.reload() | **OPEN** | 成功路径仍 900ms 后整页刷新；branch 与 revert 成功行为仍不一致 |
| M6 | P3 danger 禁用态灰化 | **OPEN** | 仍 opacity:0.5 保留红底 |
| M7 | P3 成功提示接 devkit toast | **OPEN** | 仍仅内联 doneMsg |

（v0.2.1 的修复都在服务端信任围栏/导出流式化，客户端 7 条全部顺延，**清单见"遗留清单"**。）

### dsh-session-lazy-view（v0.2.1）

| # | R1 发现 | verdict | 证据 |
|---|---|---|---|
| S1 | P1 360px 表格溢出 | **FIXED** | `td.session-id` 截断（panel.html:16、244 title 提示全文）+ mtime 列 `hide-sm` 480px 以下隐藏（panel.html:17、244、249），与 R1 建议一致 |
| S2 | P2 触控目标 | **FIXED** | 按钮 `min-height/min-width:44px`（panel.html:21）。注：新增 .discover 小按钮 min 32px（panel.html:43）是次级说明区，可接受 |
| S3 | P2 统计展开 CLS | **FIXED** | `.sinfo` 预留 min-height:20px（panel.html:39）+ 替换前锁定高度、渲染后释放（panel.html:111、120），比 R1 建议更完整 |
| S4 | P3 硬编码配色 | **OPEN** | 仍硬编码（panel.html:9-43）。独立自持页豁免成立，但 `:root` 变量化与 README 标注仍未做 |
| S5 | P3 #status aria-live | **FIXED** | `role="status" aria-live="polite"`（panel.html:50） |

**加分项（R1 视觉待办之外）**：可发现性说明条 + 复制面板链接按钮（panel.html:48-49、58-66），解决了"宿主无入口"的 P0 级发现性问题，剪贴板降级 prompt 处理正确。

### dsh-websearch（v2.7.1）

| # | R1 发现 | verdict | 证据 |
|---|---|---|---|
| W1 | P2 label 为 camelCase 键名 | **PARTIAL** | description 已改为用户语言 + 【缓存】/【熔断】/【历史】分组前缀 + 单位明示（index.js:155-169，注释点名 fe-ui W1）——描述层问题解决；但字段键名 `cacheEnabled/cacheTtl/…` 未变，若宿主以键名作 label（V5 待验证），显示仍是代码名。FIELD_LABELS 映射未做 |
| W2 | P2 秒/毫秒单位混排 | **PARTIAL** | 未统一为秒（R1 建议 breakerCooldownS），改为"单位明示 + 0=关闭冷却"语义（index.js:166-167、300-301）。可读性达标，换算负担仍在 |
| W3 | P3 条件显隐 | **OPEN** | breakerThreshold/cooldown 仍恒显；仅 description 补充了语义 |
| W4 | P3 分组排序 | **PARTIAL** | 无真实分组控件，但【缓存】/【熔断】/【历史】前缀在平铺列表里达到了同样的可扫读效果；字段顺序未动 |

### 跨插件一致性

| # | R1 发现 | verdict | 证据 |
|---|---|---|---|
| C1 | P2 --dsw-* 令牌 | **OPEN** | devkit/message-ops 维持规范；slv 仍硬编码（S4 顺延） |
| C2 | P3 错误提示三种风格 | **OPEN** | 无插件侧收敛；devkit toast 现已具备 aria-live，标准件能力更完整，但 C3 未落 |
| C3 | P3 devkit toast/overlay 标准件 1 页纸规范 | **OPEN** | `docs/dsh-ui-spec.md` 未创建 |

## 新发现（R1 之后引入/暴露）

| # | severity | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| N1 | **P1** | devkit client.js:674-677 × 757-782 | confirmDelete 模式 Tab 陷阱退化：两个按钮间无法移动（见 D1）。键盘用户想取消只能 Esc——功能可达但违背 WAI-ARIA dialog 模式预期 | Tab 改为首/尾焦点元素循环，palette 单输入框场景行为不变 |
| N2 | P3 | devkit client.js:35 | `VERSION = '0.1.0'` 与 commit 标记 v0.1.1 不符，devinfo 面板会显示旧版本 | bump 为 '0.1.1'（或在构建时注入） |

## 遗留清单（下一轮修复建议顺序）

1. **N1**（P1，devkit）：confirmDelete Tab 循环——D1 修复的收尾，10 行内。
2. **M2**（P1，message-ops）：MutationObserver 缩小观察范围/防抖——持续后台开销。
3. **M1**（P1，message-ops）：200 行分批渲染或 MAX_RENDER=50。
4. **D2 剩余**（P1，devkit）：combobox/activedescendant/option id。
5. M3-M7（P2/P3，message-ops）：radio 语义、触控、reload→局部刷新、danger 禁用态、接 devkit toast。
6. D6（P2，devkit）：行高与头部按钮 44px。
7. W2 完整版（P2，websearch）：breakerCooldownS 统一秒（保留 ms 兼容别名）。
8. S4/C1/C2/C3、D7、W1 FIELD_LABELS、W3、N2：P3 顺延。

## 仍开放的视觉验证待办（R1 V1-V8 顺延，含状态更新）

| # | 项 | 状态 |
|---|---|---|
| V1 | devkit 面板 360px + 键盘展开遮挡 | 开放（新增：confirmDelete 双按钮 360px 下的可达性一并验证） |
| V2 | backdrop blur 帧率（backdrop 已单层化，重点转为 panel 24px blur 单层实测） | 开放，条件更优 |
| V3 | toast 360px 堆叠/遮挡 | 开放 |
| V4 | message-ops 200 行大会话滚动 | 开放（M1 未修，必要性更高） |
| V5 | websearch 设置面板 6 项 label 实际渲染（键名 vs description；【缓存】前缀显示效果） | 开放，**优先级升高**（W1 verdict 依赖此项） |
| V6 | lazy-view 360px 列表页 | 开放（S1 已修，验证收尾） |
| V7 | lazy-view 统计 CLS | 开放（S3 已修，验证收尾） |
| V8 | 双主题令牌 fallback | 开放 |

## 计数小结

- **26 条 R1 发现：FIXED 7、PARTIAL 5、OPEN 14。**
- FIXED 明细：D3、D4、D5、S1、S2、S3、S5。
- PARTIAL 明细：D1（陷阱✅/confirmDelete 缺口）、D2（aria-modal✅/combobox 未做）、W1、W2、W4。
- **仍开放 P0：0**（R1 唯一 P0 D1 已实质修复，残留缺口降级为 N1/P1）。
- **仍开放 P1：4 条**——N1（新）、M1、M2、D2 剩余部分。

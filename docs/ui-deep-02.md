# UI 深化审计 · ui-deep-02（0.2.0 令牌终裁 + devkit 推导审计）

> 审计人：常驻前端 UI 设计大师。证据源：0.2.0-rc.2 编译产物（dsh-web-frontend/dist/assets/*.css、index bundle）与源码包（dsh-client-ui-theme/lib/client.js、dsh-api-session-controller types、dsh-client-ui-workspace/client.js）。静态产物逐字提取代替真机截图；标注「待真机」处需 Playwright 复核。

## 1 · B4 令牌漂移终裁

### 1.1 裁定方法
0.2.0 的令牌**定义源**在 dsh-client-ui-theme/lib/client.js（light/dark 两块静态色阶映射）；dist CSS 只是消费侧。定义源枚举得 **96 个 `--dsw-alias-*`** 名。主题对：light 在前 dark 在后（bg-base light=bluish-00 #fff / dark=bluish-950 #151517 可证）。

### 1.2 终裁结论
| 六包使用的令牌 | 0.2.0 存量 | 裁定 |
|---|---|---|
| label-primary/secondary/tertiary | ✅ | 存活，无需动 |
| border-l1 / l2 | ✅ | 存活（light #0000000a / dark #ffffff0f） |
| state-success/warn/error-primary | ✅ | 存活 |
| interactive-bg-hover | ✅ | 存活（light `#2631480f` / dark `#ffffff14`） |
| brand-primary | ✅ | 存活 |
| **surface-primary** | ❌ 已删 | devkit 面板底色失真 → 修正表 M1 |
| **interactive-bg-selected** | ❌ 已删 | devkit 选中行失真 → M2 |
| bg-canvas / input-bg / bg-elevated / warn / info / danger（session-search） | ❌ **从未存在** | 六个自造名一直吃 fallback → M3-M5 |
| toast 用 surface-primary | ❌ 同上 | devkit toast 底色 → M4 |

主题体制：0.2.0 为 light/dark 双主题（静态色阶 7 处 colorScheme 引用），**所有裸深色 fallback 在 light 主题下都是错误色**——这是 B4 的实际风险面。

### 1.3 修正色值表

| # | 位置（现状） | 现用令牌→fallback | 0.2.0 实测值（light / dark） | 修正 |
|---|---|---|---|---|
| M1 | devkit 面板底 `panelStyle.background` | `--dsw-alias-surface-primary` → `rgba(28,28,30,.96)` | **bg-layer-1**：light `#ffffff` / dark `#232324` | 改 `var(--dsw-alias-bg-layer-1, #fff)`；如需面板遮透感叠 `--dsw-alias-bg-overlay` |
| M2 | devkit 选中行 `background` | `--dsw-alias-interactive-bg-selected` → `rgba(128,128,128,.18)` | **interactive-bg-hover**：light `#2631480f` / dark `#ffffff14`（另有 -active / -hover-solid） | 改 `var(--dsw-alias-interactive-bg-hover, #2631480f)`（与原生 action hover 同源） |
| M3 | devkit backdrop `rgba(0,0,0,.45)`（0.2.2 已单层化） | 硬编码 | **bg-mask-1**：light `#0000003d` / dark `#00000080` | 改 `var(--dsw-alias-bg-mask-1, rgba(0,0,0,.45))` |
| M4 | devkit toast 底 `rgba(30,30,32,.95)` | surface-primary 系 | **toast-bg**：light `#353638`(bluish-800) / dark `#43454a`(bluish-750)；label 配 `--dsw-alias-toast-label` | 改 `var(--dsw-alias-toast-bg, #353638)` + `var(--dsw-alias-toast-label, #fff)`（官方 toast 令牌本就存在） |
| M5 | session-search：`bg-canvas` / `input-bg` / `bg-elevated` / `warn` / `info` / `danger` | 六个自造名 | 对应存活令牌：**bg-base**（#fff/#151517）、**bg-layer-2**、**bg-layer-1**、**state-warn-primary**、**link**（或 state-business-primary）、**state-error-primary** | 全部改名迁移；fallback 字面量同步换（light 为准：#fff / #f9fafb / #fff / state / #4c65df 类 / #ef4444 系） |
| M6 | lazy-view 硬编码 `#11151c` 系 | 无令牌 | bg-base dark=#151517 | 可维持豁免（自持页），若迁移按 M5 同表 |

**落地次序**：M4（toast 是官方既有令牌，一行改）→ M1/M2（devkit 观感）→ M5（session-search 改名）→ M3（backdrop，随下次动 devkit 时顺手）。

## 2 · devkit 0.2.7 当前会话推导审计

### 2.1 宿主 canonical 模式（实证）
`Object.values(byId).find(row => (row.retainedBy.mainView ?? 0) > 0)?.id` 出现于宿主五处：client-ui-workspace/client.js:**260**（lead 指认处）、:106、:2319；client-ui-cordis:741；client-ui-layout:60；client-ui-agent-preset:1586/1666；open-in-app:770；session:283。类型依据：`SessionSummary.retainedBy` 携带 `SessionRetainInfo['retainedBy']`（service.d.ts:30），`sessions.list: SnapshotStore<SessionListState>`（:96）。

### 2.2 devkit 0.2.7 `deriveCurrentSessionId` 逐条裁定
| 顺序 | 分支 | 裁定 |
|---|---|---|
| 1 | `uiWorkspaceTarget` 优先 | ⚠ **探测源是死代码**：`pickUiWorkspaceTargetId` 读 `uw.mainView.sessionId/target/current`——"mainView" 是 retention **source 名**（workspace/client.js:973 `retain(target,{source:'mainView'})`），uiWorkspace 服务 face 无此字段 → 恒 undefined → 恒落空。无害但应删（G-13c） |
| 2 | `byId` 扫 `retainedBy.mainView > 0` | ✅ **与宿主逐字同构**（workspace:260 同款）。语义正确性：`retainedBy` 是"本页本地所有权计数"（service.d.ts:30 注释 "Local ownership counts"），mainView>0 即本页主视图当前会话——跨窗口不会串（各页各 store）。`Object.keys` 首个命中与宿主 `.find` 语义一致 |
| 3 | `snap.current` | 0.2.0 SessionListState 无此字段（ids/byId/phase/…），恒 miss，无害兜底（兼容 ≤0.1.x） |
| 4 | `snap.phase.current/…` | 同上，phase 是 SessionListPhase 枚举非对象，恒 miss |
| 5 | `projectionsBySession` 遍历 | 0.2.0 无此字段，恒 miss |

### 2.3 结论与边界
- **推导正确**：主路径与宿主 canonical 同构，可作为 0.2.0 的定案写法。
- **对 compat-02 B2 的修正**（重要）：devkit 的 `snap.byId/ids` 读**在 0.2.0 存活**（`sessions.list` 是 SnapshotStore 属性，runner 方法目录只列了方法漏了属性——我在 compat-02-c 中判"list/open/refreshList/create 全落空"过宽，**特此修正：仅 `open`/`refreshList` 两成员缺失，`create` 在（service.d.ts:179），`list` 在**）。B2 断裂面收窄为"打开会话/刷新列表两点"，修复量级下调。
- 边界 1：空白 New-Session 行（`blank:true`）也在 byId 且可带 mainView 保留——返回它作为 current 是**正确**的（它就是当前视图），宿主 agent-preset:1586 的 `blank && mainView>0` 特判场景与此不冲突。
- 边界 2：`Object.keys` 命中顺序在多保留（如未来分屏多 mainView）时不确定——与宿主同风险，暂不处理。
- 待真机：retainedBy.mainView 在"切换会话后 300ms 内"的计数翻转时序（旧页 retain 释放与新页 acquire 的交错）建议 Playwright 验证一次 devinfo 面板的当前会话显示。

## 3 · 汇总
- S13：8 条（S13.1-S13.8，已追加进 dsh-ui-spec.md）+ GAP 增量 5 条（G-13a…G-13e）。
- 令牌终裁：6 行修正表（M1-M6），含官方 toast 令牌意外收获（M4）。
- 推导审计：正确（与宿主 workspace:260 同构）；附 B2 修正——0.2.0 `sessions.list`/`create` 存活，断裂面收窄至 open/refreshList。

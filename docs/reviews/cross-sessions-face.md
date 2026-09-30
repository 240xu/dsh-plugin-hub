# cross-sessions-face — 0.2.0「sessions 服务 face」分歧裁决

> 仲裁：msgops-innovator（A 线）。分歧：A 线「useSessions 是 0.2.0 标准 prop，
> message-ops 反而更稳」 vs C 线「sessions face 整体重塑：list/open/refreshList/
> create 全部不存在，devkit/session-delete 探测全落空（B2 P0）」。
> 结论先行：**两者各对一半——useSessions（slot prop face）未重塑，
> ctx.get('sessions')（ISessions 服务 face）确已重塑；受影响的是 devkit 与
> message-ops 各一处探测，message-ops 仅优雅降级，devkit 两处功能性失效。**
> 全部结论基于 RT 0.2.0-rc.2 构建产物逐行核实。

## 1. useSessions slot prop 现返回什么（A 线面，未重塑）

- 类型：`UseSessions = SnapshotSelectorHook<SessionListState>`
  （RT dsh-client-ui-session/lib/types/client/index.d.ts:7；经
  GlobalStandardProps 注入 slot 组件，同文件 :73）。
- `SessionListState`（RT dsh-api-session-controller/lib/types/client/sessions/service.d.ts）：
  `{ ids: SessionId[], byId: Record<SessionId, SessionSummary>, phase,
  projectionsBySession }`——**byId 仍在**。
- `SessionSummary`（同文件）：`title?: string`（log-backed）、`running: boolean`
  （"Host running state"）、displayLabel、retainedBy 等。
- **判定**：message-ops OpsButton（src/client.js:432-433
  `useSessions((s)=>s).byId[sessionId]` 读 `running`/`title`）在 0.2.0 下**全部
  字段仍在，行为不变**——A 线结论对该 face 成立。

## 2. ctx.get('sessions') 服务 face 现状（C 线面，确已重塑）

- RT `dsh-api-session-controller/lib/types/client/contract/sessions.d.ts`
  `ISessions` 成员全貌：`list: ObservableSnapshot<SessionListState>`、
  **retain / using / retainInfo / create / subagentAddress /
  refreshProjections / refresh / search / searchResultLimit**。
  注释明示「navigation belongs to view owners」（list 行 doc）。
- **没有 `open`、没有 `refreshList`**（全契约 grep 零命中）；旧 open 语义由
  **uiWorkspace.openSession** 接管（RT dsh-client-ui-workspace/lib/client.js:821
  `openSession(target){ this.replaceMain(target, …, "reveal") }`；接口声明
  types/client/navigation.d.ts:94 `UiWorkspace.openSession(target): void`；
  服务注册名 "uiWorkspace"，client.js:772；mainView 归属：sessions.retain(
  target, {source:"mainView"}) :971）。
- 旧 refreshList 语义由 **ISessions.refresh()** 承接（client.js:3259
  `refresh() { return this.manager.refreshList() }`；manager 内部方法 :2603
  不在契约上）。
- **C 线「create 不存在」不准确**：`create(opts?)` 在契约上（sessions.d.ts
  ISessions :38 附近），只是签名结构化（SessionCreateError/SessionForkError）。

## 3. 逐包真实行为判定

### message-ops（src/client.js）

| 探测点 | 0.2.0 行为 | 判定 |
|---|---|---|
| OpsButton `useSessions((s)=>s).byId[...]`（:432-433） | byId/running/title 均在 | **PASS 不需改** |
| OpsDialog branch 后 `__sessionsSvc.refreshList`（:291-292） | ISessions 无 refreshList → typeof 探测失败静默跳过 | **降级不崩**：分支完成提示仍在，仅列表不自动刷新。修复一行：`const p = svc.refresh ? svc.refresh() : svc.refreshList?.()` |
| 0.2.4 done 态「刷新页面」按钮 | 不依赖 sessions face | PASS |

### devkit（src/client.js）——C 线 B2 P0 **确认成立（devkit 部分）**

| 探测点 | 0.2.0 行为 | 修复 |
|---|---|---|
| `__sessionsSvc.open(id)`（:341-342） | ISessions 无 open → 探测失败 → **切换会话命令功能失效** | 改探 `ctx.get('uiWorkspace')?.openSession?.(id)`，回退旧 `svc.open?.(id)` |
| `__sessionsSvc.refreshList`（:527） | 同 message-ops，静默跳过 | 同上 refresh() 回退 |
| `currentSessionId()` 读 `snap.current`（:325） | **SessionListState 无 current 字段** → 恒 null，devkit 的「当前会话」标记/守卫失效 | 用 `useSessions` 选择器或按 `ids[0]`+phase 判定不可靠——正解是经 uiWorkspace/current selection；短期至少去掉恒假分支避免误导 |
| `snap.ids / snap.byId`（:331-339） | 字段在 | PASS |

### session-delete（src/client.js:220-240）——C 线「session-delete 落空」**不成立**

- 它只读 `svc.list.getSnapshot().byId`（`list` 在 ISessions 契约上，行含
  title/running）→ 0.2.0 **正常工作**，无需改。

## 4. 裁决

1. **分歧双方各对一半**：C 线说的「重塑」是真的，但只发生在 ISessions 服务
   face；useSessions slot prop face 未重塑（byId/running/title 仍在），A 线对
   message-ops 的判断正确。
2. **B2 P0 定级修正**：不是「六包级 P0」——受影响面 = devkit 3 处
   （open/refreshList/current）+ message-ops 1 处（refreshList，仅降级）。
   message-ops 与 session-delete 在 0.2.0 上 sessions 相关行为健康。
3. **修复清单**：
   - devkit（P1）：openSession 改探 uiWorkspace.openSession；refreshList→refresh()
     回退；移除/替换 snap.current 恒假读取；
   - message-ops（P3 顺手）：refreshList 探测补 refresh() 回退（一行）；
   - session-delete：无需改。

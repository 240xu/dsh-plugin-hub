# DSH 0.2.0-rc.2 · surface 投影与遮蔽

引擎：`@deepseek-ai/dsh-session/lib/index.js`

## 1. surface 是什么

- 表面（surface）= **模型可见的消息节点序列**，由引擎维护 `state.nodes`（seq 数组）。
- 可进 surface 的事件类型（`SURFACE_EVENT_TYPES`）：
  `system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`。
  其他类型（step/end、turn/end、workspace/changes 等）是**结构性事件**，不是节点。

## 2. append 与 replace 如何改变 nodes

- `surfaceOp: "append"` → 节点加入 nodes。
- `surfaceOp: {op:'replace', startSeq, endSeq}` → 用 `replacementRange()` 定位两端
  在 nodes 中的下标，返回 `shadowedSeqs = nodes.slice(startIdx, endIdx+1)`，
  **把这段从视图中移除**（单向减法）。

```js
function replacementRange(state, op) {
  const startIdx = state.nodes.indexOf(op.startSeq);
  if (startIdx === -1) throw new Error(`surface replace: start seq ${op.startSeq} not found in surface`);
  const endIdx = state.nodes.indexOf(op.endSeq);
  if (endIdx === -1) throw new Error(`surface replace: end seq ${op.endSeq} not found in surface`);
  if (startIdx > endIdx) throw new Error(...);
  return { startIdx, endIdx, shadowedSeqs: state.nodes.slice(startIdx, endIdx + 1) };
}
```

## 3. 遮蔽是单向的（关键结论）

- replace 只做减法，**没有任何 un-shadow / undo / restore op**。
- 已实测推论：即便把"标记事件本身"再遮蔽一次（标记遮蔽标记），
  **也不会**让它先前遮蔽的区间重新可见。
- 引擎里唯一的"改写"是极窄的特例（tool/result 内容改写、system prompt 改写），
  与恢复无关。
- ⇒ **恢复只能靠追加新事件（重放副本）**，不能让原 seq 重新可见。
  这是 message-ops「重放式恢复」设计的根因，也是"按轮步进恢复"必须接受的约束。

## 4. replace op 的格式与校验

```js
function isReplaceOp(value) {
  return Object.keys(op).length === 3 && Object.hasOwn(op,"op")
    && Object.hasOwn(op,"startSeq") && Object.hasOwn(op,"endSeq")
    && op["op"] === "replace" && isEventSeq(op.startSeq) && isEventSeq(op.endSeq);
}
```

- **必须恰好 3 个键**（op/startSeq/endSeq），多一个键就非法。
- `surfaceOp` 只能是 `"append"` 或合法 replace 对象；surface 可入类型**必须**带 surfaceOp。
- 非 surface 类型带 surfaceOp/sourceEventSeqs 会直接抛错。
- `validateSurfaceMetadata`：replace 的 `startSeq/endSeq` 必须**早于**当前事件 seq。

## 5. sourceEventSeqs

- `assertSourceEventReferences(event, shadowedSeqs)`：replace 事件的
  `sourceEventSeqs` 必须包含**每一个被遮蔽的 surface 节点**（缺一个就抛
  `missing ...`）。
- `assistant/message` 不允许带 `sourceEventSeqs`（它内嵌自己的流）。

## 6. system prompt 保护

```js
function assertSystemHeadRewrite(event, state, startIdx, shadowedSeqs, events, baseSeq) {
  if (startIdx !== 0) return;
  if (events[state.nodes[0] - baseSeq]?.type !== "system/message") return;
  if (event.type !== "system/message" || shadowedSeqs.length !== 1)
    throw new Error("surface replace: node 0 holds the system prompt and may be rewritten only by a system/message over exactly that node");
}
```

→ 只有"恰好覆盖 nodes[0] 且自身是 system/message"才允许；否则抛错。
→ 插件的可回滚目标列表**必须排除 role=system 的行**（message-ops 0.6.0 已修）。

## 7. compaction / checkpoint

- `compact-checkpoint` 类型的事件存在；message-ops 的贴条会过滤掉
  `sourceKind === 'compact-checkpoint'` 的标记（历史实现细节，见插件源码）。
- 压缩区间**可以**遮蔽后续的 system 节点（只有 nodes[0] 受保护）。

## 8. 事件准入（能否加自定义字段）

`adoptSessionEvent(event)` =
`validateSessionEventData` + `validateSurfaceMetadata` + `assertMessageEventShape`。

- `validateSessionEventData`：只校验已知结构（developer/role 配对、tool blocks、
  toolName 等），**没有"未知字段"拒绝逻辑**（grep "unknown field / unexpected / extra key" 均为 0）。
- `assertMessageEventShape`：强制 message 有非空 `id`、`role`、
  `source.kind`（非空串）、`content` 数组；`system/message` 的
  `source.kind` 必须是 `system-prompt`。

⇒ **结论**：事件 data 上附加自定义字段（如 `restoresSeq`、未来可能的
`restoredSourceSeqs`）**是允许的**；但 message 的必要字段一个都不能少。

## 9. 实证补记（message-ops 0.8.0，2026-10-06）

- **引擎确实原样持久化 data 上的自定义字段**：恢复 notice 的
  `restoredSourceSeqs` 在磁盘事件里逐字节可读（`[8]` → `[8,9,10,11,23]` 累积），
  引擎不剥离、不校验其内容。
- 但 **`/api/message-ops/messages` 的行字段由 listMessages 决定**——
  未列入白名单的新字段不会出现在 HTTP 行上（restoresSeq 在、
  restoredSourceSeqs 不在）→ 插件自算进度时要么扩 listMessages，
  要么像 0.8.0 一样在服务端用原始 events 计算后以自有字段下发。
- 步进恢复的坑（B1）：`planRestore` 若只按 upToSeq 截断而不排除
  已重放源 seq，每轮都会从区间头重放 → 消息副本刷屏（实测 seq8 被重放 5 次）。

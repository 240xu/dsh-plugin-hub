# DSH 0.2.0-rc.2 机制全貌（摘要）

基线环境：
- DSH：`@deepseek-ai/dsh@0.2.0-rc.2`（node_modules 路径见下）
- 引擎：`@deepseek-ai/dsh-session/lib/index.js`
- 客户端：`@deepseek-ai/dsh-client-ui-conversation` / `-chat` 等

## 一句话全貌

会话日志 **append-only**（只追加、不可改）→ 事件经**准入校验**后进入引擎 →
引擎维护 **surface 投影**（nodes 列表）→ 消息"删除/回滚"= 用 `surfaceOp:replace`
**遮蔽**一段（单向、不可逆）→ 前端按投影渲染，被遮蔽的不显示。

## 已确认的关键结论（本册其余文件展开）

1. **遮蔽单向**：replace 只做减法，引擎**没有** un-shadow / undo。被遮蔽的 seq
   无法重新变可见（见 `01-surface.md`）。恢复只能是"重放新事件"（append 副本）。
2. **事件准入不拒绝未知字段**：`validateSessionEventData` 只校验已知字段
   （role / content / tool blocks 等），不枚举拒绝额外键 → 插件可以在事件 data 上
   带自定义字段（如 `restoresSeq`，我们已在用；`restoredSourceSeqs` 也可加）。
   但 `assertMessageEventShape` 强制要求：message 有非空 `id`、`role`、
   `source.kind`（system/message 必须是 `system-prompt`）、`content` 数组。
3. **replace 约束**：`{op:'replace', startSeq, endSeq}` 必须三键；两端 seq 必须
   早于当前事件且**在当前 nodes 中存在**（否则抛 "start seq ... not found in surface"）。
4. **system prompt 保护**：replace 若覆盖 nodes[0] 且其为 system/message，
   必须是"仅覆盖该节点的 system/message"，否则抛
   `node 0 holds the system prompt ...`（我们曾把 system 行放进可选列表触发过）。
5. **持久化**：zstd 帧追加；插件可自行 append 帧（store-miss 时我们的做法），
   但要镜像引擎字段与行结构（详见 `02-persistence.md`）。
6. **客户端**：官方只提供 `conversation.chat.assistant-actions`（助手消息动作槽）；
   用户消息的动作行是 `.xzv4MW_actions`（含 Copy，height28，消息下方 16px），
   插件要用需 DOM 注入（详见 `03-client-slots.md`）。
7. **服务端**：会话"运行中"的权威判定为 `agents.get(id)?.status === "running"`；
   服务端**没有** sessions.retain 面（那是浏览器 ClientSessions 的）。

## 与插件 message-ops 的关系

- 回滚（revert）= 追加一个 replace 标记事件，遮蔽「目标..末尾」。
- 恢复（restore）= 追加 notice + 被遮蔽消息的重放副本（干净文本、无前缀）。
- 两者都只追加，日志不变；视图由投影决定。

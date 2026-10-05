# DSH 0.2.0-rc.2 · 插件开发者约束清单

来源：引擎 `@deepseek-ai/dsh-session/lib/index.js`（源码）+ message-ops 插件实测。

## 能做什么

1. **在事件 data 上带自定义字段** —— 准入不拒绝未知键。
   - 证据：`validateSessionEventData()` 只校验已知结构（role/content/tool blocks），
     全文无 "unknown field / unexpected key" 类拒绝逻辑（grep 计数 0）。
   - 我们已在用：`system/message` notice 上带 `restoresSeq`（贴条据此判定标记已恢复）。
   - 推论：`restoredSourceSeqs`（按轮步进恢复要用的字段）可以加。
2. **追加 replace 标记事件做"回滚/删除"** —— 遮蔽目标区间（含目标到末尾）。
3. **追加重放副本做"恢复"** —— 干净文本（无前缀亦可）。
4. **store-miss 时自行向日志追加 zstd 帧**（镜像引擎字段与行结构）。
5. **客户端 DOM 注入**到官方结构（如用户消息动作行 `.xzv4MW_actions`）。

## 不能做什么（硬约束）

1. **不能"真正"反遮蔽**：replace 单向；没有 un-shadow op。
   想让被遮蔽内容重新出现 = 追加新事件（重放）。
2. **replace 的两端 seq 必须在当前 surface 中存在**：
   否则抛 `surface replace: start seq N not found in surface`。
   实务：目标若已被遮蔽（例如标记遮蔽了另一个标记），二次 replace 会失败。
3. **不能遮蔽 nodes[0] 的 system prompt**（除非是仅覆盖它的 system/message）：
   抛 `node 0 holds the system prompt and may be rewritten only by
   a system/message over exactly that node`。
   → 插件的"可选目标列表"必须排除 `role=system` 行（我们已修，见 0.6.0）。
4. **事件必须满足 v4 行结构**：
   - 根键：`type / seq / time / data / sourceEventSeqs / surfaceOp`
   - `data.turn` / `data.step` 为正整数
   - message 必须有非空 `id`、`role`、`source.kind`、`content` 数组
   - `system/message` 的 `source.kind` 必须是 `system-prompt`
   （历史上漏 turn/step 或 id 会让整个进程 exit=1，见 runtime-verification.md）
5. **服务端没有 sessions.retain 面**：那是浏览器 ClientSessions 的能力；
   服务端只有 controller 操作路径（实测 `ctx.sessions` 无 retain）。

## 易碎点（实测教训）

| 坑 | 现象 | 规避 |
|---|---|---|
| 漏 turn/step 或 message.id | 引擎抛 SessionFormatError → **进程退出** | 派生：缺失时从事件尾部推 1/1；id 用 randomUUID |
| 把 system 行当可回滚目标 | 引擎 500 "node 0..." | 目标列表排除 role=system |
| role=user 里混着 `<system-reminder>` / runtime context | 按序配对错位 → seq 打不上 | 过滤这些宿主注入行 |
| 虚拟列表只渲染窗口 | DOM 注入扫不到块 | MutationObserver + 滚动扫描；块不在 DOM 就无从注入 |
| 打标是异步的 | 点在未打标按钮上静默失败 | 点击时先 await 完成配对 |
| `opacity:0 + :hover` 显形 | 触屏永远点不到 | 可见性交还宿主 `[data-actions-reveal]` |

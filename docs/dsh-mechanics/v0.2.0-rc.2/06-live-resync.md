# DSH 0.2.0-rc.2 · live 层与磁盘再同步（含真实事故案例）

结论先行：**Termux 上跨实例向 live 会话日志追加 = 数据损坏**（已实测发生并修复）。
引擎无跨进程写保护（本平台）、live 层不从磁盘再同步、冲突表现为重复 seq + 意外遮蔽。

## 1. 写入路径（引擎侧）

`dsh-session-persistence-jsonl/lib/index.js`：

```js
async appendLines(meta, events) {
  const content = await this.encodeEventBatch(events);
  const handle = await open(path, "a");            // 追加模式
  const { size: before } = await handle.stat();    // 只为失败回滚记录大小
  await handle.writeFile(content);
  await handle.sync();                             // fsync
  // 失败 → rollbackAppend(path, before) 截断
}
```

- **写入前不校验磁盘游标**：`before` 只用于自身失败回滚，不与"期望 seq"比对。
- seq 由引擎**内存态**分配；`planSurfaceEvent` 要求 `event.seq === expectedSeq`
  （严格连续）——但那是 apply 时的校验，不是写盘前对文件的校验。

## 2. 跨进程锁：本平台不存在

- 代码意图：`SessionWriteLease` 用 `flock(2)` 锁 `session.lock`
  （`@deepseek-ai/node-addon-system/flock`）。
- **实测（android-arm64/Termux）：flock 绑定抛 `ERR_FLOCK_UNSUPPORTED_PLATFORM`**
  → 引擎代码内注明「无 flock 绑定，无锁继续」（index.js:694 附近）。
- ⇒ Termux 上多实例写同一会话日志 = 无任何互斥。

## 3. live 层不从磁盘再同步

- 会话在对象层注册后，投影/seq 游标全在内存；**没有任何"重读文件尾"的机制**。
- 另一进程追加的帧，live 实例既不知道也不会采纳。

## 4. 真实事故（2026-10-06，用户主会话 4e10c1a2）

时间线：会话 live 于实例 A（3080）；插件（实例 B/3081）向日志磁盘追加帧；
A 继续追加 → **帧碰撞**。

扫描结果（修复前）：14441 帧 / 14436 唯一 seq = **5 个重复 seq**，集中在
14120..14124——两股流各自写了同一批 seq：

- 先写（外来批，实例 B）：被中断的 `tool/result` + `step/end` + `turn/end` +
  `session/end-seed` + 一条**意外回滚标记**（遮蔽 14044..14074 共 31 节点）
- 后写（实例 A 的真实对话）：tool/result / step/end / step/start /
  assistant/message / tool/call …

引擎未崩的原因：A 的会话早已 live（不重读文件）；**炸弹是延迟引爆的**——
下次全新加载（如重启后打开该会话）时，重复/不连续 seq 会在重放校验中抛
SessionFormatError（与 v4 准入崩溃同类）。

## 5. 修复方法（已执行，验证 CLEAN）

原始行级手术（**不做事件重序列化**，字节保真）：

1. `scanZstdFrames()` 逐帧解压（v4 = 多帧拼接 zstd；帧 0 = header 行）。
2. 同 seq 多次出现 → **保留最后一次出现**，其余帧内行标记删除
   （语义：后写的真实对话覆盖先写的碰撞批）。
3. 清空帧剔除（保留 header 帧）→ 逐帧重压缩 → `rename` 原子替换。
4. 读回校验：`events 14472 | dup 0 | discontinuities 0 → CLEAN`。
5. 附带收益：删除意外回滚标记 = 该标记遮蔽的 31 节点**恢复可见**
   （遮蔽来自 replace 标记，标记没了，遮蔽即消失）。

修复前双备份：`session.v4.jsonl.zstd.pre-repair.<ts>.bak` ×2。

## 6. 对插件/工具开发者的硬规则

1. **禁止**向"可能被其他实例 live 持有"的会话日志磁盘追加。
2. 确需跨实例操作：先备份（字节级）→ 操作 → 全量读回校验
   （dup=0 且连续）→ 保留备份直到确认。
3. 碰撞已发生时的修复：上述行级手术；若标记是意外的，删除标记帧
   同时解除其遮蔽（一举两得）。
4. Termux 上不要依赖 flock——引擎自己都没锁。
5. `session/end-seed` / `turn/end` 等生命周期帧出现在错误文件 = 错位写入的标志，
   见到即应全量体检。

# DSH 0.2.0-rc.2 · 会话日志持久化

证据来源：引擎与宿主存储布局 + message-ops 插件 store-miss 磁盘追加路径的实测
（插件 `src/index.js` 的 `diskAppend`，曾用于"会话只在磁盘、不进对象层"的场景）。

## 1. 物理格式

- 会话日志位于 `~/.dsh/sessions/<project-slug>/session-<uuid>/…`，
  事件以 **zstd 压缩帧**追加（Node 内建 `zlib.zstdCompressSync`，需 Node ≥ 23.5）。
- 每个事件编码成一帧追加到文件尾；读取时按帧重放重建状态。
- 另有投影缓存：`~/.dsh/storages/session_projcache/sessions/session-<uuid>.json`
  （实测见过 version 7 的缓存记录，含 identity/rows 等）。

## 2. 写入路径（引擎侧）

- API/控制器 → `encodeEventBatch` → 持久化层追加帧 → write + sync。
- **事件准入失败会抛 SessionFormatError**（历史上因缺 turn/step、缺 message.id
  导致**整个进程 exit=1**；见 `docs/runtime-verification.md` 的 v4 准入三连击）。
- ⇒ 插件若自行写帧，字段必须**逐项镜像引擎金标准**，否则会让实例崩溃。

## 3. live vs store-miss（插件必须区分的两条路）

- **live**：会话在对象层注册（`sessions.get(id)` 命中）→ 走引擎 append 路径。
- **store-miss**：会话只在磁盘（例如 lazy-view 渲染的会话、或已卸载的会话）→
  引擎路径会 404 "session not found in registry (is it loaded?)"。
  实测：服务端**没有** retain 面（retain/using 是浏览器 ClientSessions 的能力）。
- message-ops 的做法：store-miss 时**自行向日志追加 zstd 帧**
  （`zstdCompressSync` → `open('a')` → write + sync + 失败按 size 回滚），
  事件字段镜像引擎；成功后客户端 `openSession` 强制重建视图
  （磁盘追加没有 live 投影事件）。

## 4. 自行追加的风险边界

| 风险 | 说明 |
|---|---|
| 行结构不合规 | 触发 v4 准入失败 → 进程退出（最高风险） |
| 字段不镜像引擎 | 重放/渲染异常，或未来版本不兼容 |
| 与引擎游标并发 | 同一会话被另一进程/实例同时写入时，帧追加可能交错或缓存失效 |
| 投影缓存陈旧 | 磁盘追加后缓存未失效 → 需强制 openSession 重建 |

⇒ **禁止**对"正被另一个实例实时写入"的会话做跨实例磁盘追加
（这是我们不为仍活跃在 3080 的会话做清理的原因）。

## 5. seq 分配与并发

- seq 由引擎按写入顺序分配（连续、不可跳号；`planSurfaceEvent` 会校验
  `event.seq !== expectedSeq` → "not contiguous"）。
- 多实例写同一会话没有跨进程锁（就我们的实测认知）→ 视为不安全。

## 6. 事件根键顺序（金标准）

`type / seq / time / data / sourceEventSeqs / surfaceOp`

- `data`：含 `turn` / `step`（正整数）、`message`（含 id/role/source.kind/content）
- 标记事件：`data` 里带 `message`，`surfaceOp` = replace（三键）
- 恢复通知：带 `restoresSeq`，`surfaceOp: "append"`
- 重放事件：**无 id**（镜像引擎原生重放行为）

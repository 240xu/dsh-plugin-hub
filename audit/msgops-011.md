## package
version 0.11.0
dsh {'bundle': {'patch': './cordis.patch.yml'}, 'client': {'inject': ['@deepseek-ai/dsh-client-runtime'], 'platform': 'web'}}
## endpoints
/tmp/m/package/test/redo-contract.test.js:4: * `POST /api/message-ops/restore` 的 seq 是 **marker seq**：
/tmp/m/package/test/branch-export-removed.test.js:34:test('后端不再有 /api/message-ops/branch 路由', () => {
/tmp/m/package/test/branch-export-removed.test.js:36:  assert.ok(!s.includes('/api/message-ops/branch'), 'branch 路由仍在')
/tmp/m/package/test/branch-export-removed.test.js:39:test('后端不再有 /api/message-ops/export 路由', () => {
/tmp/m/package/test/branch-export-removed.test.js:41:  assert.ok(!s.includes('/api/message-ops/export'), 'export 路由仍在')
/tmp/m/package/test/branch-export-removed.test.js:47:  assert.ok(!s.includes('/api/message-ops/branch'), 'client.js 仍调磁盘分支端点')
/tmp/m/package/test/undo-slash.test.js:38:  // 送 "session-<uuid>" 给 /api/message-ops/revert 会落不到会话目录
/tmp/m/package/test/fence.test.js:86:  await routes.get('/api/message-ops/messages')(mockReq({ url: '/api/message-ops/messages?sessionId=x', headers: { host: 'evil.com' } }), res1)
/tmp/m/package/test/fence.test.js:89:  await routes.get('/api/message-ops/revert')(mockReq({
/tmp/m/package/test/fence.test.js:90:    method: 'POST', url: '/api/message-ops/revert', headers: { host: '127.0.0.1', 'sec-fetch-site': 'cross-site', origin: 'http://evil.com' },
/tmp/m/package/test/fence.test.js:98:  await routes.get('/api/message-ops/revert')(mockReq({
/tmp/m/package/test/fence.test.js:99:    method: 'POST', url: '/api/message-ops/revert',
/tmp/m/package/test/fence.test.js:106:  await routes.get('/api/message-ops/revert')(mockReq({
/tmp/m/package/test/fence.test.js:107:    method: 'POST', url: '/api/message-ops/revert',
/tmp/m/package/test/client-perf-locks.test.js:138:  assert.equal(norm('/api/message-ops/messages?sessionId=session-abc'), '/api/message-ops/messages?sessionId=abc')
/tmp/m/package/test/client-perf-locks.test.js:139:  assert.equal(norm('/api/message-ops/messages?sessionId=abc'), '/api/message-ops/messages?sessionId=abc')
/tmp/m/package/test/ops-core.test.js:182:    '/api/message-ops/delete',
/tmp/m/package/test/ops-core.test.js:183:    '/api/message-ops/messages',
/tmp/m/package/test/ops-core.test.js:184:    '/api/message-ops/restore',
/tmp/m/package/test/ops-core.test.js:185:    '/api/message-ops/revert',
/tmp/m/package/test/ops-core.test.js:186:    '/api/message-ops/search',
/tmp/m/package/test/ops-core.test.js:187:    '/api/message-ops/session/delete',
/tmp/m/package/test/ops-core.test.js:188:    '/api/message-ops/session/purge',
/tmp/m/package/test/ops-core.test.js:189:    '/api/message-ops/session/restore',
/tmp/m/package/test/ops-core.test.js:190:    '/api/message-ops/session/trash',
/tmp/m/package/test/ops-core.test.js:191:    '/api/message-ops/text',
/tmp/m/package/src/index.js:46:/** 统一入口围栏：全部 /api/message-ops/* 路由先过这一层（三层信任 + 宿主 BrowserAuth cookie）。 */
/tmp/m/package/src/index.js:310:// GET /api/message-ops/messages 的成本约 95% 落在「只依赖日志文件」的那一段
/tmp/m/package/src/index.js:901:    // --- GET /api/message-ops/messages：消息列表（只读） ---------------------
/tmp/m/package/src/index.js:904:      path: "/api/message-ops/messages",
/tmp/m/package/src/index.js:919:    // --- GET /api/message-ops/search：会话内全文搜索（服务端，匹配 snippet 之外） --
/tmp/m/package/src/index.js:922:      path: "/api/message-ops/search",
/tmp/m/package/src/index.js:944:    // --- GET /api/message-ops/text：单条消息全文（0.5.2 引用按钮按需取） ----------
/tmp/m/package/src/index.js:948:      path: "/api/message-ops/text",
/tmp/m/package/src/index.js:990:      kind: "exact", path: "/api/message-ops/revert", handler: commitHandler("revert"),
/tmp/m/package/src/index.js:994:      kind: "exact", path: "/api/message-ops/delete", handler: commitHandler("delete"),
/tmp/m/package/src/index.js:1001:      path: "/api/message-ops/restore",
/tmp/m/package/src/index.js:1020:      path: "/api/message-ops/session/trash",
/tmp/m/package/src/index.js:1049:    sessionAction("/api/message-ops/session/delete", (c, b) =>
/tmp/m/package/src/index.js:1051:    sessionAction("/api/message-ops/session/restore", (c, b) =>
/tmp/m/package/src/index.js:1053:    sessionAction("/api/message-ops/session/purge", (c, b) =>
/tmp/m/package/src/client.js:43:     * GET /api/message-ops/messages 的唯一出口（0.9.7 读合并）。
/tmp/m/package/src/client.js:439:        fetchMessagesJson('/api/message-ops/messages?sessionId=' + encodeURIComponent(target.sessionId))
/tmp/m/package/src/client.js:505:          .then(() => fetch('/api/message-ops/' + path, {
/tmp/m/package/src/client.js:838:          const data = await fetchMessagesJson('/api/message-ops/messages?sessionId=' + encodeURIComponent(sid) + '&view=compact')
/tmp/m/package/src/client.js:865:          const url = '/api/message-ops/search?sessionId=' + encodeURIComponent(sid)
/tmp/m/package/src/client.js:887:          const res = await fetch('/api/message-ops/session/trash')
/tmp/m/package/src/client.js:952:        fetch('/api/message-ops/text?sessionId=' + encodeURIComponent(sid) + '&seq=' + encodeURIComponent(m.seq))
/tmp/m/package/src/client.js:983:          const res = await fetch('/api/message-ops/' + mode, {
/tmp/m/package/src/client.js:1019:          const res = await fetch('/api/message-ops/session/delete', {
/tmp/m/package/src/client.js:1043:          const res = await fetch('/api/message-ops/session/restore', {
/tmp/m/package/src/client.js:1069:          const res = await fetch('/api/message-ops/session/purge', {
/tmp/m/package/src/client.js:1334:          const p = fetchMessagesJson('/api/message-ops/messages?sessionId=' + encodeURIComponent(sessionId))
/tmp/m/package/src/client.js:1409:          .then(() => fetch('/api/message-ops/revert', {
/tmp/m/package/src/client.js:1446:          fetch('/api/message-ops/text?sessionId=' + encodeURIComponent(sessionId) + '&seq=' + encodeURIComponent(seq))
/tmp/m/package/src/client.js:1578:          return fetchMessagesJson('/api/message-ops/messages?sessionId=' + encodeURIComponent(sessionId))
/tmp/m/package/src/client.js:1676:          .then(() => fetch('/api/message-ops/restore', {
/tmp/m/package/src/client.js:1695:            const fresh = await fetchMessagesJson('/api/message-ops/messages?sessionId=' + encodeURIComponent(sessionId)).catch(() => null)
/tmp/m/package/src/client.js:1815:        return fetchMessagesJson('/api/message-ops/messages?sessionId=' + encodeURIComponent(sid))
/tmp/m/package/src/client.js:1856:       * 从 /api/message-ops/messages 的响应构建全部查表。
## readme
# @240xu/dsh-message-ops

DSH web 插件：**消息回滚 + 删除 + 恢复**。只补 dsh 官方**没有**的能力。

> **0.9.0 是破坏性变更**：移除了本插件的**分支**与 **Markdown 导出**。
> 两者 dsh 官方都已有（`session/fork` 与 `/api/session.export`），详见下方「为什么不重复造轮子」。

## 官方没有、本插件提供的

| 能力 | 官方 dsh 0.2.0-rc.2 | 本插件 |
|---|---|---|
| **消息回滚**（遮蔽该条及其后全部内容） | ❌ 没有。`SurfaceOp` 只有 `append\|replace`，**没有解除遮蔽的操作**；`undo` 仅指草稿编辑器的 Ctrl+Z | ✅ |
| **单条删除** | ❌ 没有。官方 README 明文 *"sessions can be archived but never deleted"* | ✅ |
| **恢复**（撤销一次回滚/删除） | ❌ 没有 | ✅ |

## 为什么不重复造轮子（0.9.0 的取舍）

- **分支** → 官方有完整实现：RPC `session/fork`（`atSeq` 任意）+ `SessionStore.fork()`
  + UI 消息级按钮 + 官方埋点就叫 `branch_session_click`。
  本插件原先还有一个磁盘实现（`applyBranch`）作为「官方失败时的回落」，但它语义是错的：
  删掉了 `isSeeded`（官方 fork 设 `true`）、不写 `inheritedEventCount`、
  也不补 fork closers → 产出的子会话边界可能悬空。**已删除**，失败时直接提示停止运行中的会话。
- **Markdown 导出** → 官方 `/api/session.export` 提供 ZIP 归档（原始 JSONL + 附件，面向迁移/复现）。
  格式确实不重叠，但本插件的导出**零 UI 入口**（实测路由可用但前端从不调用），等于死代码。**已删除**。

## 用法

- **会话头部**的 `Message ops (revert / delete / branch)` 按钮 → 统一对话框
- **助手消息** hover 行的 `Revert to here` / `Quote to composer`
- **用户消息** hover 行的 `Revert to here`
- **输入框上方的回撤贴条**：展开后可逐条 `Restore`（这是恢复的唯一入口）
- **侧栏会话行**的 `...` 菜单

对话框流程：**先在列表里选一条消息 → 上方出现三个操作 → 破坏性操作需勾选确认**。

## 安装

零 npm 依赖（只用 `node:fs` / `node:zlib` / `node:path` / `node:url`；zstd 压缩走
Node 内建 `zlib.zstdCompressSync`，需 **Node ≥ 23.5**，Termux 与 Windows 通用）。

```sh
# Termux / Linux
dsh plugin --profile web add @240xu/dsh-message-ops

# Windows
dsh plugin --profile web add @240xu/dsh-message-ops
# 或本地目录：
dsh plugin --profile web add file:C:/path/to/dsh-message-ops
```

重启 DSH web 实例后生效。

## 安全设计

- 回滚/删除不重写日志：通过一条承载 `surfaceOp: replace` 的 system 事件实现，
  约束由 DSH 引擎 `assertProvenance` 校验，违规如实上报（HTTP 409）。
- 回滚/删除前必须勾选风险确认；运行中的会话一律拒绝（提示先停止）。
- 分支先写临时文件再原子 rename，半写日志不会被会话扫描读到。

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/message-ops/messages?sessionId=<id>` | 消息级列表（磁盘真相 + 可见性标注 + running 状态）；`&view=compact` 只回 `seq/role/snippet/time/visible/shadowed`（体积约 −54%） |
| GET  | `/api/message-ops/search?sessionId=<id>&q=&role=&limit=` | 服务端全文检索（含已回滚消息之外的全部文本），返回 query 对齐片段 |
| GET  | `/api/message-ops/session/trash` | 回收站列表（自动清理过期条目） |
| POST | `/api/message-ops/revert`  | `{sessionId, seq}` 回滚到该条（含） |
| POST | `/api/message-ops/delete`  | `{sessionId, seq}` 仅遮蔽该条 |
| POST | `/api/message-ops/branch`  | `{sessionId, upToSeq}` 分支新会话，返回 `{newId, dir, keptEvents}` |
| GET  | `/api/message-ops/export?sessionId=<id>&seq=<可选>` | 导出 Markdown（seq ≤ 上界，缺省全部），附件下载 |
| POST | `/api/message-ops/restore` | `{sessionId, seq}` 回滚恢复：seq 为某次 revert/delete 标记事件的 seq |
| POST | `/api/message-ops/session/delete` | `{sessionId, confirmTitle}` 整会话移入回收站（7 天保留；运行中 409） |
| POST | `/api/message-ops/session/restore` | `{trashId}` 从回收站恢复目录与投影/工作区元数据 |
| POST | `/api/message-ops/session/purge` | `{trashId}` 永久删除（唯一 destructive 操作） |

### 0.11.0 · 方向 A 面板 + 会话回收站

- `src/client.js` 新增右侧功能主义抽屉 `OpsPanel`（560px，≤760px 全屏）：
  消息/回收站双 tab、200ms 防抖搜索、角色过滤、含已回滚开关、46px 固定行高
  虚拟列表、`/text` 详情、回滚/仅删除/分支、整会话删除（输入标题确认）。
  旧 `OpsDialog` 保留为 `window.__MOPS_LEGACY_DIALOG === true` 回退。
- `GET /messages?view=compact` 为面板默认载荷；`GET /search` 提供 500 字符
  上限的服务端全文检索（LRU 8 corpus 缓存，按 logPath mtime+size 失效）。
- `src/session-trash.js`：删除 = 目录 `rename` + 投影行/工作区/归档/置顶元数据
  快照写 `manifest.json`；恢复拒绝覆盖已存在目录（409）；purge 才真正删除。

## 0.2.4 UI GAP（ux-scout dsh-ui-spec G-M1）

- **S6 违规修复**：回滚/删除成功后不再 900ms 裸 `location.reload()`——改为
  devkit 标准 toast（`window.__dshDevkit.toast` 探测，无 devkit 时降级为对话框
  内完成文案）+ done 态新增「刷新页面」按钮由用户手动刷新；与 branch 路径
  （refreshList 不刷新页面）行为拉齐。

## 0.2.3 格式兼容（compat-audit + 用户实测紧急修复）

- **P0 旧单帧 `session.jsonl.zstd` 读取必崩**：`readSessionFile` 旧实现把帧 0
  整段 `JSON.parse`——旧单帧格式整个文件是一帧、解压出多行 NDJSON，直接抛异常，
  与「旧格式兼容」声明矛盾。现改为**逐行扫描统一路径**：全部帧解压后按行扫描，
  首个 `type:"session"` 行作 header、其余行作事件，v3 多帧 / v4 多帧 / 旧单帧
  三种格式一条代码路径（撕裂行仍按完整前缀语义跳过）。
- **P0 v4 会话格式（用户实测 3080 服务暴露）**：DSH 已升级 v4 持久化
  （`session.v4.jsonl.zstd`，结构同 v3，仅文件名与 `version` 数字不同）。
  `findSessionDirs` 探测序列改为 **v4 → v3 → 旧单帧**（此前只找 v3，最新会话
  全部 "session log not found"）；`readSessionFile` 不做 version 硬校验；
  `applyBranch` 分支写回沿用读到的原格式版本（`session.v<version>.jsonl.zstd`），
  不再写死 v3。
- **dedup**：`listMessages` 内联文本提取收敛到 `session-file.messageText`
  单点（ops-core 转出保持导入面兼容），消除双实现漂移面。
- 回归：40 项测试全绿，含旧单帧/ v4 fixture 往返、listMessages、
  findSessionDirs 三格式发现与 v4 分支写回；真实 v4 会话日志已实测通过。

## 0.2.2 前端收尾（评审 M1/M2）

- **M2 观察范围收窄**：侧栏行菜单注入的 `MutationObserver` 仍观察
  `document.body`（菜单由宿主 React 动态渲染，安装期无稳定锚点），但回调改为
  精确过滤——只有新增节点本身是（或包含）`[role=menu]` 时才调度探测；聊天流
  渲染、流式 chunk 等海量 mutation 零探测成本；同帧多次命中合并为一次探测。
- **M1 分批渲染**：消息列表先渲 50 条，顶部「显示更多（剩余 N 条）」按钮每次
  渐进展开 50 条（上限仍为最近 200 条），避免 200 行单选列表一次性进 DOM；
  打开新会话时分页重置。

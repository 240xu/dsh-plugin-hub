# DSH 0.2.0-rc.2 · HTTP API 面（07-api-inventory）

> 测绘：lead 执笔（两派 api-cartographer 均中途夭折；transport 结论来自 Playwright
> 网络层实测，路由机制来自 message-ops 插件源码 + 实测）。方法与证据标注同前。

## 0. 传输层定论（Playwright 网络层实测，三次独立抓取）

GUI 与宿主之间**不存在常规 HTTP API 调用**：三次独立抓取（page 级 / context 级 /
含 service-worker 与 WebSocket 监听）在完整 GUI 启动 + 会话打开 + 发消息的流程中，
除文档本身外 **0 个 /api/ 请求、0 WebSocket、0 SSE**。

⇒ 官方 GUI↔宿主的传输不走字符串 REST 路由（宿主代码亦 grep 不到 `/api/` 字符串；
`typert.host.js` / `typert-generator` 的存在指向类型化 RPC 桥，具体线格式**未定案**
——需要宿主进程级抓包或 typert 源码专读）。

**对插件的含义**：`/api/*` REST 面是**插件专属的带外通道**——官方功能不与插件
争抢它；插件间也互不冲突（各自命名空间）。

## 1. 插件自定义路由机制（已实证）

- 注册：`targetCtx.effect(() => host.register({ kind: "exact", path: "/api/<ns>/...", handler }, "<id>"))`
  （message-ops src/index.js:529 起多处）。
- handler 签名：`async (req, res)`；辅助 `sendJson(res, status, body)`。
- 鉴权两层（实测差异的根源）：
  - `fence(req, res)` / `writeFence(req, res)` + `readFencedBody(req, res)`：
    读/写分离的护栏；**GET /api/message-ops/messages 无 token 亦可访问**（实测）。
  - `isTrustedApiRequest`：更严的可信请求校验（部分路由用）——实测
    `GET /api/message-ops/markers` 返回 401 即此 guard 所致。
  - ⇒ 规则：**自定义端点的鉴权强度由插件自选**；涉及写操作一律 writeFence，
    不要依赖"匿名可读"的偶然行为。
- kind 取值：实测用到 `"exact"`；`"prefix"` 等其他 kind 存在（client-contract
  §1.0 的 slot kind 是另一体系，勿混淆）——完整枚举**未定案**。

## 2. 官方会话消息相关面（GUI 之外可用的实证）

| 面 | 证据 | 说明 |
|---|---|---|
| 引擎事件流（append-only 日志） | dsh-session-persistence-jsonl | 权威持久层；多帧 zstd；见 02/06 |
| live 投影（surface.nodes） | dsh-session planSurfaceEvent/replacementRange | 权威可见性；不从磁盘再同步（见 06） |
| agents 状态 | api-session-controller `agents.get(id)?.status === "running"` | busy 判定权威面 |
| uiWorkspace.openSession | 宿主 UI 服务 | 客户端打开会话的唯一官方通道 |

## 3. 官方 REST 路由全清单

**未定案**——transport 定论（§0）表明官方功能不经 REST；GUI 实测 0 调用。
若未来需要（如外部工具集成），方法：宿主进程级抓包（strace/tcpdump 或
typert 源码专读）另立专篇。插件开发**不需要**它（走 §1 机制 + §2 面即可）。

## 4. 原始抓取存档

- `07-api-tap-raw.txt`（网络层实测记录：仅 `GET /?token=…` 一个请求）。

# DSH 0.2.0-rc.2 · 服务端服务面与 HTTP API

证据：message-ops 插件 `src/index.js` 的实现与实测（`__resolveSource` 诊断曾遍历
`ctx.sessions / ctx.get / ctx.reflect.get` 找 retain，结论：服务端没有 retain）。

## 1. 插件 apply(ctx) 可获取的服务

- `ctx.slots` —— 客户端插槽注册（`inject` / `register`）
- `ctx.inject(['uiWorkspace'], cb)` —— 取宿主 UI 工作区（唯一打开会话的通道
  `uiWorkspace.openSession(id)`）
- `ctx.inject(['locale'], cb)` / `ctx.on('locale/change')` —— 国际化
- 会话相关：**没有稳定公开的 sessions 服务面**；实测 `sessions.list` 是函数返回数组，
  `sessions.get` 在"视图已打开但对象层未注册"时会 miss（store-miss）。

## 2. 会话"运行中"的权威判定

- 官方：`agents.get(id)?.status === "running"`
  （`api-session-controller/lib/index.js`）
- message-ops 用它做 busy 守卫（运行中回滚返回 409），并留 `__runningSource` 诊断。
- 早前误用"快照里没有 running 字段"当空闲 → 假阴性；必须走 agents 状态。

## 3. 打开/激活会话

- 客户端唯一官方通道：`uiWorkspace.openSession(sessionId)`
  （message-ops 回滚/恢复后都调它强制重建视图）。
- 服务端没有对应"打开"API（打开是客户端视图概念）。

## 4. 官方 HTTP 路由（会话消息相关）

- `/api/session/:id/message` 等（宿主提供）。
- 插件自定义端点：在插件 `src/index.js` 里注册 `/api/message-ops/*`
  （messages / revert / restore / delete / branch / markers …）。

## 5. 鉴权差异（实测）

- `/api/message-ops/messages` 无需鉴权即可访问（我们脚本一直直接 curl）。
- `/api/message-ops/markers` 返回 `unauthorized` —— 说明不同端点的守卫不一致，
  插件自定义端点**不应依赖"无鉴权"**，前端调用应带会话态、后端假定需要鉴权。

## 6. 事件推送与刷新

- 宿主把事件推给前端（SSE/订阅），客户端自行刷新投影。
- 插件侧没有官方订阅面；message-ops 用 `window` 自定义事件
  `dsh-message-ops:changed`（CHANGED_EVENT）在插件内部各组件间广播刷新，
  再配合 `openSession` 重建。这是"够用且解耦"的做法，非官方机制。

## 7. 服务端开发建议

- 优先用引擎路径（live）；只在 store-miss 时走自写磁盘帧。
- 自定义端点要显式声明所需鉴权，不要依赖实测到的"某个端点没鉴权"。
- 所有写操作前先判 busy（agents 状态），避免与生成中的轮次竞争。

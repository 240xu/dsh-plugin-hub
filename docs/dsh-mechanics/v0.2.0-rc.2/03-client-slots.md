# DSH 0.2.0-rc.2 · 客户端 slot 与消息渲染结构

包：`@deepseek-ai/dsh-client-ui-conversation` / `@deepseek-ai/dsh-client-ui-chat`

## 1. 常用 slot 与渲染位置（实测）

| slot | 渲染位置 |
|---|---|
| `conversation.input.dock` | composerStack 内、**输入框上方**（message-ops 贴条用；已做到 gap=1px） |
| `conversation.composer.dock` | InputBar 内部底部（ContextMeter 旁） |
| `conversation.chat.assistant-actions` | **助手消息**动作区（TurnTailNodeView，官方 `MessageIconActions`，传 `messageId`） |
| `conversation.chat.node` | 每个消息节点（官方自用；插件注册会替换渲染，慎用） |
| `conversation.chat.turnTail` | 一轮末尾 |
| `conversation.session.header.actions` | 会话头右侧（message-ops 的 Message ops 按钮用） |

⚠️ **官方没有"用户消息动作槽"** —— 用户消息的动作行要靠 DOM 注入。

## 2. inject vs register

```js
ctx.slots.inject(NAME, () => ctx.slots.register({ name: NAME, id: ID, order: N, ...(locale?{locale:NS}:{}) }, Component))
```

- `inject(name, factory)`：槽不存在时自动 no-op（旧版本兼容的关键）。
- `register`：`order` 决定同槽多个插件的排队顺序；`locale` 传命名空间。
- 组件 props 由宿主给（如 assistant-actions 给 `messageId`）。

## 3. 用户消息结构（DOM 注入必读）

- `Sixlwa_userRow`：`flex-direction:column; align-items:flex-end; gap:6px`
- `Sixlwa_userStack`：`max-width:min(calc(var(--dsh-chat-content-width,748px)*.702), 82%)`
- `Sixlwa_bubble`：气泡本体（`radius-xl`、`padding:10px 16px`、`white-space:pre-wrap`）
- 动作行：`xzv4MW_actions`（`height:calc(28px + delta)`、`display:flex`、`gap:8px`），
  默认 `opacity:0`，由祖先 `[data-actions-reveal]`（值 `always` / `hover`）控制显隐；
  用户消息上的 className 是 `hWmORq_actions`（`margin-top:16px; margin-left:-6px`）
  → **位于消息下方 16px**。

⇒ 插件给用户消息加按钮 = 找到该消息容器内的 `.xzv4MW_actions`，
**append 一个同级 button**（与 Copy 同一行、同一层），可见性天然继承宿主。
（message-ops 0.7.0 的实现，实测 `parentCls=xzv4MW_actions`、与 Copy 中心 y 差 ≤6px）

## 4. 虚拟滚动

- 消息列表**只渲染可见窗口**（实测：3 条消息有时只 2 个块在 DOM）。
- ⇒ DOM 注入必须配 `MutationObserver` + 滚动扫描；**块不在 DOM 就无从注入**。

## 5. 宿主注入的"假用户消息"

- 引擎/宿主会把 `<system-reminder>`、`Current runtime context` 等
  以 **role=user** 写入事件；DOM 里并不渲染成"我的消息"。
- ⇒ 任何"按 user 行顺序配对 DOM"的逻辑**必须过滤**这些行，否则配对错位
  （message-ops 0.7.0 修的就是这个：导致 seq 打不上、点击静默失败）。

## 6. 官方按钮样式规范（复用建议）

- 尺寸 28×28、`border-radius:6px`（官方 action 是 999px 圆形风格，视组件而定）、
  `background:transparent`、`color:var(--dsw-alias-label-tertiary)`、
  hover 用 `var(--dsw-alias-interactive-bg-hover)`。
- 图标用官方 SVG 原语（14–15px），**不用 emoji**。

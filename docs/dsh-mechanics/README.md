# DSH 机制研究册

按 **DSH 版本**分目录归档。每个 DSH 版本的机制可能不同（事件准入、surface 投影、
持久化、客户端 slot 都可能变），所以研究结论必须绑定到具体版本，历史版本要能翻得到。

## 目录约定

```
docs/dsh-mechanics/
  v0.2.0-rc.2/          ← 一个 DSH 版本 = 一个目录
    00-overview.md      ← 该版本全貌摘要（先读这个）
    01-surface.md       ← surface 投影与遮蔽
    02-persistence.md   ← 日志持久化（zstd 帧 / 写路径 / 缓存）
    03-client-slots.md  ← 客户端 slot 与消息渲染结构
    04-server-api.md    ← 服务端服务面与 HTTP API
    05-plugin-constraints.md ← 插件开发者约束清单（能做/不能做）
```

## 版本对应 git tag

研究册的每个版本对应一个 git tag：`mech-v0.2.0-rc.2` 这样命名，
便于 `git checkout mech-v0.2.0-rc.2` 精确回到某一版 DSH 的研究结论。

| tag | DSH 版本 | 说明 |
|---|---|---|
| `mech-v0.2.0-rc.2` | 0.2.0-rc.2 | 首版：事件准入/surface/持久化/slot 全貌 |

## 方法纪律

- 每条结论必须带**代码证据**（文件名 + 函数/片段），不写"应该/大概是"。
- 实测结论（Playwright / API）与源码结论分开标注。
- 如果某个结论在后续 DSH 版本变化，新开目录并在 `00-overview.md` 里标注差异。

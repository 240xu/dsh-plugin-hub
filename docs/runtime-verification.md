# runtime-verification — 六包真实运行时实测记录

> 方法：node:http 最小 webServer 垫片（`dsh-session-search/scripts/runtime-harness.mjs`）
> 加载**真实插件代码**（session-search 完整 apply + devkit 服务端 apply + websearch
> history 路由）挂 127.0.0.1:3999，数据面直连真实 `~/.dsh/sessions`（v4=105 /
> v3=6 / legacy=4，索引覆盖 11 个 slug 共 185 个会话）。非 mock：真实日志、真实
> HTTP 请求、真实磁盘缓存（`~/.dsh/cache/session-search/index.json`）。
> 日期：2026-05-27（本机时间口径）；执行人：msgops-innovator。

## 一、session-search（@240xu/dsh-session-search 0.1.0）— 全链路通过 ✅

### 1.1 真实数据检索

```
GET /api/session-search?q=zstd&limit=3
→ {"ok":true,"q":"zstd","count":3,"results":[{"session":{"id":"7ece1077-…","slug":"--…dsh~9762~677F~805A~5408--","title":null},"seq":689,"type":"assistant/message","snippet":"…ssionFileAsync` 同步修；`findSessionDirs` 兼容旧文件名 …"}]}
```

- **v4 会话被索引** ✅：命中会话确认为 `session.v4.jsonl.zstd`；
- **seq 正确性交叉验证** ✅：用 message-ops 的 readSessionFile 独立重读同一日志，
  seq 689 确为 assistant/message 且文本含 "zstd"（与 API 命中一致）；
- **中文关键词** ✅：`q=评审`（URL 编码）命中 2 条，摘录取词正确；
- **project 过滤** ✅：`project=--…dsh~9762~…--` → 52 命中且全部属于该 slug
  （首次用错 slug 得 0 属预期——该 slug 本无 zstd 内容，非缺陷）。

### 1.2 增量索引

```
POST /api/session-search/refresh   （第二次调用）
→ {"ok":true,"scanned":0,"skipped":185,"removed":0,"total":185}
```

- 首建：185 会话全量建索引，请求侧实测 1.5s 内返回（逐帧 setImmediate 让出生效，
  无 GUI 冻结面）；缓存落 `~/.dsh/cache/session-search/index.json` 原子写 ✅；
- 增量：mtime+size 未变全部 skipped ✅；对 sessions 目录零写入 ✅。

### 1.3 信任围栏（上线硬门槛）

```
GET /api/session-search?q=zstd  Host: evil.com        → 403 untrusted request origin ✅
POST /api/session-search/refresh  Content-Type: text/plain → 415 content-type must be application/json ✅
```

### 1.4 面板页

```
GET /api/session-search/panel → HTTP 200 text/html; charset=utf-8 (4583 bytes) ✅
```
服务端零插值（静态模板），动态结果全走浏览器端 esc()。

## 二、同 profile 并存冒烟 — 通过 ✅

- `GET /api/devkit/commands` → `{ok:true, commands:[12 项]}`（真实 devkit apply）✅
- `GET /api/devkit/health` → `{ok:true, plugin:'@240xu/dsh-devkit', node:'v26.4.0'}` ✅
- `GET /api/websearch/history` → `{ok:true, entries:[]}`（真实 websearch
  registerHistoryRoutes + 真实 store 目录；当前无搜索历史属预期）✅
- 三插件路由同进程同端口无路径冲突、无相互污染。

## 三、live 3080 现状（对照）

| 端点 | 结果 | 说明 |
|---|---|---|
| `/api/session-search` | unauthorized | 未安装（本插件尚未发布/挂载到 3080 profile） |
| `/api/devkit/commands` | unauthorized | 未安装 |
| `/api/websearch/history` | `{ok:true, entries:[]}` | 已安装且围栏正常 |

## 四、发现的偏差

- 无 P0/P1。记录一条非缺陷观察：`project` 过滤参数匹配的是 sessions 根下的
  **编码后目录名**（如 `--data-…-dsh~9762~…--`），对人类不直观——面板页结果里
  已展示原始 slug 可复制；后续可考虑在索引里补一个「可读项目名」展示字段（P3，
  未排期）。

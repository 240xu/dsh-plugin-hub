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

## 五、websearch 2.7.3 真实出网实测（compat-audit 后首次真实出网）

> 方法：直接 `node import` websearch 各 backend 模块，真实出网请求
> （真实 query、AbortSignal.timeout 30s、逐后端计时）。执行环境为本机直连网络。
> 结论速览：**keyless 四后端 2 可用 / 2 不可达**，「11 后端并发兜底」的产品主张
> 在本机网络下实际收敛为 exa + parallel 两个后端——聚合兜底仍然成立，但冗余度
> 从宣称的 4 个 keyless 降到 2 个。

### 5.1 逐后端实测矩阵

| 后端 | 状态 | 延迟 | 结果数 | 备注 |
|---|---|---|---|---|
| **parallel**（keyless MCP） | ✅ OK | 2.5–2.9s | 5/5 | 正常 query 命中精准（DeepSeek Harness GitHub 文档首条）；一次异常 query 出现过垃圾结果（IP 直连 URL），复测正常，疑为 query 整形边界，留观 |
| **exa**（keyless MCP） | ✅ OK | 5.6s | 5/5 | 结果质量高（deepseek-harness 仓库文档首条）。**实测窗口内发现并已修复的代码 bug**：探测时 exa.js 曾有重复 `const category` 声明块（bad merge），触发 `inferExaCategory is not defined` 1ms 内崩——该 bug 在实测进行中被并发修掉（文件版本变更），复测通过。若有会话还缓存着旧失败熔断计数，重置熔断即可 |
| **ddg**（keyless HTML） | ❌ 不可达 | 10.6s 超时 | 0 | `fetch failed`（UND_ERR_CONNECT_TIMEOUT），裸 fetch 同样超时 → 本机到 duckduckgo.com 网络不可达，非代码问题 |
| **searxng**（keyless，默认 searx.be） | ❌ 不可达 | 10.5–10.6s 超时 | 0 | searx.be、tiekoetter、inetol、priv.au 四个公共实例全部连接超时（裸 fetch 复核一致）→ 本机网络对 searxng 公共实例整体不可达；自建实例可绕过（backend 已支持 `searxngBaseURL` 配置） |
| key-gated（brave/tavily/serper/mojeek/anthropic-like/openai/deepseek） | ⏭ 跳过 | 1ms fail-fast | — | 无凭据属预期：`<Backend>: API key not configured` 即刻失败（fast-fail 模式正确，不拖扇出）。配置凭据后可参与兜底 |

### 5.2 与产品主张的偏差（重要）

- compat-audit 前提「4 个 keyless 后端并发兜底」在本机网络下**实际只有 2 个存活**
  （exa、parallel）；ddg 与 searxng 全实例不可达是**网络环境问题**而非代码问题
  （裸 fetch 复核一致），但用户在同类网络（CN/受限出口）下会看到同样结果。
- **建议**（P2）：a) 面板/health 输出按后端展示最近一次真实成败，让「兜底还剩
  几个」可观测；b) ddg/searxng 的 10s 连接超时可降到 ~5s——两个都挂时扇出
  白等 10s 才聚合（本次实测聚合延迟被拖到 10.6s）。
- exa 修复窗口期的教训已由并发修掉，无需行动；若再现 `inferExaCategory is not
  defined`，直接定位 exa.js 重复声明块。

## websearch 2.8.0 真实 e2e 实测（2026-09-30，Lead 直接调用 provider）

环境：本机（Termux），真实后端 exa+parallel（keyless 可用集），dsh 0.2.0-rc.2 运行时。

| 场景 | 结果 |
|---|---|
| multiQuery=true，query='zstd vs gzip compression ratio benchmark'（触发门控：vs 分隔） | ✅ 5 sources，RRF 融合，top3 全部高相关（GitHub 基准仓库/Wikipedia zstd） |
| deepCoverage=true，query='zstd compression benchmark' | ✅ 5 sources，全链路 3182ms（advanced depth + 条数上调无异常） |
| 单查询模式回归 | ✅ 77 项 v2.7 旧测试零修改通过（行为逐字节一致） |

结论：2.8.0 的「查全查多」两条路径在真实出网条件下均工作正常。DDG/SearXNG 因本机网络不可达未参与（与 2.7.3 实测一致，非代码回归）。

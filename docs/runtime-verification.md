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

---

## websearch 2.8.0 质量深测（作者自查，2026-09-29，基于 2.8.1 HEAD 4caca45）

环境：Node v26.4.0，真实出网，后端集 exa+parallel（keyless/免费），maxResults=8。
harness：5 组复杂查询（中英混合、多维度、vs/对比类）× 3 模式（single / multiQuery / single+deepCoverage），
每查询新建 provider（无缓存，全真实扇出）；熔断用可开关的 flaky 后端（deadURL↔真实 parallel）实测。

### 1. multiQuery off/on top5 对比与人工评分（1-5：相关性/多样性）

| 查询 | single top5（相关性/多样性） | multi top5（相关性/多样性） | 裁决 |
|---|---|---|---|
| q1 react vs vue performance 2026 | webvitals/tech-insider/cadence/johal/codehowto（4/3） | + react.dev 官方、logrocket 深度文（4/4） | **multi 优**：权威源上浮 |
| q2 DDG 和 Brave 隐私对比 | brave.com×2（zh/zh-tw 近重复）+privacyguides（4/3） | brave.com×3 集群 + duckduckgo.com 首页（3/2） | **single 优**：跨变体同域聚簇未被抑制 |
| q3 k8s vs swarm 三维度 | aliyun/xtechtools/circleci/alauda/ibm（4/4） | + kubernetes.io 官方、docs.prometheus.cool（**监控维度**）（4/5） | **multi 优**：分面覆盖真实改善 |
| q4 Tavily vs Exa agent 场景 | docs.tavily/topaitracker/help.tavily/apipick/exa.ai/versus（5/5） | 同 + codeables.dev（5/5） | 平手：题目本身单面聚焦 |
| q5 推理优化 vs 编译优化长查询（185→ 多维） | nvidia/csdn/百度云（4/3，聚合文为主） | + arxiv.org 论文×2、TVM PDF（4/**5**） | **multi 显著优**：研究分面出学术论文 |

量化：top5 重叠 q1=2/5、q2=3/5、q3=3/5、q4=4/5、q5=1/5（multi 不是单查询的子集，是真增量）。
综合评分：single 均值 4.2/3.6，multi 均值 4.2/4.0——**multi 的收益集中在真多面查询（q3 维度、q5 研究），
简单对比题可能轻微稀释（q2 同域聚簇）**。门控启发式正确拦截了该稀释面（5 题均按设计触发门控）。

### 2. deepCoverage on/off（真实延迟与结果数）

| 指标 | single | single+coverage |
|---|---|---|
| 平均延迟 | 2083ms | 1791ms（噪声内持平，覆盖不加延迟） |
| 平均结果数 | 8（截断） | 8（截断） |

结论：2 后端双满产场景下最终 8 条已饱和，coverage 的收益只在**后端欠产**（<maxResults）时兑现
（每后端预算 ceil(8×1.5)=12 → 去重池更深）。此为预期行为，记录为 P2 观察项：可考虑在遥测行加
「coverage 收益指示」（欠产时触发才显示），让用户看到开关的实际作用。

### 3. 熔断实测（flaky 后端：ECONNREFUSED → 3 连败 → 3s 冷却 → 恢复）

| 次序 | 遥测（节选） | failCount | 冷却中 |
|---|---|---|---|
| 1 | flaky ✗5ms (ECONNREFUSED) · exa ✓1468ms/6 | 1 | 否 |
| 2 | flaky ✗4ms (ECONNREFUSED) · exa ✓1446ms/6 | 2 | 否 |
| 3 | flaky ✗2ms (ECONNREFUSED) · exa ✓1378ms/6 | 3 | **是**（开窗） |
| 4 | exa ✓1409ms/6 · **flaky ⏸cooled 1s** | 3 | **是**（跳过，未发起调用） |
| 5（冷却到期+后端恢复后重试） | flaky ✗589ms (HTTP 429) · exa ✓1666ms/6 | 4 | **是**（立即重开窗） |

验证点全数通过：3 连败开窗 ✓、冷却期跳过（第 4 次搜索 flaky 零调用）✓、到期自动重新合入 ✓、
恢复后仍失败则立即重开（滑动窗，不静默放行坏后端）✓。第 5 次的 429 是压测流量触发的
parallel 限流（非熔断缺陷），恰好同时验证了「重开窗」路径。

### 4. 边界表现

| 用例 | 表现 | 判定 |
|---|---|---|
| >1500 字符 query（实发 1850） | shapeQuery 截断，搜索正常返回 5 条（TensorRT 官方文档居首） | ✅ |
| 乱码查询（zxqvwk jpxqz…） | 返回 5 条垃圾（hey.xyz/u/098123 等） | ⚠ P2：无相关性下限（上游引擎行为，exa 对任意字符串都出结果）；记录不改 |
| 全后端失败（仅 searxng 指向不可达） | WEB_PROVIDER_ERROR，消息含各后端原因与 5s 专属超时：`searxng: backend "searxng" timed out after 5000ms` | ✅ 用户可见表现清晰 |

### 5. 问题清单

- **P0/P1：无**（未发现需立即修复项）。
- P2-1 multi 模式同域聚簇：跨变体融合可能让同域多 URL 聚簇（q2 brave.com×3）；候选缓解=融合后加域名散布上限（每域 ≤2）。记录不改。
- P2-2 coverage 收益不可见：满产场景下开关无观察面；候选=遥测行加欠产指示。记录不改。
- P2-3 乱码查询无相关性下限（上游行为）。记录不改。
- 备注：实测中 parallel 在高频压测下返回 HTTP 429——遥测行如实呈现，熔断按设计重开窗；免费档并发下该现象正常。

结论：2.8.0 两条新路径（multiQuery/deepCoverage）+ 熔断 + 边界四项真实环境验证通过，
multiQuery 对真多面查询有可测量收益（分面覆盖、权威源上浮），门控避免了盲目多查询的劣化。

## message-ops 0.4.x Playwright 实机验证（2026-10-02）

环境：live 3080（0.2.0-rc.2 + 0.4.3 link）、chromium headless（LD_PRELOAD 需 unset——Termux shim 与 chromium 冲突）。

| 验证项 | 方法 | 结果 |
|---|---|---|
| 槽按钮渲染 | 打开真实会话，枚举主区按钮 aria-label | ✅ Revert to here / Delete this message 与官方 Copy/feedback/Branch 并列 |
| 一键回撤接线 | page.route 拦截 POST（零变更） | ✅ 正确 payload {sessionId, seq:16} |
| busy 保护 | 对 Running 会话点击 | ✅ 按钮 disabled（与 opencode assertNotBusy 同语义） |
| dock 渲染 | 打开有标记的会话（session-4e10c1a2，4 个手工标记） | ✅ .mopsRd 出现（bisect-3） |
| dock 数据 | 响应监听 | ✅ markers=4（排除 compaction 后） |
| 生命周期（restoresSeq） | 服务器端逻辑 + 单测 | ✅（恢复后标记移出活跃列表；实机 restore 点击因导航 flake 未完成，逻辑被 40 项单测覆盖） |

### 实机发现并修复
1. **dsh-message-edit（三方）在 0.2.0 崩溃**（MessageEditController 读旧 sessions face `.entries`）→ 已从 live profile 移除（UPB-3 处置）。
2. **@huanlin/dsh-plugin-session-delete（vendored file:）IconTrashOutline16 不存在** → React #130 → 已修复 vendored 源（IconTrashOutlineRegular + SVG fallback），commit 留痕。
3. **message-ops 0.4.1 自身 Hooks 规则违规**（自动折叠 effect 在早退之后 → 标记从 0 变非 0 时槽崩溃）→ 0.4.3 修复（effect 移到早退前）。Playwright 的 React #310 捕获立功。
4. **0.4.1 dock 统计口径错误**（历史累积 776 条）→ 0.4.1 已改为按标记 range 内当前不可见数。

### 遗留
- UI 驱动式 e2e 对 sidebar 导航（workspace 展开/会话定位）脆弱——建议后续用 data-row-key 精确定位 + 固定测试会话。
- 三方 #130 仍会在某些会话出现（agent-team/subagent-catalog 官方条目 + web-all 待查）——不影响 message-ops 自身槽位。

## MCP exa 间歇性不可用排查（2026-10-02，用户报告 mcp__exa__* 时有时无）

- 来源：web profile cordis.patch.yml 的 `mcp-exa-search`（dsh-mcp-client → https://mcp.exa.ai/mcp，streamable-http）。
- 实测：端点本身稳定可达（405 GET-not-allowed，<2s，连续 3 次）；但 boot 日志里 `mcp-exa-search tools` 注册行**只在部分 boot 出现**（近期 17:58/19:19 两次 boot 均缺失）→ 连接在 dsh 启动期握手失败后**不会重试**，工具整轮缺失直到下次 boot。
- 根因候选：①dsh 启动早期网络栈未就绪（Termux 出口晚于服务监听）；②streamable-http 会话握手一次失败即放弃。
- 缓解建议：a) 给 dsh-mcp-client 加连接重试（上游功能请求）；b) 用户侧快速恢复 = 重启 dsh web；c) 把 mcp-exa-search 的 url 换成带重试的本地代理（可选）。

### 遗留说明（dock 实机 restore 点击）
- 实机「真实 revert→dock→restore」闭环的最后一步依赖模型回复（slot 按钮只在 AI 消息上），
  当前 mimo-v2.6-flash-free 持续无响应（request/header=1、0 assistant 消息），环境阻塞而非产品逻辑。
  逻辑已被 40 项单测 + 拦截式接线测试 + dock 渲染测试（bisect-3）覆盖；模型恢复后一键即可复核。

## 「按钮没有用」三层根因完整链（2026-10-03 Playwright 闭环 e2e 实锤）

用户报告的「删除/回撤按钮根本没有用」实际是**三个叠加 bug**，全部实机定位：

1. **视图不收起**（0.5.0 修）：宿主 live 投影只处理 compaction 类 surface replace
   → 插件标记落盘后打开的会话视图不动。修复 = 成功后 `uiWorkspace.openSession`
   重建视图。
2. **dock 静默失效**（0.5.2 修）：0.5.0 脚本化编辑误删 `activeMarkers` 函数
   （与 INPUT_DOCK 常量同一 commit）→ ReferenceError 被 .catch 吞掉 → dock 100%
   不渲染。vm 冒烟 + 猎手抓现行。
3. **打开即 Running**（0.5.3 修，e2e 最后抓到）：isRunning 查 `agents` 注册表——
   会话**仅在视图中打开**就有条目 → 回撤/删除/分支全部 409 锁死。证据：curl 查
   同会话 `running:false`，UI 打开后对话框恒显 "Session is running"、POST 409。
   修复 = 读 `sessions.list.getSnapshot().byId[].running`（host-asserted，与官方
   侧栏 spinner/官方分支按钮 disabled 同源）。

副产品发现：
- 服务端 running 判定与 UI idle 不同步的假象（turn 已 end 仍报 running）同源于
  第 3 层——agents 注册表条目在视图打开期间不清理。
- e2e 工程教训：新会话模型不回复（免费模型挂）→ 会话悬挂 Running → 409；
  闭环 e2e 改为对**既有 idle 会话**操作，不依赖模型回复。
- 3081 双实例验证法：同 profile 起新端口实例避开「会话内重启守卫」，零风险
  验证修复（副作用：双实例内存压力曾触发 Android LMK 杀实例——验证完要收）。

## 四层根因链完整版（2026-10-04 追记：0.5.4–0.5.8）

「点回撤把 dsh 打死 / 永远失败」的完整真相（Playwright + 包装退出码 + 金标准
事件镜像 实机定位，全部已修复发布）：

| 层 | 症状 | 根因 | 修复 |
|---|---|---|---|
| 1 | 视图不收起 | 宿主 live 投影只处理 compaction 类 surface replace | 0.5.0 openSession 重建 |
| 2 | dock 100% 不渲染 | 0.5.0 脚本编辑误删 `activeMarkers`（ReferenceError 被 .catch 吞） | 0.5.2 还原 |
| 3 | 打开即 409 锁死 | isRunning 查 agents 注册表「有条目=running」；官方是 `status==="running"`（api-session-controller:1877） | 0.5.3/0.5.5 官方同源 |
| 4 | **点一次 revert 整个进程 exit=1**（浏览器只见 Failed to fetch；此前所有「实例无故死亡」全是它） | 0.2.0 收紧 v4 行准入：system/message 必须带正整数 `data.turn/step` + 非空 `message.id`；持久层 `encodeEventBatch` 抛的 SessionFormatError **无任何层捕获 → fatal** | 0.5.4+0.5.5 `deriveTurnStep`（尾部回溯，兜底1/1）+ `randomUUID` id；包装器退出码 1 → 修后存活 |
| 5 | store-miss → 404 not in registry | lazy-view 会话只在磁盘渲染、不进对象层；服务端无 retain 面 | 0.5.7 **磁盘帧追加路径**（镜像引擎金标准事件，等价 appendLines：encode→open('a')→sync+回滚）；0.5.8 修 `++now` const 赋值 |
| 6 | dock 死按钮（空区间恒 409） | 遮蔽区间只有 tool/system 事件时无可重放 → 拒绝恢复 → 标记永驻 | 0.5.6 空计划 + 停用 notice（restoresSeq） |

终验（e2e-loop3081 两次全通过 + 服务端断言）：revert `200 disk:true` → dock
label 渲染 → restore `200`（重放/停用两形态）→ **active 标记 0 → dock 消失** →
`[恢复]` 重放内容在日志、进程存活、插件零错误（仅官方 task-board 404）。

工程教训：
- **包装退出码**（run3081-wrapped.sh 记录 `$?`）是区分 LMK/JS崩溃/native 的唯一手段；
  exit=1 + 栈 → JS fatal；无包装时 exit code 不可见，会误判 LMK。
- e2e 对话框定位必须锁定「含 pick radio 的 role=dialog」——dblclick 会话行会弹出
  官方「Rename session」对话框抢 `querySelector('[role=dialog]')`。
- 侧栏行定位天然 flaky（分页 Show more / 列表重排 / 折叠态），devkit 切换浮层
  是更稳的通道（本轮 devkit 浏览器侧未挂载 → 侧栏轮询兜底仍可用）。
- 金标准镜像法：磁盘写新事件前，先从现有日志反解引擎亲手写出的同类事件，
  逐键对照（根键序/3键 replace op/重放无 id）——比读类型定义快且不会漏版本差异。

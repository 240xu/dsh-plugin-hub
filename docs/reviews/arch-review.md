# 四插件生产级架构评审（arch-review）

> 评审对象：@240xu/dsh-message-ops 0.2.0、dsh-websearch 2.7.0、dsh-session-lazy-view 0.2.0（~/slv-check）、dsh-devkit 0.1.0。
> 方法：逐行读源码，对照官方运行时（~/dsh-src、/usr/lib/node_modules/@deepseek-ai/dsh 安装副本）。只读评审，未改任何代码。
> 证据基线日期：本机安装的 dsh 运行时（session surface 形状已实测核对）。

## 总览

| 插件 | P0 | P1 | P2 |
|---|---|---|---|
| dsh-message-ops v0.2.0 | 1 | 1 | 4 |
| dsh-websearch v2.7.0 | 0 | 1 | 3 |
| dsh-session-lazy-view v0.2.0 | 0 | 0 | 3 |
| dsh-devkit v0.1.0 | 0 | 1 | 3 |
| **合计** | **1** | **3** | **13** |

---

## 一、dsh-message-ops v0.2.0

### P0-1 六个 HTTP 路由完全裸奔：可被 DNS rebinding / CSRF 全量读取并改写本地会话日志

- 证据：全部路由经 `webServer.register` 挂载，无任何 Host/Origin/回环校验（src/index.js:284-375；commitHandler 定义 index.js:296-311，revert/delete/branch/restore 全部只查 method 与 JSON 体）。
- 对照宿主：官方对 `/api` RPC 面有明确信任围栏——`~/dsh-src/packages/client/connection/src/api-request-trust.ts:1-10`（"Defends the two confused-deputy paths … DNS rebinding … cross-site requests"），在 rpc-host.ts:82/103 对每个请求执行 `isTrustedApiRequest`。**该围栏只覆盖 connection RPC 面，插件经 `webServer.register` 挂的路由不经过它**。同项目 slv-check 自己复制了这套围栏（见下），证明团队知道正确做法，message-ops 漏了。
- 攻击路径两条：
  1. **DNS rebinding**：攻击者域名 A 记录指 127.0.0.1，浏览器请求 `http://evil.com:port/api/message-ops/messages?sessionId=…`，Host: evil.com——message-ops 不检查 Host → 直接放行 → 攻击页面可**读取全部会话内容**（messages/export）、**遮蔽任意消息**（revert/delete）、**fork 会话**（branch）。
  2. **CSRF 绕过预检**：fetch POST 带 `application/json` 会触发 CORS 预检被拦，但 `readJsonBody`（index.js:52-58）不校验 Content-Type——攻击页用 `text/plain` 发 POST 即绕过预检直达 revert/delete。
- 修复建议：给全部 6 条路由加统一围栏（复制 slv-check index.js:41-56 的 isTrustedApiRequest 即可，最少加 Host 回环校验 + Origin 同源校验），并对写操作（revert/delete/branch/restore）加一次性 CSRF token 或要求自定义头（自定义头天然触发预检）。

### P1-1 会话日志全量同步解压：大日志阻塞整个 `dsh web` 事件循环

- 证据：`readSessionFile` 用 `fs.readFileSync` + `zstdDecompressSync` 逐帧同步解压（src/session-file.js:44-65），调用点 opsList/opsExport/opsRestore/opsBranch（index.js:103/226/237/124）都在 HTTP handler 主线程上跑。内存峰值 ≈ 原始压缩文件 + 全帧明文 + 事件对象数组三份；一个几十 MB 的长会话会让 GUI 全局卡死数秒到数十秒，且 list/export 没有运行中守卫也无并发去重——连续请求会叠加。
- 修复建议：至少 (a) 对单文件读取做进程内互斥 + 结果缓存（mtime 失效）；(b) 用异步 `zstd` 流或 worker_threads；(c) export 支持帧级分页（slv-check 已示范 tail 窗口方案）。

### P2（4 项）

1. **帧边界靠魔数扫描，压缩体内出现 0xfd2fb528 即误切帧**：`scanZstdFrames`（session-file.js:28-42）逐字节扫 magic 定帧界，zstd 压缩载荷里出现该四字节序列的概率不可忽略 → 解压错帧/报 corrupt。宿主格式是「帧带 content size」的规范多帧流，应解析帧头而不是扫魔数（slv-check frames.js:32-46 同病，只是有 per-candidate 容错）。
2. **readJsonBody 无大小上限**（index.js:52-58）：超大 body 全量缓存进内存，配合 P0-1 的无鉴权面可打爆进程。
3. **computeShadowed 只认 startSeq/endSeq 拼写**（session-file.js:168-177），而 planRestore 双拼写兼容（ops-core.js:108-111）——迁移到 dsh-src 新版 `start/end` 形状后 list 的可见性标注会静默全错。建议抽一个共用的 readReplaceOp。
4. **branch 产物不进会话注册表**：applyBranch 只写盘（branch.js:44-52），新会话要等宿主重新扫描才可见；接口应注明或在 README 说明「分支后需刷新会话列表」。另 `findSessionDirs` 取 `dirs[0]`（index.js:124）多 project slug 命中同名 id 时静默选第一个——建议返回歧义错误。

### planRevert 与官方 planSurfaceEvent 约束对齐核查（结论：当前运行时对齐 ✅，前向迁移有雷）

- 写入形状：插件写 `{ op:'replace', startSeq, endSeq }`（ops-core.js:55-62）；安装的运行时 `dsh-session/lib/types/surface.js:198-203` 校验 `Object.keys(op).length===3 && hasOwn startSeq/endSeq` —— **精确匹配**。
- provenance：官方 `assertProvenance`（surface.js:211-243）要求 sourceEventSeqs 覆盖全部被遮蔽节点且都早于当前 seq；插件传 live surface 的 shadowedSeqs（ops-core.js:24-37 + index.js:130-133），满足。
- 运行中守卫：revert/delete/branch/restore 均先 `isRunning` 拒绝 409（index.js:120/157/178）✅；list/export 无守卫但只读且容忍撕裂帧 ✅。
- ⚠️ 前向雷：dsh-src 较新副本已把形状改名为 `{op,start,end}` 且 `Object.keys(op).length===3`（dsh-src surface.ts:173-183）——插件写入的 startSeq/endSeq 在新引擎上是 **invalid replace surfaceOp 直接抛错**。插件读端已双拼写兼容，**写端没有**。升级 cohort 前必须改写端（按运行时探测选择拼写）。
- 另注意新版 surface.ts:279-291 的 `assertToolResultRewrite`：tool/result 替换只许单节点——插件的 replace marker 是 system/message 不受此限，但若未来想支持 tool/result 级编辑需遵守。

---

## 二、dsh-websearch v2.7.0

### P1-1 缓存 key 不含 enabledBackends 选择集：切换后端后 15 分钟内吃到旧后端组合的结果

- 证据：`cacheKeyFor({query, filters, maxResults})`（lib/cache.js:34-40），调用点 provider.js:146。后端选择在 `opts.enabledBackends`（index.js:221-255）解析，但不进 key。用户关掉某后端/换后端组合后，同一 query 在 TTL 900s（cache.js:15）内命中旧组合缓存的 sources——结果与当前配置矛盾（例如已禁用的后端的来源还在）。API key 变更同理（结果可能从"有来源"变"无来源"却拿到旧值）。
- 修复建议：key 加入 `enabledBackends` 排序序列（`[...enabledBackends].sort().join(',')`）即可，成本一行。

### P2（3 项）

1. **缓存命中路径跳过 URL scheme 白名单**（纵深防御缺口）：白名单只在扇出收集时执行（provider.js:309-311 `!/^https?:\/\//i` 丢弃），命中缓存直接返回 `hit.value.sources`（provider.js:148-170）不再校验。缓存文件是本地明文 JSON（cache.js:83-85），被篡改/被其他进程写入 javascript:/data: 来源可直达模型。建议命中路径复用同一过滤函数。
2. **history 并发写丢失更新**：`record()` 是读-改-写全同步（history.js:56-64），无锁；多个搜索并发完成时后写者覆盖前写者（tmp 名含 pid 但同进程内照样互踩）。建议改为单条 append（JSONL）或进程内串行队列。
3. **`/api/websearch/history/clear` POST 无围栏**：history.js:92-104 只查 method。跨站 POST（text/plain 可绕预检）能清空历史，影响小但与 message-ops 同属「插件路由不经宿主围栏」的模式性缺口——建议四插件统一补围栏（见 P0-1 修复建议）。

### 专项核查结论

- **cache key 是否含 enabledBackends**：不含（见 P1-1）。
- **缓存读取路径 scheme 白名单**：写路径生效、读路径跳过（见 P2-1）；缓存内容本身是过滤后写回的，故当前风险有限。
- **history 并发写**：存在丢失更新（见 P2-2）。
- **熔断全冷却边界**：处理正确 ✅——`active.length===0 → cooled.clear()` 走 fail-open（provider.js:191-197），breaker 永不使搜索比无熔断更差；foldBreaker 打开窗口到期后 failCount 保持 ≥threshold，下次失败立即重开（breaker.js:36-50），无震荡死角。小瑕疵：`cooldownMs=0` 因 `||` 落回默认 60s（breaker.js:31），配置为 0 想禁用冷却的用户会得到 60s——文档应注明或改为显式 `!=null` 判断。

---

## 三、dsh-session-lazy-view v0.2.0（路径穿越逐行论证：**不构成 P0**）

### 论证（结论：围栏完整，判 P0 不成立）

攻击面 = `?path=` 参数，入口 `requireArtifactPath`（lib/index.js:116-121）与 `resolveSessionPath`（index.js:108-115），tail/search/stats/export 四端点共用。

1. **白名单前置**：`/(^|\/)session\.(v3\.)?jsonl\.zstd$/`（index.js:118）要求 path 以两个已知工件名结尾——任意文件探测（如 /etc/passwd）直接 400。
2. **规范化后前缀校验**：`normalize(join(root, relativePath))` 后必须 `startsWith(root + sep)`（index.js:111-113）。逐类绕过核对：
   - `../../home/x/…/session.v3.jsonl.zstd`：join 先拼再 normalize，逃出 root → startsWith 失败 → 拒 ✅
   - URL 编码 `%2e%2e%2f`：searchParams 已解码为 `../`，进同一 normalize 路径 → 拒 ✅
   - 绝对路径 `/etc/…`：`path.join(root, '/etc/x')` = `root/etc/x`（join 的第二参数按相对处理）→ 仍在 root 下，逃不掉 ✅
   - `path === root` 本身：被第 1 步正则先行拒绝（不以工件名结尾）✅
   - NUL/空字节：normalize 不剥离，fs.stat/open 抛错 → 统一错误映射 404/500 ✅
3. **围栏前置**：`isTrustedApiRequest`（index.js:41-56）= 回环 Host（DNS rebinding 的 Host 伪造被 isLoopbackHostname 拒）+ `sec-fetch-site: cross-site` 拒 + Origin 同源校验——比 message-ops 多一层浏览器元数据围栏。
4. **残余风险（P2 而非 P0）**：注释明示接受 symlink（index.js:106-107）——能写 `~/.dsh/sessions/**` 的本地攻击者可放符号链接把「名为 session.v3.jsonl.zstd 的文件」指向任意文件（含 root 前缀校验通过的目标，如 root 外某目录里的同名文件）。前提是本地文件写权限，等同已攻陷主机，故不升级。

### P2（3 项）

1. **整文件一次性入内存**：`Buffer.alloc(size)`（frames.js:216-221）无 size 上限；`BIG_SESSION_BYTES` 只是标记位（index.js:26），search/stats 对 500MB 会话照样全量缓冲。建议超过阈值直接 413 或流式扫描。
2. **检查点粒度 = 帧**：`yieldToLoop` 在帧间（frames.js:197/241），单帧明文可达数 MB——一个巨帧的 decompress+split+indexOf 仍会阻塞事件循环数秒，AbortSignal 只能在帧边界生效（frames.js:222-223）。建议按字节预算（如每 4MB 明文 yield 一次）。
3. **搜索无 ReDoS 面已核实 ✅**：匹配全用 `indexOf`（frames.js:262-273），无用户输入进 RegExp；唯一正则在 export 侧 `replace(/\n/g,…)`（frames.js:398）为字面量。命中数/帧数双 cap（50/frame、500 帧、max 200）齐备。

---

## 四、dsh-devkit v0.1.0

### P1-1 「删除当前会话…」无确认，面板内一次 Enter 即删除会话

- 证据：`devkit.session.delete` → `runDeleteCurrent`（src/client.js:371-391）直接 POST `/__chameleon/session/delete`（session-delete 插件的端点，同样无围栏、无运行中守卫确认），无任何确认步骤；palette 中选中 + Enter（client.js:646-648 commit）即执行。
- 修复建议：删除命令改为二次确认（面板内 confirm 态：「再按一次 Enter 确认删除」），并让 session-delete 端点拒绝运行中会话或校验 token。

### P2（3 项）

1. **全局 Ctrl+K / Ctrl+Shift+P capture 劫持**：capture-phase window keydown（client.js:470-489）对所有非文本输入目标 `preventDefault+stopPropagation`。宿主 InputBar 有自己的 ctrl 加速语义（dsh-src InputBar.tsx:325-336 加速 Enter/undo Ctrl+Z 不冲突），但 Chrome 的 Ctrl+K 聚焦地址栏、Firefox 的 Ctrl+Shift+P 隐身窗口均被页面内吞掉；且文本输入豁免在 overlay 打开时失效（client.js:480 `&& !__overlayOpen`）——overlay 打开时在聊天框打字 Ctrl+K 也会被吃。建议：文本输入豁免不因 overlay 开启而取消（overlay 自己的 input 单独处理）；文档声明键位冲突面。
2. **core.js / client.js 双源同步风险**：core.js 自述「tested reference」，client.js 是 classic script 带手抄副本（core.js:6-10 注释）——ChordResolver/matchCommands/isTextInputTarget 存在两份实现，`node --test` 只覆盖 core.js 份；client.js:150 的 commandFields 抄写已与 core.js:105-115 有细节差异（client 版缺 shortcut 字段参与匹配与否需人工比对）。建议 build 期把 core.js 内联注入 client bundle，杜绝手抄。
3. **registerCommand 滥用面**：`window.__dshDevkit.registerCommand`（client.js:305-331）对重复 id 直接 throw（:311-313）——第三方插件重载/hot-reload 场景下会炸自己的 apply；无 `replace: true` 或幂等选项。title/keywords 走 React 文本节点渲染（client.js:692-700），**无 XSS**（已核实 ✅）；run 是任意函数但调用方本就同源，无提权。建议：重复 id 改为 warn + 替换或返回幂等结果。

---

## 上线前必须修（按序）

1. **message-ops 全部 6 条路由补信任围栏**（P0-1）——回环 Host + sec-fetch-site/Origin 校验，写操作加 CSRF token；这是唯一能被任意外网页面直接利用的洞。
2. **message-ops 写端 replace 拼写做运行时探测**（P1/前向雷）——升级 dsh cohort（start/end 形状）当天会全体 500，必须先修。
3. **websearch cache key 加 enabledBackends**（P1-1）——一行修复的正确性问题。
4. **devkit 删除命令加二次确认**（P1-1）——数据破坏性操作一键直达。
5. **message-ops 大日志同步解压限流**（P1-1）——至少加单文件互斥与 mtime 缓存，避免 GUI 冻结。
6. slv-check 的三条 P2 可与上述同批处理（文件大小上限、帧内 yield、symlink 决策显式化）；「插件路由不经宿主 /api 围栏」是模式性缺口，建议在 @240xu/dsh-suite 聚合层提供统一 fencedRegister 工具，四插件收口。

---

## Lead 汇总（2026-09-27）：四线评审交叉结论与行动清单

评审编制：产品 A（用户价值）、产品 B（市场/竞品）、架构师（健壮性/安全）、前端专家（UI/UX/a11y）。
四份文档：pm-a-product.md / pm-b-market.md / arch-review.md / fe-ui.md。

### 评分汇总
| 插件 | 产品均分 | 市场就绪 | 架构发现 | 前端发现 |
|---|---|---|---|---|
| dsh-websearch 2.7.0 | 4.0 | 🟡 | 1P1+3P2 | 4 条 |
| dsh-message-ops 0.2.0 | 3.5 | 🟡 | **1P0**+1P1+4P2 | 7 条 |
| dsh-session-lazy-view 0.2.0 | 2.8 | 🟡 | 3P2 | 5 条 |
| dsh-devkit 0.1.0 | 4.0 | 🔴 | 1P1+3P2 | **1P0**+6P1 |

### 全员一致的上线路径（按序）
1. **P0-安全**：message-ops 六路由复制 isTrustedApiRequest 围栏 + 写操作 token（DNS rebinding/CSRF 实证可绕）
2. **P0-前向雷**：message-ops 写端 replace 拼写 {startSeq,endSeq} → 升级前必须兼容 {start,end}（dsh-src 已改名，升级当天全炸）
3. **P0-体验**：devkit 焦点陷阱 + 焦点还原（fe-ui 附修复代码）；devkit.websearch.settings 死命令（websearch 补监听或暂时下架该命令）
4. **P1**：websearch cache key 加 enabledBacksets（一行）；devkit 删除会话加确认；message-ops 大日志分块解压；slv 可发现性（devkit 注册打开命令 + 安装 Toast）
5. **发布工程**：devkit 上 npm、四包补 nameEn/descriptionEn、websearch CHANGELOG 2.5-2.7 追写、截图/GIF（devkit 占位图阻断项）、suite 叙事打包发布

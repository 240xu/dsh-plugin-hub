# R2 架构复审（R1 修复交叉复审）

> 复审对象：message-ops v0.2.1（ce11fb6）、websearch v2.7.1（c9d259e）、devkit v0.1.1（3cdad38）。slv-check 本轮无修复交付，未列入。
> 方法：逐行读修复 diff 与现场代码，对照 R1 报告（arch-review.md）与官方运行时 surface.js/index.js 抛点核实；三个插件测试套件实跑（message-ops 31 pass / devkit 27 pass / websearch 全绿）。

## 复审表

| 插件 | R1 项 | Verdict | 摘要 |
|---|---|---|---|
| message-ops | P0 围栏 | **PASS** | 六路由全部过 fence/writeFence，三层实现正确 |
| message-ops | token 省略论证 | **PASS-with-notes** | 论证成立，残余一个边缘（见 N1） |
| message-ops | 写端拼写探测 | **PASS-with-notes** | 抛点核实无半写；降级依赖错误文案匹配（N2） |
| message-ops | readSessionFileAsync | **PASS-with-notes** | 让出策略生效，但 branch 路径仍是同步旧读（N3） |
| websearch | cacheKey backends 维度 | **PASS** | 排序序列入 key，调用点已传参 |
| websearch | history 围栏复用 | **PASS-with-notes** | 与 message-ops 等价可接受，语义有细微分歧（N4） |
| websearch | cooldown=0 边界 | **PASS** | `!= null` 显式判断，注释齐全 |
| devkit | 删除确认弹层 | **PASS-with-notes** | 弹层完整；绕过面核实为"不可直达"（N5） |
| devkit | 幂等去重 | **PASS** | 同 run 幂等返回原 unregister，冲突 run warn+忽略不 throw |

**总评：0 FAIL。3 项 PASS，6 项 PASS-with-notes，遗留 5 条（均为 P2 级，不阻塞上线）。**

---

## 逐项复审

### 1. message-ops v0.2.1

#### 1.1 P0 围栏落地 —— PASS

- `isTrustedApiRequest`（src/ops-core.js:246-257）三层结构与 slv-check/原方案一致：回环 Host（isLoopbackHostname 含 localhost/[::1]/127.0.0.0/8，:239-244）→ sec-fetch-site cross-site 拒 → Origin 同源校验。
- 覆盖核实：六个路由全部先过围栏——messages/export 走 `fence`（src/index.js:349、409），revert/delete/branch/restore 走 `writeFence` = fence + `isJsonContentType`（ops-core.js:266-271）415 拒绝非 JSON Content-Type（text/plain 绕预检路径被封死）。grep 确认无未围栏路由。
- 新增测试 test/fence.test.js（208 行）覆盖三层拒绝路径。
- 对照宿主：与 dsh-src api-request-trust.ts 的围栏语义等价（rebinding Host 被第 1 层拒，跨站 POST 的 Origin 被第 3 层拒）。

#### 1.2 token 省略论证 —— PASS-with-notes

- 论文（ops-core.js:260-265）："浏览器对所有 POST 都附带 Origin，第 3 层已覆盖跨站 POST；自定义头天然触发预检，token 不增益"。核实：现代浏览器对跨站 POST（含 no-preflight 的 text/plain / form）必带 Origin 头 → 第 3 层 Origin≠Host 拒绝 ✅。rebinding 场景 Host 校验已拒 ✅。**论证成立。**
- N1（边缘）：`origin === undefined → return true`（ops-core.js:256）。无 Origin 且无 sec-fetch-site 的 POST 被信任——真实浏览器跨站 POST 不会缺 Origin，但某些内嵌 WebView/隐私模式可能剥离 Fetch-Metadata 且不带 Origin。残余风险低（需同时绕过 Host 回环校验，即 rebinding 域名 + 剥 Origin 的浏览器），记录即可，不要求修。可选加固：对 POST 要求 Origin 必须存在且同源。

#### 1.3 写端拼写探测 —— PASS-with-notes

- 抛点核实 ✅：安装运行时 `dsh-session/lib/types/index.js:593` `this.surfaceManager.validateNext(event)` 在 `entry.appending = true`（:595-597）与任何持久化/事件发布**之前**执行；"invalid replace surfaceOp" 文案在 surface.js:231。validateNext 抛出时 seq 未消费、log 未追加 → catch 内换拼写重试**确无半写风险**。
- 探测缓存（ops-core.js:69/92/97）语义正确：成功一次即锁定形状，避免每写两次尝试。
- N2：降级触发条件是错误文案正则 `/invalid replace surfaceOp/`（ops-core.js:94）。若未来引擎改文案，catch 不匹配 → 错误原样抛出 → **响亮失败而非静默错写**（可接受）；但探测永远不缓存新形状。建议注释中注明依赖该文案稳定性（已有 README 记录，代码处可加一行）。

#### 1.4 readSessionFileAsync —— PASS-with-notes

- 让出策略：每 `framesPerYield=8` 帧 `await yieldToLoop()`（session-file.js:202-216），事件循环不再被整个文件阻塞 ✅；export 端 partial 提示（index.js:200-206）。
- N3（遗留）：**branch 路径仍走同步 `readSessionFile`**（index.js:177-178 → branch.js:42），大日志 fork 仍会阻塞事件循环；且 `readSessionFileAsync` 开头的 `fs.readFileSync`（session-file.js:203）仍是整文件同步读。P1 的主体（list/restore/export 三个高频路径）已修，branch 属低频路径，降级为 P2 遗留。

#### 1.5 其他 R1 P2 项抽查

- 1MB body cap 413 ✅（index.js:46-56）；歧义 session dir 409 ✅（index.js:124）；readReplaceOp 双拼写单点 ✅（session-file.js:194-203，computeShadowed/planRestore 均已收口）。
- scanZstdFrames 魔数扫描未改（R1 P2-1 未处理）——遗留。

### 2. websearch v2.7.1

#### 2.1 cacheKeyFor backends 维度 —— PASS

- `b: [...backends].sort().join(",")` 入 key（cache.js:36-46）；调用点 `backends: opts.enabledBackends`（provider.js:146）✅。测试实跑通过。

#### 2.2 cache 命中路径 scheme 白名单 —— PASS（R1 P2-1 一并修复）

- 命中先过滤 `/^https?:\/\//`，全灭则视为 miss（provider.js:149-160）——纵深防御闭环 ✅。

#### 2.3 history 围栏复用 —— PASS-with-notes

- 实现等价性：history.js:103-118 与 message-ops 版同为「回环 Host + sec-fetch-site/Origin」三层，两条路由均过 guarded（:129-140）✅。
- N4（语义分歧，非缺陷）：websearch 版要求 `sec-fetch-site === same-origin | none` 才直接放行（:108），message-ops 版只拒 `cross-site`。对真实浏览器两者行为一致（跨站必有 Origin 且被 Origin 校验拒），但 `same-site` 请求在 websearch 走 Origin 精确匹配、在 message-ops 直接通过 cross-site 检查后也走 Origin 校验——终局语义相同。另 websearch 的 Host 正则 `127\.\d{1,3}…` 允许 127.999.0.1 这类非法八位组（无害，浏览器不会生成）。建议后续抽成 suite 共享围栏模块（与 message-ops/slv-check 三处收口）。

#### 2.4 history 并发写 —— PASS

- promise 链串行化写（history.js:39-46、65-70），注释明确跨进程范围外。丢更新路径消除 ✅。

#### 2.5 cooldown=0 —— PASS

- `cfg.cooldownMs != null` 显式判断（breaker.js:31-36），0 = 立即过期而非落回 60s，注释引用本评审项 ✅。

### 3. devkit v0.1.1

#### 3.1 删除确认弹层 —— PASS-with-notes

- 弹层完整：confirmDelete 模式带描述/取消/确认/running 警告/busy 态（client.js:757-780），确认按钮 focus（:641-643）。
- 绕过面核实（lead 指定问题：能否直接调 deleteCurrentSession？）：
  1. `deleteCurrentSession` 是模块 IIFE 内部函数，**未暴露在 `window.__dshDevkit` api**（client.js:503-512：仅 version/registerCommand/toast/openPalette/openSessions/openShortcuts/openDevInfo/listCommands）→ 控制台/其他插件不可直达。
  2. 内置命令 `devkit.session.delete` 的 run 只 `openOverlay('confirmDelete')`（client.js:489）——即命令注册表被外部注入同名 id 也只开弹层。
  3. `dsh-devkit:open` 事件可被任意页内脚本 dispatch `detail:{mode:'confirmDelete'}` 打开弹层，但执行删除仍需用户点击确认按钮（client.js:777）——弹层即防线，可接受。
  4. **真正的残余绕过在 devkit 之外**：端点 `/__chameleon/session/delete` 本身（session-delete 插件）仍无围栏、无确认——页内脚本可绕过 devkit 直接 fetch 它。属跨插件遗留（见遗留清单 L4）。

#### 3.2 幂等去重 —— PASS

- 同 id + 同 run → no-op 返回原 unregister（client.js:497-500）；冲突 run → console.warn + 忽略不 throw（:501-502）——hot-reload/double-load 场景不再炸 apply，palette 稳定 ✅。

#### 3.3 双源一致性 —— PASS

- 新增 test/consistency.test.js：对 core.js/client.js 中同名纯函数做哈希对比，drift 即 fail——R1 P2-2 的手抄漂移风险已用测试闭环 ✅。

---

## 遗留清单（全部 P2，不阻塞上线）

| # | 项 | 位置 | 说明 |
|---|---|---|---|
| L1 | branch 路径同步解压 | message-ops branch.js:42 | applyBranch 仍用 readSessionFile，大日志 fork 阻塞事件循环；readSessionFileAsync 开头的 readFileSync 整读也仍同步 |
| L2 | 帧边界魔数扫描 | message-ops session-file.js:28-42（slv-check frames.js:32-46 同病） | 压缩体出现 zstd magic 即误切帧；应解析帧头 content size |
| L3 | 插件围栏三处重复实现 | message-ops ops-core.js:246 / websearch history.js:103 / slv-check index.js:41 | 语义等价但实现分歧（sec-fetch-site 宽严、Host 正则差异）；建议 suite 层抽共享 fencedRegister |
| L4 | /__chameleon/session/delete 端点无围栏 | dsh-plugin-session-delete src/index.js:352 | devkit 的确认弹层只护 UI 面；页内脚本可绕过直接调端点。该插件不在本轮四插件范围，但 devkit 依赖它，需下轮立项 |
| L5 | 无 Origin POST 被信任 | message-ops ops-core.js:256 | 理论边缘（剥离 Origin 的 WebView），可选加固：POST 要求 Origin 存在且同源 |

**结论：R1 修复质量高，三项全 PASS/PASS-with-notes、零 FAIL；测试闭环（围栏测试、一致性快照）是亮点。遗留 5 条均为 P2，其中 L4 建议优先排期。**

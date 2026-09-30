# @240xu 六包去冗审计（dedup audit）

日期：2026-09-28 · 审计员：去冗 subagent · 方法：全读源码（只读）
对象：dsh-message-ops / dsh-session-search / slv-check(dsh-session-lazy-view) / dsh-websearch / dsh-devkit / dsh-suite

## 结论速览

- 重复矩阵 **10 行**（函数级盘点，见下）
- 语义分叉（A 改了 B 没改 / 从一开始就不同语义）**2 处**：fence 的 websearch 变体、帧扫描的严格/宽容策略
- 推荐方案一句话：**发布零依赖 `@240xu/dsh-kit`（方案 c）收口纯逻辑，kit 本身零 npm 依赖不破坏各包"零依赖"声明的精神，迁移期以方案 (b) 的哈希一致性测试做护栏；suite（方案 a）继续只做故障隔离壳，不承担 util 收口。**

---

## 1. 重复矩阵

### R1 `isTrustedApiRequest` ×4（范围内）＋ ecosystem ×2（登记外）

| 位置 | 语义 | 备注 |
|---|---|---|
| dsh-message-ops/src/ops-core.js:246-256 | 回环 Host + 非 cross-site + Origin 同源 | 三层围栏，与宿主 isTrustedApiRequest 同款；配套 headerOf/parseAuthority/isLoopbackHostname (:230-243) |
| dsh-session-search/src/fence.js:24-34 | **逐字节相同**（含 helper 三件套 fence.js:9-22） | 头部注释自认"自包含复制自 dsh-message-ops/ops-core.js" |
| slv-check/lib/index.js:54-68 | **逐字节相同**（helpers :37-52） | 注释 "Same trust gate as archived-sessions" |
| dsh-websearch/lib/history.js:103-116 | **语义分叉（D1）** | 见 §2 |

范围外同款：dsh-archived-sessions/lib/index.js、dsh-better-sidebar/src/trust-fence.ts —— 全生态共 **6 份**。差异点普遍在：sec-fetch-site 取值集合（三份严格版只拒 `cross-site`；websearch 版接受 `same-origin|none`）、Origin 缺省时行为（严格版：无 Origin 放行；websearch 版：有 site 头但非 same-origin 才拒）、Host 校验（严格版逐段校验 127.0.0.0/8 每 octet ≤255；websearch 版正则 `127\.\d{1,3}\.\d{1,3}\.\d{1,3}` 不查 ≤255、允许 `127.999.999.999`）、返回类型（boolean vs 拒绝原因字符串）。

### R2 zstd 帧扫描 ×3

| 位置 | 策略 | 语义 |
|---|---|---|
| dsh-message-ops/src/session-file.js:32-49 `scanZstdFrames` | 魔数 0xfd2fb528 定界，**非魔数即 throw**，不验证可解压 | 严格：坏帧让整个 readSessionFile 抛错 |
| dsh-session-search/src/session-file.js:25-42 | **逐字节相同副本**（非 export） | 同上 |
| slv-check/lib/frames.js:32-39 `scanFrameOffsets` | 魔数只是**候选**，由 decompressFrame (:42-46) 解压失败来判定；坏帧留在结果里带 error 不炸整体 (:53-65)；另有尾部窗口扫描 readTailFrames (:81-122)、流式计数 countFrames (:318-340) | 宽容：**语义分叉（D2）**——同为"坏帧"，message-ops/session-search 全文件失败，slv-check 单帧降级 |

三处均已知同一取舍：压缩载荷里出现魔数四字节会误判边界（slv-check 靠解压校验兜住，另两份靠"DSH 自家写入不会产生该模式"的假设）。session-search README「已知重复」已登记三处一致。

### R3 `messageText` / 文本提取 ×3（+1 内联）

| 位置 | 语义 |
|---|---|
| dsh-message-ops/src/ops-core.js:30-38 | 首个非空 text 块 |
| dsh-session-search/src/session-file.js:92-100 | **逐字节相同副本** |
| slv-check/lib/frames.js:157-187 `describeEvent` | **有意不同**：多 entry（text/tool-call/tool-result/raw）、带 2000 字符 clip——面向面板展示而非语义重放，登记为"有意差异" |
| dsh-message-ops/src/session-file.js:137-147（listMessages 内联） | **重复提取逻辑内联第三份**而非调用 ops-core 的 messageText（同包内互不 import），漂移点：此处无 trim 空串提前返回的完全一致保证（当前实现恰好一致，未来易漂移） |

### R4 snippet 生成 ×3

- dsh-session-search/src/indexer.js:128-134：匹配点 ±60 字符窗口、`…` 省略号
- slv-check/lib/frames.js:206 + 266-279：`SNIPPET_WINDOW = 60`、每帧 50 条上限、无省略号
- dsh-message-ops/src/session-file.js:152：列表摘要 `slice(0,160)`（不同用途，弱重复）

窗口值 60 两处一致（巧合或抄写），上限语义不同。低危。

### R5 原子写 tmp+rename ×4

| 位置 | tmp 命名 | 差异 |
|---|---|---|
| dsh-message-ops/src/branch.js:50-52 | `newLogPath + ".tmp-messageops"` | 后缀式 |
| dsh-session-search/src/indexer.js:49-51 | `index.json.${pid}.tmp` | pid 中缀 |
| dsh-websearch/lib/cache.js:77-81 `atomicWrite` | `${file}.${pid}.tmp` | 同上；readdir 时显式排除 .tmp |
| dsh-websearch/lib/history.js:55-61 `atomicWriteAll` | `${f}.${pid}.tmp` | 另有 Promise 链串行写（P2-2 修复），JSON pretty-print |

四个实现逐行等价（writeFileSync → renameSync），仅命名/串行化差异。**websearch 包内自己就有两份**（cache.js/history.js），是本包内最先该收口的。

### R6 UUID / session id ×3

- dsh-message-ops/src/session-file.js:87-99,128-130：`SESSION_ID_RE`、`isSessionId`、`sessionIdVariants`、`newSessionId`（`session-${crypto.randomUUID()}`）
- dsh-session-search/src/session-file.js:104：`SESSION_ID_RE` **逐字节相同副本**（仅用于 discover 过滤）
- slv-check/lib/index.js:146：`sessionDir.replace(/^session-/, "")`（弱重复：前缀剥离约定）
- 范围外：dsh-plugin-session-delete/src/index.js:61、dsh-true-revert/src/index.js:39 各有第三/四份 variants 逻辑

### R7 `yieldToLoop`（setImmediate 让出）×3

- dsh-message-ops/src/session-file.js:196
- dsh-session-search/src/session-file.js:19
- slv-check/lib/frames.js:201

逐字节相同的一行函数。行为一致，纯样板重复。

### R8 HTTP JSON 回写 helper（sendJson/writeJson）×3

- dsh-message-ops/src/index.js（sendJson，403 行文与 session-search 完全同句："untrusted request origin (loopback Host + same-origin only)"）
- dsh-session-search/src/index.js:34,70,90（同上）
- slv-check/lib/index.js:69-78（writeJson/writeOk/writeFail，多 ok 信封结构）
- dsh-devkit/src/index.js:33-40（sendJson，带 content-length）

轻微漂移：slv-check/devkit 用 `{ok,value|error}` 信封，message-ops/session-search 直接回错误对象——API 形状未统一。

### R9 devkit 内部双源（有意重复 + 已有护栏）

- dsh-devkit/src/core.js:150-309 ↔ src/client.js（classic script 拷贝 matchCommands/isTextInputTarget/ChordResolver 等 9 个函数）
- 护栏：test/consistency.test.js 抽取+哈希比对，漂移即红。**这是生态里唯一已闭环的重复治理先例。**

### R10 回环判定（socket 级）×1 独苗

- dsh-suite/src/shell.js:48-53：/api/dsh-suite/degraded 用 remoteAddress === 127.0.0.1/::1，与 R1 的 Host 头围栏是不同机制（连接级 vs 头级），不算重复，但生态内"回环判定"共 3 种写法，文档应并列声明各自适用层。

## 2. 漂移风险评级

| 级别 | 项 | 说明 |
|---|---|---|
| 🔴 高 | **D1 fence websearch 变体**（history.js:103-116） | 唯一"分叉实现且更弱"的围栏：octet 无 ≤255 上界、sec-fetch-site 语义不同、无 Origin 且无 site 头时放行的条件与三份严格版不同。安全围栏分叉最危险——修复一处（如收紧 127/8 校验）不会传播到这。 |
| 🟠 中 | **D2 帧扫描严格 vs 宽容** | 行为契约不同（坏帧：抛错 vs 单帧降级）。若宿主格式变化（如引入帧级 magic 转义/新帧类型），三处要分头改，且两份严格版会先炸。 |
| 🟡 低 | R3 的 listMessages 内联、R4 窗口巧合一致、R5 命名差异、R6 regex 副本、R7/R8 样板 | 当前语义一致，纯腐化风险（改一处忘另一处），非行为分叉。 |

有意/无害分叉（不收敛）：slv-check describeEvent（展示用）、devkit 双源（已有哈希护栏）。

## 3. 收敛方案对比

### (a) suite 运行时收口

fencedRegister、fence、zstd scan、atomicWrite 等作为 suite 导出，各子包深链 `import("@240xu/dsh-suite/util/fence")`。
- 优点：零新增包；suite 已是 bundle 挂载点，天然保证同时在线。
- 缺点：**standalone 模式无解**——suite README 第 6 步实测 standalone 子包与 suite 共存是支持场景；standalone 子包 import suite 会在裸挂时 import 失败。需探测降级（`try import` + fallback 本地副本），等于每处收敛点都保留一份副本 + 一段探测胶水，代码总量不降反升；且 suite 壳的定位（故障隔离）被混入 util 库职责，壳升级会牵连所有子包。
- 判定：**否**。探测降级副本使收敛收益归零。

### (b) 各包独立保留 + 一致性快照测试 + 变更联动 checklist

把 devkit consistency.test.js 的 extract+hash 手法复制为跨包契约测试（可放 dsh-plugin-hub，跑在 CI/手测），逐对锁定 R1/R2/R3/R6 的副本；README「已知重复」补齐到六包。
- 优点：零架构改动、零发布顺序风险；分叉立即可见；与"自包含"原则完全兼容。
- 缺点：修 bug 仍要 N 处手改（测试只防漂移不省工作量）；N 随包数增长（fence 已 6 份）。
- 判定：**作为迁移期护栏与 kit 化前的止损必备**，不作为终态。

### (c) 发布 `@240xu/dsh-kit`（推荐）

kit 仅含纯函数、自身零 npm 依赖（只用 node: 内置），子包声明对 kit 一层依赖（npm publish 后 pnpm hoist 一并装好；slv-check 裸克隆的 schemastery shim 教训提示：kit 需在 suite 链路里被 hoist，发布包无此问题）。
- 收口清单（按危险度排序）：① fence（含 isJsonContentType，返回值统一为 boolean + 可选 reason）② zstd 帧扫描（提供 strict / candidate 两模式，D2 显式参数化而非两份实现）③ atomicWriteFile(file, data, {suffix}) ④ session id 工具（RE/variants/newSessionId）⑤ messageText ⑥ yieldToLoop。
- 优点：单一事实源、bug 修一处全修、测试矩阵一份；不破坏"零 npm 依赖"的实际含义（kit 自身零依赖，子包依赖图深度 +1 但无传递第三方）。
- 缺点：发布顺序约束（先 kit 后子包）；slv-check 目录名与包名不一致需在发布时理顺；kit 版本升级需要子包跟进（可用 `^` + suite 集成测试兜底）。
- 判定：**终态方案**。standalone 场景 kit 照常工作，无需探测。

**推荐：c 为终态，b 立即执行作为过渡护栏，a 不采纳。**

## 4. 立即可做的低成本收敛（不改架构）

1. **fence 断言矩阵统一**：把 dsh-message-ops/test/fence.test.js 的用例矩阵复制为 dsh-session-search/test/fence.test.js（目前该目录只有 indexer.test.js，围栏零测试）、slv-check 与 dsh-websearch/history 各一份（后者按其变体语义写"当前行为快照"用例，把 D1 的弱化点显式钉在测试里，防止无意再漂移）。
2. **websearch 包内合并 atomicWrite**：cache.js 与 history.js 的两份合成一个本地 `lib/atomic.js`（同包内收口无跨包成本）。
3. **message-ops 包内去内联**：listMessages 的提取逻辑改调 ops-core 的 messageText（同包 import，已依赖）。
4. **补齐六包 README「已知重复」节**（目前仅 session-search 有登记），逐条指向本审计的 R 编号。
5. **跨包一致性冒烟测试**（方案 b 最小版）：dsh-plugin-hub 下一个 node 脚本，对 R1/R2/R6 的副本做 normalize+hash 比对（devkit 手法），漂移即退出非零。
6. **D1 决策**：单独评审 websearch history.js 的围栏是否要有意保持变体；若无意，先对齐严格版（一行 octet ≤255 校验 + boolean 化），再纳入 kit 收口。

## 汇报口径

- 重复矩阵行数：**10**（R1 fence ×4、R2 帧扫描 ×3、R3 messageText ×3+内联、R4 snippet ×3、R5 原子写 ×4、R6 session-id ×3、R7 yieldToLoop ×3、R8 JSON 回写 ×4、R9 devkit 双源、R10 回环判定三写法并列）
- 语义分叉数：**2**（D1 websearch fence 弱化变体🔴、D2 帧扫描严格/宽容🟠）；另有 R3/R4/R8 三处"有意或弱"差异不计入
- 推荐方案一句话：发布零依赖 `@240xu/dsh-kit` 收口纯逻辑（c），迁移期用跨包哈希一致性测试护栏（b），suite 保持纯故障隔离壳不做 util 收口（否 a）。

# 官方契约矩阵（六包 × 官方依赖面）——完整性检查员常驻基线

> 日期：2026-09-29 · 对照三条官方线：
> **A** 安装运行时 `@deepseek-ai/dsh@0.2.0-rc.2`（npm latest，本机 live）；
> **B** `~/dsh-core-pr` checkout（0.1.7-rc.2 release 线，2026-09-26）；
> **C** `~/dsh-src`（0.1.0-rc.5 公开存档快照，2026-08-13，浅克隆）。
> 六包：dsh-suite 0.1.0、dsh-websearch 2.7.2、dsh-message-ops 0.2.4、dsh-devkit 0.2.2、dsh-session-search 0.1.2、dsh-session-lazy-view 0.3.0。
> 每格 = 官方证据（file:line）+ 当前行实际行为。✅=契约成立　⚠=有条件/降级　❌=断层

**重要更正（对 R1 评审）**：`~/dsh-src`（线 C）的 surface replace 用 `start/end` 拼写（surface.ts:175-181）且 `SESSION_FORMAT_VERSION = 0`（types.ts:56）——它是**最老的公开存档**而非前向线。release 真线是 B→A：**`startSeq/endSeq`**（core-pr surface.ts:296-306；runtime dsh-session/lib/types/surface.js:198-203）+ **VERSION=4**（core-pr types.ts:89；runtime dsh-session/lib/index.js:56）。R1 所报"写端拼写前向雷"实际方向相反：现役线就是 message-ops 写的 startSeq 形状，雷已解除（双拼写探测保留为纵深）。

## 1. 依赖面矩阵（7 面 × 6 包 = 42 格）

### 面 1：webServer.register 签名
官方：`register(route: WebRoute): () => void`（dsh-src packages/host/webserver/src/index.ts:94；core-pr 同 :166）；WebRoute = `{ kind: 'exact'|'prefix', path, handler }`（dsh-src index.ts:38-43；core-pr :38-42，exact/prefix 双线一致）；runtime dsh-host-webserver@0.2.0-rc.2 同签名。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| suite | ✅ | src/shell.js 健康路由 `kind:'exact'`；webServer 迟到经嵌套 inject fiber |
| websearch | ✅ | lib/index.js:428 `ctx.inject(["webServer"])` + health/history 路由 exact |
| message-ops | ✅ | src/index.js:284-375 六路由全 exact |
| devkit | ✅ | src/index.js:48-77 commands/health exact，webServer 迟到 inject |
| session-search | ✅ | index.js webServer 注入 + exact 路由（0.1.2 围栏后） |
| lazy-view | ✅ | lib/index.js 唯一 `kind:'prefix'` 用户 `/lazyview`（两代 kind 都支持） |

### 面 2：settings 双代（SettingsProvider+installSection ↔ SettingsForms）
官方：0.1.5-rc.3 npm 线 = `SettingsProvider` + `installSection`；0.1.7+ = `SettingsForms`（core-pr packages/settings/settings/src/index.ts:223 `class SettingsForms extends Service`，:41 声明 `settings: SettingsForms`；runtime dsh-settings/lib/index.js:322,552 导出 SettingsForms，**installSection 出现次数 = 0**）。SettingsForms 的读取面是 `describe()`（core-pr index.ts:301+），注册走 cordis config schema（loader entry），无插件侧 installSection。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| websearch | ⚠ | 服务端 installSection typeof 守卫（lib/index.js:370）→ 0.2.0-rc.2 runtime 下**静默 no-op**；客户端 settingsScope 已改 feature-detect 降级（client.js:548-561：无服务时 warn + 不挂卡片，不再硬死）。**净效果：无 shim 时 websearch 无设置 UI**（仅 cordis config 可配）——compat-audit 最危险 #1/#3 的残留面 |
| message-ops | ✅ | 不用 settings 服务（无设置面） |
| devkit | ✅ | 同上 |
| session-search | ✅ | 同上（Config schema 走 loader entry，不碰 settings 服务） |
| lazy-view | ✅ | `z.object({})` 空配置，仅 loader 层 |
| suite | ✅ | 壳无配置面 |

### 面 3：surface replace 拼写（含会话格式版本）
官方：release 线（B/A）= `{op:'replace', startSeq, endSeq}` 三键精确（core-pr surface.ts:296-306；runtime surface.js:198-203）+ `SESSION_FORMAT_VERSION=4`（core-pr types.ts:89；runtime index.js:56）；线 C 存档 = `start/end` + VERSION=0（surface.ts:175-181、types.ts:56）。日志文件名 v4（session.v4.jsonl.zstd）为现役，v3/legacy 单帧仍需读。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| message-ops | ✅ | 写端 startSeq（现役形状）+ 失败降级 start/end 探测（ops-core.js:69-98）；读端 v4→v3→legacy 全兼容（session-file.js collectHeaderAndEvents，0.2.3） |
| session-search | ✅ | 0.1.2：discover v4 优先/v3/legacy 回落 + version 门放宽 0/3/4（session-file.js KNOWN_VERSIONS）；真机冒烟 147 v4+17 v3+1 legacy 全可读 |
| lazy-view | ✅ | frames.js v3 多帧 + legacy 单帧（:9-13）；**⚠ 未加 v4 文件名探测**（仍只找 v3 与 legacy，index.js:141）——0.3.x 用户看不到 v4 会话，下轮补 |
| websearch / devkit / suite | — | 不触碰会话日志 |

### 面 4：slots 名单（shell.overlay / conversation.session.header.actions / settings.section）
官方：runtime 实测 slot 名消费方——`shell.overlay`：dsh-client-ui-chat、dsh-client-ui-commands 的 lib/client.js；`conversation.session.header.actions`：dsh-client-ui-agent-preset、dsh-client-ui-conversation；`settings.section`：dsh-client-ui-agent-preset、dsh-client-ui-settings-account（slot 注册协议 = ctx.slots.inject(name, () => ctx.slots.register({name, id, order…}, Comp))）。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| devkit | ✅ | client.js:1230 `OVERLAY_SLOT`（shell.overlay）+ :1237 `HEADER_SLOT`（conversation.session.header.actions），runtime 两个 slot 均在 |
| message-ops | ✅ | client half 用 conversation.session.header.actions（id message-ops, order 31），runtime 在 |
| websearch | ⚠ | settings.section slot 注册（order 16）本身成立，但卡片渲染依赖 settingsScope 绑定（见面 2）——slot 存在 ≠ 卡片可用 |
| lazy-view / session-search | — | 自带 HTML 面板，不走 slots |
| suite | — | 壳无 client half |

### 面 5：schemastery
官方：runtime `@deepseek-ai/schemastery@3.18.4`（dsh package.json `"~3.18.4"`）；core-pr settings 包 workspace 依赖同源（packages/settings/settings/package.json:39）。两代 settings 均以 schemastery schema 为配置载体。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| lazy-view | ⚠ | `import z from "@deepseek-ai/schemastery"`（lib/index.js:18）静态依赖但 **peerDependencies 仍未声明**（package.json 无 peerDep 段）——npm hoist 下活，裸克隆挂（compat-audit 立修 6 未完成） |
| websearch | ✅ | schemastery 在静态 peer 清单（lib/index.js:11-24）且已声明 |
| 其余三包 + suite | ✅ | 不依赖（message-ops/session-search 零 npm 依赖；devkit 零 peer） |

### 面 6：defineTool peer（dsh-tools）
官方：runtime dsh-tools@0.2.0-rc.2 lib/index.js:838 `defineTool(options)`——形状 `{name, description, parameters, output:{schema, render}, execute, deferLoading?, timeoutMs?}`（:838-870），timeoutMs 校验 ：847；参数 schema 经 parameterSchemaSpecToJsonSchema 归一。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| message-ops | ✅ | createMessageOpsTool 形状兼容（name/description/parameters/output.render/execute）；peerDeps 已放宽 `'^0.1.0-rc.6 \|\| ^0.2.0-rc.1'`（commit 4c1db97）；动态 import 容错注册（tools 缺失只跳过工具） |
| 其余五包 | — | 不注册 agent 工具 |

### 面 7：/api 信任围栏语义
官方：围栏 = 浏览器 Host 围栏 + 同站校验，**只覆盖 connection RPC 的 /api 面**（dsh-src api-request-trust.ts:1-10 "…this fence is not an auth layer"；rpc-host.ts:82/103 调用点；core-pr 同文件 :10-16 同语义）。**插件经 webServer.register 挂的路由不经过围栏**——两代一致，是插件必须自带围栏的结构性原因。

| 包 | 判定 | 证据/行为 |
|---|---|---|
| message-ops | ✅ | ops-core.js:246-257 三层围栏（回环 Host + sec-fetch-site + Origin）+ 写操作 Content-Type 门（:266-271），六路由全覆盖（R1 P0 已修，fence.test.js 覆盖） |
| session-search | ✅ | fence.js 围栏先于业务（indexer.test "路由级：…非回环 Host 全部 403"） |
| lazy-view | ✅ | index.js:41-56 同款三层围栏（首个实现者） |
| websearch | ✅ | history.js:103-118 围栏两路由（v2.7.1 起） |
| devkit | ⚠ | /api/devkit/* 只读无围栏（危害=信息面：版本/pid/平台）；**依赖的 /__chameleon/session/delete 端点（session-delete 包）仍无围栏**——R2 遗留 L4 未动 |
| suite | ✅ | 壳仅 loopback-only degraded 路由（shell.js makeDegradedRoute 带 403 回环校验） |

**矩阵格数：42（✅ 30 · ⚠ 4 · ❌ 0 · 不适用 8）。零硬断层；4 个 ⚠ 见下节与遗留。**

## 2. 官方近期提交的破坏性预告扫描

方法：~/dsh-src 与 ~/dsh-core-pr 均为浅克隆（各 1-2 commit），已 `git fetch --depth=80 origin master` 补至 40+ 提交（core-pr 至 2026-09-24 前后）；另核 npm dist-tags：`alpha 0.1.7-alpha.2 / latest 0.2.0-rc.2 / next 0.2.0-rc.2`。

- **无 v5 格式预告**：近 40 提交 grep 无 session format v5 迹象；`SESSION_FORMAT_VERSION` 稳定在 4（core-pr types.ts:89 = runtime =4）。v4 是最近一次格式跃迁（用户实测 155 个 v4 会话），六包中 session-search/message-ops 已兼容，**lazy-view 未跟（本轮唯一新发现的行动项）**。
- **surface 拼写无 rename 预告**：release 线稳定 startSeq/endSeq；线 C 的 start/end 是存档快照形态（见顶部更正），不构成前向破坏。
- **插件相关但非破坏的官方动向**（core-pr 近期提交）：
  - `0a6de626` refactor(boot): derive skipped bundles only from Profile.skippedBundles + `fb018e3e` fix(profile-bundle-skip-once)——bundle 跳过语义收敛到 Profile 单一来源，**对 suite（多 bundle 聚合）是利好**（跳过报告更准），无 API 变化；
  - `cad6fef2` feat(web): disable shipped schedule and time context plugins——官方自带插件默认关停，与六包无关但说明"出厂 disabled 行"模式成为官方惯例（印证 suite 的 inactive 行设计）；
  - `c8631b20` trim-tool-constraint-descriptions——工具描述裁剪，message-ops 的 message_ops 工具描述较长，留意未来 token 压力，非破坏。
- **runtime 领先 npm 声明**：六包 peer 多声明 `^0.1.5-rc.1` 一代，而 live runtime 已是 0.2.0-rc.2（dsh-tools/dsh-host-webserver/dsh-web 均 0.2.0-rc.2）。message-ops 已放宽（4c1db97）；其余包虽未静态触雷（动态 import/无 peer），建议下轮统一放宽 peer 区间。

## 3. compat-audit.md 交叉核对（官方已修 / 我们已修 / 未动）

| compat-audit 项 | 状态 | 核对结论 |
|---|---|---|
| 最危险#1 websearch settingsScope 0.1.7 全死（P0） | 插件已修 | client.js:548-561 feature-detect 降级（warn + 不挂卡片）。官方未恢复该服务（runtime 无 settingsScope）→ **设置 UI 仍需 shim**，但不再拖死客户端 fiber |
| 最危险#2 message-ops/session-search legacy 单帧崩（P0） | 插件已修 | message-ops 0.2.3 collectHeaderAndEvents（session-file.js:67-85）；session-search 0.1.2 parseLegacySingleFrame + 真机 1 个 legacy 会话可读。官方无对应修复面（宿主只产 v4） |
| 最危险#3 websearch 0.1.7 服务端 section 静默 no-op（P1） | **未修** | SettingsForms 无 installSection（runtime grep=0）；typeof 守卫仍静默。需按 SettingsForms.describe/cordis-config 路径适配或接受纯 config 配置 |
| 立修4 engines（websearch ≥20.3 / suite / lazy-view ≥23.5） | 部分修 | websearch package.json:70-72 ✅；suite 已加 `>=20`（审计建议 23.5，取宽了，因 zstd 依赖在子包自身 engines 里把关）；lazy-view 仍 `>=24` 过窄未动 |
| 立修5 suite lazy-view ^0.3.0 | 已修 | package.json `^0.3.0`（本轮审计轮） |
| 立修6 lazy-view peerDependencies | **未修** | package.json 无 peerDep 段（面 5 ⚠） |
| 立修7 websearch HOME→homedir | 已修 | index.js:357-363 resolveStoreDir 用 os.homedir()（注释引用 compat-audit P2-7） |
| 立修8 .gitattributes / inline mock | 半修 | suite mock 已内联进 test/fixtures（file: URL 导入，干净检出 6/6 绿）；.gitattributes 六仓仍未加（卫生项） |
| 立修9 README 双注册语义写实 | 未核 | 留给 docs 轮 |

## 4. 本轮行动项（按优先级）

1. **lazy-view 加 session.v4.jsonl.zstd 探测**（对齐 session-search 0.1.2 的 v4 优先/回落链）——v4 已是现役格式，lazy-view 用户看不到 155 个新会话（P1）。
2. **lazy-view 补 peerDependencies + engines 放宽 ≥23.5**（P2，立修6/4 残留）。
3. **websearch 0.2.0-rc.2 设置面适配决策**（P1）：接受"无 shim 无 UI"并 README 写明，或迁 SettingsForms 时代形态。
4. **六包 peer 区间统一放宽到 `^0.2.0-rc.1`**（P2，对齐 live runtime）。
5. devkit 依赖的 /__chameleon/session/delete 围栏（R2 L4，跨包立项）。

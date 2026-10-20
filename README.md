# @240xu/dsh-suite

@240xu 生态一键聚合包（v0.2.0）：一条命令安装全家，逐行开关即回滚。
架构依据专家组会签方案 `dsh-plugin-hub/docs/aggregation-weball.md`
（对 @linxin666/dsh-web-all 的逆向拆解）。

## 安装

```sh
dsh plugin --profile web add @240xu/dsh-suite@latest
dsh web
```

安装即引入四个子包（dependencies caret 区间）并挂载四条 family 行 + 一条裸锚行 +
一条 web 接线行：

| 行 id | 子路径 / 入口 | 真实插件 |
|---|---|---|
| x240-suite | `@240xu/dsh-suite`（裸锚，唯一 client graph entry） | 无（浏览器半由 `exports["./client"]` 折叠） |
| x240-websearch | @240xu/dsh-suite/websearch | @240xu/dsh-websearch ^2.8.3 |
| x240-message-ops | @240xu/dsh-suite/message-ops | @240xu/dsh-message-ops ^0.11.0 |
| x240-session-lazy-view | @240xu/dsh-suite/session-lazy-view | @240xu/dsh-session-lazy-view ^0.3.5 |
| x240-session-search | @240xu/dsh-suite/session-search | @240xu/dsh-session-search ^0.1.10 |

`x240-suite` 只承载 client graph entry 与观测路由；禁用它会关闭浏览器 UI
（四条 host 行仍继续工作）。只想关某个 UI 时，disable 对应的 family 行即可。

## 已知强耦合（web 接线行）

`web` 行无条件把 `searchProvider` 置为 `unified`（websearch 的 PROVIDER_ID）。
若 `x240-websearch` 行被 disable/import 降级，dsh-web 每次搜索会硬抛
`WEB_PROVIDER_CONFIGURED_MISSING`（连坐打死本可回退 deepseek-official 的 web
搜索）。禁用 websearch 行时请同步删掉 `web` 行的 `searchProvider` 覆盖。

## 故障隔离（shell 壳）

官方 loader 把一个 bundle 的全部 patch 行当一个事务组挂载：裸挂时任一插件
import/start 失败会回滚整组并 abort `dsh web`。因此每行 `name` 指向本包的
shell 子路径（`src/shell.js`，永不失败），真实包名放在 `config.plugin`，由壳
动态 import——**失败收窄到单行**：记录降级（loopback-only
`GET /api/dsh-suite/degraded` 可查），其余行照常挂载。

## 浏览器半（单 graph entry + rows gating）

DSH 的 client graph 只认 **Loader 行的包名**。子路径行
`@240xu/dsh-suite/message-ops` 不会被扫成 graph entry，子包的 `dsh.client`
因此永远不会加载。所以增补裸锚行 `x240-suite`（`name: @240xu/dsh-suite`），
由 `exports["./client"]` 指向生成的 `client/index.js`，作为**唯一** suite graph
entry；message-ops / websearch 的 client 源码在构建时折叠进一个 factory，
不再单独注册内部 id（避免 HMR 重载 suite 时 id 重复注册）。

浏览器半启动时：

1. `GET api/dsh-suite/rows`（相对路径，无前导 `/`，1500ms 超时）。
2. 只对宿主报告 active 的 family 包调用 `ctx.plugin`；每项保留自己的
   `inject`（如 message-ops 的 `slots`），故障逐项 try/catch，不连坐。
3. 如果 `__DSH_BOOT__.entries` 里已有某个子包的 standalone graph entry，
   跳过折叠副本，交给 standalone 挂载（web-all 同款语义）。
4. rows 请求失败/超时/不确定时 fail-open 全挂载；已挂载集合用
   `Symbol.for("dsh-suite.mounted-client-plugins")` 跨 bundle 去重。

`client/index.js` 是生成物，别手改；改子包或 runtime 后运行
`pnpm run build:client`，`pnpm run check:client` 失败即产物过期。

残余风险：折叠子包的 CSS 归属 suite graph entry。suite 自身 HMR invalidate
不会清掉子样式，可能重复注入 `<style>`；功能不受影响，刷新页面可清干净。

## 逐行 disable（回滚主路径）

设置 → 插件 → 插件管理，或 profile 用户层 `cordis.patch.yml`：

```yaml
- id: x240-session-search
  disabled: true
```

被禁行不加载；其余行不受影响。无需卸载整包。

## 回滚 / 退出聚合

```sh
dsh plugin --profile web remove @240xu/dsh-suite
```

行 id 带 `x240-` 前缀，与各子包 standalone 安装的 id（`dsh-websearch` 等）不
冲突，可与 standalone 共存。两者都在时，**浏览器半**由 standalone 优先：
suite 检测到同名 graph entry 后跳过折叠副本，UI 只出现一份（已实测：一个
header 按钮、一个 panel）。**宿主半**的四条 shell 行仍会挂载，因此若子包
自身不是幂等注册（例如 message-ops 的 `message_ops` 工具），日志可能出现一行
`already registered` 警告；工具只保留一份，功能不受影响。需要完全无警告时
不要同时安装 standalone。

只想要个别插件：直接 `dsh plugin add @240xu/dsh-websearch`，不经 suite。

## 与 web-all 模式的差异

1. suite 只注册 **一个** client graph entry（裸锚行），子包 client 源码折叠进
   该 factory；不像 web-all 那样注册多个内部 id。activeRows / `/rows` case
   gating 保留，且 standalone 同名 graph entry 会让折叠副本让位。
2. caret 区间聚合（非家族 lockstep）：各子包独立发版独立更新，suite 只做下限约束。
3. 保留 web-all 的：globalThis 单例壳状态、RETIRED_PLUGINS 静默化机制位、
   loopback-only degraded 观测路由、嵌套 inject(["webServer"]) 时序处理。

## 验证状态

- 壳隔离语义：`npm test`（node --test）24 项全过——good 挂载 / import 失败降级 /
  shape 降级 / start 抛错降级且兄弟行照常 / 空行静默 / 健康路由迟到注册 /
  activeRows 账本 / rows 路由 / degraded 围栏 / 单 graph entry / capture /
  rows gating / fail-open / standalone skip / 单子失败隔离 / 二次挂载去重 /
  bundle 新鲜度 / dispose 释放挂载 claim。fixtures 在 `test/fixtures/`。
- **真实 E2E 已验**（2026-10-20，一次性 `suitefix-e2e` profile）：link 安装、
  root HTML 只有一个 `@240xu/dsh-suite` client entry、组合 bundle 200、Message
  ops 561×900 panel（fixture `session-ab6feff2-…`）、Web Search 设置页可用；
  逐行 disable 后 rows 排除该行且 UI 不挂载；故障注入后 degraded 只列坏行、
  其余 UI 存活；standalone message-ops 共存时 UI 单份。

## 端到端验证步骤（发布前必做）

1. `cd ~/dsh-plugins-src/dsh-suite && rm -rf node_modules`（清掉 PoC fixtures，
   换真实依赖：把四个子包目录 ln -s 进 node_modules/@240xu/，或 pnpm link）。
2. `dsh plugin --profile web add link:$(pwd)`（测试 profile 更稳：
   `--profile suitetest`）。
3. `dsh --profile suitetest --dump-config`：确认裸锚 `x240-suite` + 四条
   `x240-*` family 行 + web 行存在、family name 为 shell 子路径、
   config.plugin 为真实包名，且 suite 只有一个 client graph entry。
4. `dsh --profile suitetest --port 3999`：五插件功能可用；
   `curl -s http://127.0.0.1:<port>/api/dsh-suite/degraded` 应返回
   `{"ok":true,"degraded":[]}`，`/api/dsh-suite/rows` 应列出四行对应的真实包。
5. 故障注入验证隔离：临时改坏一个子包导出（或 patch 行 config.plugin 指向不存在
   的包名），重启 → `dsh web` 应正常启动，仅 degraded 列出该行，其余四行可用。
6. 验证 standalone 共存：同 profile 再 `dsh plugin add link:../dsh-message-ops`，
   确认 graph entry 同时存在、suite 的 folded 副本让位、页面只有一个
   Message ops 按钮/panel；宿主 `message_ops` 工具可能有一行 already registered
   警告（只保留一份）。
7. 全部通过后删除一次性 profile、发 npm（先子包后 suite）。

## 端到端验证结果（2026-09-28，suitetest profile 实测）

| 步骤 | 结果 |
|---|---|
| 1. link 五个真实子包 | ✅（lazy-view 源码在 slv-check 目录，symlink 指向该处） |
| 2. `dsh plugin add link:` | ✅ suite 注册为 bundle |
| 3. dump-config | ✅ 四条 x240-* 行、name=shell 子路径、config.plugin=真实包名 |
| 4. `dsh --profile=suitetest --port 3999` | ✅ http=401、degraded 空、五端点全响应（400/200/200/401/200 均为预期值） |
| 5. 故障注入（session-search index.js 抛错） | ✅ **隔离生效**：服务正常启动（401），degraded 仅列 `@240xu/dsh-session-search [import]`，其余四行端点全部存活 |
| 6. standalone 共存（suite 内 devkit + standalone dsh-devkit 同 profile） | ✅ 启动无重复 id 冲突（bundle patch insert warn-and-skip）、degraded 空、/api/devkit/health 单实例 200、组合树出现 4 处 dsh-devkit 引用（suite 行+standalone 行+元数据） |

### 实测发现的运维事实（发布前须知）
1. **slv-check 裸克隆需要 node_modules shim**：`@deepseek-ai/schemastery` 指向 profile 安装（`ln -sfn <profile>/node_modules/@deepseek-ai/schemastery slv-check/node_modules/@deepseek-ai/schemastery`）。npm 发布版无此问题（真实安装由 pnpm hoisted 提供）。
2. **CLI 语法**：`dsh --profile=<name> --port <p> --no-open`（`--profile <name> web` 的 `web` 会被当多余 app 参数拒绝；`dsh <name> web` 同样）。
3. **profile 依赖两个内建 bundle**：`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`（缺后者则无 HTTP 面）。
4. 壳隔离在第 5 步经受住了真实故障注入——这正是专家组会签方案的核心验收。

## 端到端验证结果 R2（2026-09-30，真实 pnpm 依赖布局）

前置修正：上轮验证用的是手工 symlink；本轮改为**真实 pnpm 安装**（suite dependencies caret 刷新到
当前版本，node_modules/.pnpm 布局）。结果：
1. suite 自身 `pnpm install` 拉齐四子包（devkit 0.1.x 时代已出列）✅
2. profile `pnpm install` 级联（link: suite 保持自带 node_modules，shell 动态 import 从 suite 目录解析）✅
3. `dsh --profile=suitetest --port 3999` 启动 → degraded 空、五端点全响应 ✅
4. **故障注入（对 .pnpm 真实副本写 throw）** → degraded 精确列出该行，其余四行存活 ✅（隔离在 npm 布局下复验）
5. 逐行 disable 语义由 shell 兜底（上轮已验）

### 运维注意
- suite 以 link: 方式安装时，其 dependencies 由 suite 目录内 pnpm install 提供（profile 的
  install 不穿越 link 边界）——部署脚本必须先在 suite 目录跑 install。
- 上游 fix 后恢复：对 .pnpm 副本 `git checkout`/重装即可，无需重装整个 profile。

## 端到端验证结果 R3（2026-10-20，单 graph entry + rows gating）

一次性 profile `suitefix-e2e`（从默认 web 派生，测完删除），link 安装 suite：

1. `--dump-config`：`x240-suite` 裸锚 + 四条 family + web 行齐全；suite 只有
   `@240xu/dsh-suite` 一个 client graph entry，message-ops/websearch 无独立 entry。
2. root HTML 的 graph entry `url` 指向组合 bundle；抓取 200，内含两个子 client
   源码与 rows 路径。
3. fixture `session-ab6feff2-…`：Message ops header 按钮出现，panel 561×900，
   title/session id 正确；`window.__dshWebsearchSettingsReady === true`，设置页
   “Web Search” 完整渲染（`/api/unified-search/settings` 503
   `namespace-not-found` 是宿主只读/settings namespace 状态，不影响 UI 挂载）。
4. disable `x240-message-ops`：`/api/dsh-suite/rows` 不再列出该包，页面无
   Message ops 按钮，websearch 仍挂载。
5. 故障注入（`config.plugin` 指向不存在的包）：`dsh web` 正常启动，
   `/degraded` 只列该行，其他 UI 存活，无 pageerror。
6. standalone `@240xu/dsh-message-ops` 共存：graph entries 同时有 suite 与
   standalone；suite 的 `mounted` 只剩 websearch，standalone 提供 Message ops；
   页面 **1 个** header 按钮、**1 个** panel。宿主日志有
   `tool "message_ops" is already registered` 警告（工具保留一份），属已知共存
   噪音。

## 0.1.4 · Bug 猎场修复

- **[P2] cordis.patch.yml 空 `- insert:` 死行**（devkit 删除残留）——loader 每次启动
  warn-and-skip。已删；头注释改「四条 family 行 + 一条 web 接线行」。
- **[P2] 依赖 caret 天花板**：message-ops ^0.2.x 永远装不到 0.3–0.5 特性 → 四个
  caret 全部对齐当前最新（websearch ^2.8.2 / message-ops ^0.5.2 / lazy-view ^0.3.4 /
  session-search ^0.1.5）；pnpm-lock 刷新（frozen-lockfile 可用），devkit 彻底出列。
- **[P2] degraded 路由缺 Host 围栏**：仅查 remoteAddress，DNS-rebinding 可读降级
  清单（含 error.stack 绝对路径）→ 补 Host 白名单（localhost/127.0.0.1/[::1]）。
- **[P2] recordDegraded 自护栏**：stack getter/toString 抛出会逃出 applyShell 触发
  整 bundle 事务回滚（恰是壳要防的）；start 回调包 try/catch 防 unhandledRejection
  杀进程；`JSON.stringify(config)` → safeStringify。
- **[P2] README 依赖表 4/4 过期 + 「五条/五子包」口径** → 全部同步；新增「已知
  强耦合」章节（websearch 行降级连坐 dsh-web 搜索的处置方法）。

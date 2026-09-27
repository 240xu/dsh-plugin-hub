# @linxin666/dsh-web-all 聚合插件架构拆解报告

> 研究目的：为把 @240xu 生态改造成「大插件聚合 + 子插件独立 npm 更新 + 市场接入」模式提供依据。
> 证据基线：本机安装副本 `~/.dsh/profiles/web/node_modules/@linxin666/dsh-web-all@0.3.20`（npm 最新为 0.4.3，2026-09-26），官方源码 `~/dsh-src`，npm registry 查询。行号引用均指对应文件。

---

## 1. package 结构：meta 包 + 独立子包依赖聚合（非单包多入口）

**结论：web-all 是一个「元包（meta package）」**——自身只携带一个故障隔离壳（shell）+ 一份聚合 patch，所有真实功能都是独立 npm 子包，通过 `dependencies` 拉进 profile 的 node_modules。

证据：

- `dsh-web-all/package.json` 的 dependencies 全部是家族子包，且**精确锁版到与主包同一版本号**（0.3.20 副本全部 `0.3.20`；npm 最新 0.4.3 中除 3 个 `^0.4.3` 外也基本精确锁 `0.4.3`）：
  - `@linxin666/dsh-client-ui-plugin-manager`、`dsh-client-ui-market`、`dsh-client-ui-task-board`、`dsh-pet`、`dsh-ssh`、`dsh-i18n`、`dsh-session-archive`… 共 19 个家族包 + 1 个外部包 `dsh-better-sidebar@0.19.0-alpha.1`。
- 主包自身 exports 里有一组「每家族一个子路径」：`"./task-board": "./lib/shells/shell.js"`、`"./market": "./lib/shells/shell.js"` 等（package.json exports 段）。**所有子路径都解析到同一个 shell 重导出文件** `lib/shells/shell.js`（内容仅 3 行：`import { apply, inject } from "../shell-BlyfMdCj.js"; export { apply, inject };`）——这不是真实插件，而是隔离壳。
- 真实插件的 browser half 仍由各子包自己的 `dsh.client` 声明提供（如 `dsh-client-ui-market/package.json`：`dsh.client.inject: ["@deepseek-ai/dsh-client-connection", "...ui-renderer", "...ui-settings"]`，`exports."./client": "./lib/client.js"`）。

即：**单包多入口只是「显示/挂载层」的技巧；代码与版本单元仍是独立 npm 包。**

## 2. 「子插件独立 npm 更新」靠什么实现

三层机制：

1. **依赖聚合（安装期）**：主包 dependencies 拉入子包。版本策略是**家族 lockstep（列车制）**——主包发版时把全部子包一起 bump 到同一版本号精确锁版（0.3.3→0.4.3 共 24 个版本，见 `npm view @linxin666/dsh-web-all` 的 time 表，约 2-4 天一版）。所以严格说子包**可以**独立安装/独立更新（README 明示："install the standalone package when a plugin needs independent versioning (a standalone install wins over the aggregate row)"——README.md "Known limitations" 段），但聚合内部是整体列车。
2. **dsh.profile.bundles 展开期**：官方 profile 机制按 `dsh.profile.bundles` 顺序读取每个 bundle 的 `dsh.bundle.patch` 指向的 YAML，叠加出 entry 列表。见 `~/dsh-src/packages/boot/app-boot/src/profile.ts:371-398`（loadProfile：`bundles.map(...)` 逐个读 `bundleManifest.dsh?.bundle?.patch`）及同文件 ：11-13 注释（"composed by applying each bundle's patch list in dsh.profile.bundles order over an empty entry list"）。web-all 只占 bundles 里**一个**条目，其 patch 内聚合了全部行。
3. **运行时不拉取**：没有任何运行时 npm 拉取/热更新。更新 = 改 profile package.json 版本 + pnpm install + 重启 `dsh web`（README "Manual upgrade" 段还专门写了 pnpm 硬链接不刷新的坑）。

**版本漂移防护**：README 声明对 `@deepseek-ai/*` SDK 依赖是 pinned（devDependencies 全部 `^0.1.5-rc.1`），家族按 DSH cohort 对齐发布；外部包 `dsh-better-sidebar` 因 0.1.2-alpha.2 cohort 移除了 `@deepseek-ai/dsh-client-runtime` 面曾整体踢出聚合，后以钉死 0.19.0-alpha.1 回归（README 首段 Note）；`@mlgbnb/dsh-archive-manager` 至今被排除，因为其上游构建 import 已移除面会**直接让 `dsh web` 启动失败**——这正是聚合包对第三方生态的处理范式：宁可整体不收，不做运行时降级。

## 3. cordis.patch.yml 的 insert 模式

- **单文件多行 insert**：web-all 只有一个 `cordis.patch.yml`（由仓库内 `aggregate.yml` manifest 经 `scripts/aggregate.mjs` 自动生成，文件头注释 "AUTO-GENERATED … edit aggregate.yml and rerun"）。文件里 20+ 条 `- insert:` 块，每块一条 id。
- **insert 语义**（官方实现 `@deepseek-ai/cordis-plugin-include/lib/index.js:62-90`，applyEntryPatches）：
  - 无 id 的 insert = push 到根 entry 列表；带 id 的 insert = push 到该 group 的 config 数组。
  - **插入的行立即进索引**（"Inserted entries are indexed as they are added"），同一列表内后面的 patch 可以引用前面插入的行。
  - patch 匹配不到目标只 **warn 并跳过**，不致命；非 insert patch 缺 id 或 name 不匹配同样 warn+skip。
- **id 冲突规避——命名空间化**：家族插件 standalone patch 的 id 是 `ui-task-board`（`dsh-client-ui-task-board/cordis.patch.yml`），聚合里改名为 `web-ui-task-board`、name 指向 `@linxin666/dsh-web-all/task-board`（cordis.patch.yml 各行）。README "Known limitations" 明说：namespaced 后聚合与 standalone 可**共存**（loader 不再拒重复 id，host half 第二源是 no-op，browser half 按 package name 去重）。同 id 的 name 不匹配会被 patch 层拒绝（include index.js:100-102 "name mismatch … skipping"）。
- **顺序/开关**：shell 行 `inject: []`（必须最先激活，`lib/index.js` 注释 "it must activate before anything else"）；低频行在 patch 尾部以 `disabled: true` 出厂关闭（web-ui-ssh / describe-image / liangshen / skill-explorer / doctor），用户在插件管理器开启时写入用户层 override（用户 patch 层 `cordis.patch.yml` 在 bundle 层之后应用，profile.ts:395-398）。

## 4. dshmarket 集成契约

市场是**双端结构**：远程静态清单 + 本地安装网关。

- **发现：远程静态 JSON manifest，不是 npm keywords 也不是 registry API**。browser half 拉取（`dsh-client-ui-market/lib/client.js:1184-1188`）：
  - `https://dsh-market.com/manifest/skins.json` / `pets.json` / `plugins.json` / `presets.json` + `/api/stats` + `/api/npm-downloads`。
  - 实测 `manifest/plugins.json` 条目契约：`{ id, name, rank, nameEn, author, description, descriptionEn, repo, npm?, category, subcategory }`（`generated: "2026-09-26"` 顶部字段说明是生成物）。**上架 = 往这个仓库式清单提条目；`npm` 字段可选**，有则显示下载量并走插件安装，无则只能复制 repo 安装命令。
- **安装按钮，两条通路**：
  1. **插件类**：桥接可选的 `pluginManager` 服务 face（client.js:772-811 `bridgePluginManager`：`ctx.inject(["pluginManager"], ...)`；不在时降级为复制命令 `dsh plugin --profile web add <npm|repo|id>`，client.js:824-826）。接受规格白名单 `NPM_SPEC`（client.js:819-821：npm 名或 `pkg@version`，拒绝 `^` 区间、ssh://、file:// 等，client.js:832 注释）——最终由 **plugin-manager 包 host half spawn 官方 CLI** `dsh plugin add|remove`（`dsh-client-ui-plugin-manager/lib/index.js:721-731` 注释："installs and removals executed by spawning the official `dsh plugin --profile <name> add|remove` CLI — the single writer"；:737 有 shell 元字符过滤）。
  2. **资产类（皮肤/宠物/预设）**：走本地回环网关 POST `/api/market/install-skin|pet|preset {id, force}`、列表 `/api/market/installed`（market host half `lib/index.js:417-427` 注释 + :443/:491 loopback-only 校验；browser half client.js:1244-1262）。
  - 远端另有 `/api/like`、`/api/telemetry/event`、`/api/turnstile/challenge`（Cloudflare Turnstile 挑战，client.js:12-13）。
- **web-all 与市场的关系**：market 本身就是聚合里的一个家族行（`web-ui-market`）；聚合不提供市场 API，只是把市场 UI 一起带装。

## 5. 故障隔离（本架构最核心的工程设计）

官方 loader 把一个 bundle 的全部 patch 行作为**一个事务组**挂载——README："a single plugin that fails to import or start would roll back the whole group and abort `dsh web`"。聚合 20 个插件共享一个 bundle 就意味着一个坏插件拖死全家。web-all 的解法：

- **Shell 隔离壳**（`lib/index.js:166-221`，apply$1）：
  - 每行 name 指向 `@linxin666/dsh-web-all/<family>`（= 永不抛错的壳），真实包名放在 `config.plugin`。
  - 壳内 `await import(spec)` 失败 → `recordDegraded(spec, "import")` 后 **return**（不 rethrow）——该插件单独降级，其余行照常挂载（index.js:201-206）。
  - `ctx.plugin(plugin, config)` 启动异常 / Promise reject 同样捕获降级（index.js:210-218）。
  - 模块无合法 plugin shape 也降级（index.js:207-209）。
- **退役插件静默化**：`RETIRED_PLUGINS = new Set(["@linxin666/dsh-perf", "@linxin666/dsh-desktop-launcher"])`（index.js:161-162）——老用户 profile 里的残留行挂成 no-op，升级不炸启动。
- **可观测性**：loopback-only `GET /api/dsh-web-all/degraded`（index.js:52-76，回环校验 ：55-62）列出降级插件；`GET /api/dsh-web-all/rows`（:88-105）向 browser half 报告活跃行，让被禁用/未挂载行的设置页签也消失（修 #1372）。健康路由注册走嵌套 `ctx.inject(["webServer"], …)` fiber（:117-141），解决 shell 比宿主 webServer 先激活的时序问题。
- **跨模块实例共享**：shell 状态用 `Symbol.for("dsh-web-all.shell-state")` 挂 globalThis（index.js:4-12），规避 bundler chunk 分裂导致两份 state。
- **局限**：隔离只覆盖 import/start 两阶段；插件挂载后的**运行时**抛错仍走 cordis 自身的 fiber 错误语义；browser half 的失败不受此壳保护（client.js 各自 try/catch，market client 大量 `catch { return () => {} }`）。

## 6. 生产级健壮性评估（短板清单）

| 短板 | 证据 | 影响 |
|---|---|---|
| patch 是**构建期生成物**，aggregate.yml 不随 npm 发布 | cordis.patch.yml 头注释；npm 包 files 仅 `lib, cordis.patch.yml` | 不能手改 patch；生成脚本链断裂即发错版 |
| 家族 lockstep：任一子包 bug 即锁死全列车版本 | 0.3.x 每版全家族同步 bump；README 手动升级章节 | 一个子插件回滚要整包重发 |
| cohort 对齐是**人工纪律**，无 engines 之外的硬校验 | README Note：better-sidebar/archive-manager 因 removed face 被踢出/钉版 | DSH 升级窗口期聚合包功能收缩（archive-manager 至今缺席） |
| 隔离壳覆盖 import/start，不覆盖运行时与 browser half | index.js apply$1 范围；client.js 各自防御 | 运行时崩溃仍可能影响 cordis fiber 树 |
| shell 隔离依赖 name→subpath→shell.js 的间接层 | exports 全部子路径映射到同一 shell.js | 心智负担高；调试栈经一层转发 |
| 双源共存语义复杂（standalone 优先于聚合行） | README Known limitations 第二条 | 排障时要判断行来自哪个源、id 用 web-ui-* 还是 ui-* |
| 市场清单是中心化人工维护的静态 JSON | plugins.json `generated` 字段 | 上架/更新有审批延迟；无自动同步 npm 元数据 |

**总体评价**：这套架构的成熟度显著高于「一个包塞全部」——它用官方一等机制（`dsh.bundle.patch` 多 bundle 叠加 + patch insert，官方源码 profile.ts:371-398、include index.js:62-90）实现聚合，自研的只有 shell 隔离壳和健康路由；缺点集中在发布流程（lockstep、cohort 人工对齐）而非运行时。

## 7. @240xu 生态改造建议

候选：websearch、message-ops、session-lazy-view、devkit、（未来）session-search。

### 方案对比

| | A. meta 包 `@240xu/dsh-suite` 依赖聚合（web-all 同款） | B. 单包多模块（monolith） | C. 保持独立 + 市场清单聚合 |
|---|---|---|---|
| 子插件独立更新 | ✅ 结构天然支持（standalone 优先于聚合行） | ❌ 必须整包发版 | ✅ |
| 一键安装 | ✅ 一条 `dsh plugin add @240xu/dsh-suite` | ✅ | ❌ 用户要装 N 次（除非市场做批量，无此契约） |
| 故障隔离 | ✅ 移植 shell 即可 | ✅ 单包内 try/catch 同样可行 | ✅ 各自独立 |
| 版本管理成本 | ⚠️ lockstep 列车（可学 web-all：发版脚本统一 bump） | ✅ 最低 | ❌ N 个包各自发布 |
| 市场可见度 | ✅ suite 本身可上架，行内家族也可各上架 | ✅ | ✅ 需维护清单条目 |
| patch 生成 | 需自写 aggregate→patch 生成脚本（或手维护） | 单文件 patch | 无 |
| 迁移成本 | 中 | 低-中 | 最低 |

### 推荐：**方案 A（meta 包依赖聚合），但起步放宽为「列车 + 区间」混合锁版**

理由：
1. @240xu 插件数量会继续增长（session-search 在路上），一键安装与统一禁用/启用矩阵是聚合最直接的用户价值；C 方案解决不了这个。
2. B 方案把 browser half 全塞一个包后，client bundle 体积与耦合随插件数线性恶化，且任一 UI 插件改动都要全量重发——web-all 明确走了反方向（把 compat 层并入主包、功能全部留在子包）。
3. web-all 已验证官方机制完全支撑 A（多 bundle patch 叠加、namespaced insert、用户层 override），无需等官方新增"插件套件"支持。
4. 在 A 内部：内部自研子包用精确锁版列车（发版脚本统一 bump，简单可预测）；仅对确需独立节奏的包（如实验性的 session-search）用 `^` 区间（web-all 0.4.3 对 skin-center/preset-center/community-plugins 已这么干）。

### 最小可行架构（MVA）

```
@240xu/dsh-suite (meta)
├── deps: @240xu/dsh-websearch, dsh-message-ops, dsh-session-lazy-view, dsh-devkit
├── cordis.patch.yml            # 手维护或脚本生成；每行:
│     - id: x240-websearch      #   命名空间 x240-*，避免与 standalone ui-* 冲突
│       name: '@240xu/dsh-suite/websearch'
│       config: { plugin: '@240xu/dsh-websearch' }
│     - id: x240-devkit
│       disabled: true          # 低频行出厂关闭
├── exports: "./websearch" → "./lib/shell.js"  # 所有子路径同一个隔离壳
└── lib/shell.js                # 从 web-all 移植: import 失败/启动失败→recordDegraded,
                                # /api/x240-suite/degraded(loopback) + /rows
```

### 迁移步骤

1. 建 monorepo（pnpm workspace），现有 4 插件迁入 `packages/`，保持各自 package.json/exports/patch 不变（standalone 继续可发）。
2. 新增 `packages/suite`：复制 web-all 的 shell（index.js 55516 行的 client.js 不需要，那是 compat 层；只要 shell.js/shells/degraded 三件套，约 250 行）。
3. 写 `scripts/aggregate.mjs` 简化版：从 packages/*/cordis.patch.yml 读 insert 行 → 改写 id 加 `x240-` 前缀、name 改指 suite 子路径、追加 config.plugin → 生成 suite 的 cordis.patch.yml。
4. 发版脚本：`pnpm -r exec npm version <v>` 全家族统一 bump → publish 顺序 = 先子包后 suite（suite 的 deps 引用子包版本）。
5. 市场上架：向 dsh-market.com 清单提 suite 条目（`npm: @240xu/dsh-suite`），可选同时给每个子包条目。
6. 用户侧灰度：先在测试 profile `dsh plugin add link:` 验证，再 npm 发布。

### 回滚

- 用户层：卸载 suite（`dsh plugin --profile web remove @240xu/dsh-suite`）即可，standalone 包不受影响（ids 命名空间隔离）；或保留 suite 只在插件管理器关闭对应行（用户层 `disabled: true` override，profile.ts:395-398 用户 patch 层语义）。
- 发布层：suite 撤版/降版不影响已独立发布的子包；patch 层坏行因 "warn and skip" 语义（include index.js:73/87/100）不会阻塞其他 bundle 启动——但**不要**在 suite patch 里引用家族外不存在的 group id。
- 最坏情况（shell 自身 bug 炸启动）：DSH 的 loader 事务组会拒绝该 bundle，其余 bundle 照常；回退到上一版 suite 版本号即可。

---

### 附：关键引用索引

- `@linxin666/dsh-web-all/package.json`：dependencies 锁版、exports 子路径→shell.js、dsh.bundle.patch 声明
- `@linxin666/dsh-web-all/cordis.patch.yml`：聚合 insert 全文（AUTO-GENERATED 头、web-ui-* 命名空间、disabled 尾段、外部 dsh-better-sidebar 行）
- `@linxin666/dsh-web-all/lib/index.js:4-12`（globalThis 状态）、`:52-105`（degraded/rows 路由）、`:117-141`（inject webServer fiber）、`:161-162`（RETIRED_PLUGINS）、`:166-221`（apply 隔离壳）
- `@linxin666/dsh-client-ui-market/lib/client.js:819-826`（NPM_SPEC/安装命令）、`:1184-1188`（manifest 拉取）、`:1244-1262`（install-* 网关）、`:2200+`（settings.section 注册 + pluginManager 桥）
- `@linxin666/dsh-client-ui-market/lib/index.js:417-427,443,491`（host 半回环安装网关）
- `@linxin666/dsh-client-ui-plugin-manager/lib/index.js:721-737`（spawn 官方 CLI 单写者 + 元字符过滤）
- 官方 `~/dsh-src/packages/boot/app-boot/src/profile.ts:371-398`（loadProfile 多 bundle 叠加）、`:413+`（composeEntries）
- 官方 patch 语义 `@deepseek-ai/cordis-plugin-include/lib/index.js:48-112`（applyEntryPatches：insert 索引递增、warn-and-skip、name 不匹配拒绝）
- npm：`@linxin666/dsh-web-all` 24 版（2026-08-24 → 09-26），latest 0.4.3，deps 精确锁 0.4.3（3 个 `^0.4.3`），0.4.x 已移除 dsh-better-sidebar 依赖
- `https://dsh-market.com/manifest/plugins.json`（实测条目契约）

---

## 附：专家组讨论结论（2026-09-27，四位插件负责人逐一会签）

**共识：采纳「meta 包 @240xu/dsh-suite 依赖聚合」方案**，附两条修订：

1. **版本策略修订（websearch 负责人 + msgops 负责人）**：suite 对成熟子包用 `^` caret 区间（如 `^2.7.0`）而非精确锁版，或以 peerDeps 声明兼容区间——避免锁版列车卡紧急修复（restore 引擎拼写跟随、安全 fix 先发子包再随列车收编）。
2. **幂等注册修订（devkit 负责人）**：`window.__dshDevkit.registerCommand` 对同 id 重复注册改为**幂等去重 + console.warn**（而非 throw），防 suite+standalone 并存双装载撞车；suite 内 devkit 只装一份避免路由冲突。

各子包评估结论：
- **message-ops**：无技术障碍（inject 空、tools 容错、`/api/message-ops/*` 前缀唯一）；apply 全路径 try/静默，纯函数核心不拖死 suite 启动；patch id `x240-` 对齐属一次性迁移。
- **websearch**：设置项都在 unified-search namespace，cache/history 走 `$DSH_HOME/cache/websearch`（suite 壳不触碰，多实例同机共享缓存反而受益）；全部 fail-open，壳隔离等同功能关闭，主路径不受影响。
- **session-lazy-view**：路由全挂 `/lazyview` GET-only、零跨包 import 面，无 archive-manager 式被移除依赖暴露面；仅需保证 package.json files 清单齐全；接受列车节奏。
- **devkit**：低风险（registry 快照渲染 + deferred inject 容忍服务晚到）；子包晚注册的命令下次打开面板可见，属可接受弱耦合。

**遗留决策点**：suite 精确锁版 vs caret 区间——两派意见（agg-researcher 主张精确锁版防漂移，websearch/msgops 主张 caret 保迭代）折中为「**主包 ^ 区间 + CI 冒烟测试守门**」，待 W1 冲刺落地时定稿。

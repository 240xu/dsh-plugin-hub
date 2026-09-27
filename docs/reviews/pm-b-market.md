# 插件评审 · PM B（市场与竞品视角）

> 评审对象：dsh-websearch 2.7.0 / dsh-message-ops 0.2.0 / dsh-session-lazy-view 0.2.0 / dsh-devkit 0.1.0
> 视角：竞品对照、价值主张、发布叙事、市场就绪度、增长钩子、风险。只评估，不改代码。
> 参考面：DSH 官方插件、omdsh-dev/DSH-better-sidebar（28+ 接入插件）、@linxin666/dsh-web-all（聚合模式）、dshmarket 市场契约（见 `docs/aggregation-weball.md` §4：`{ id, name, rank, nameEn, author, description, descriptionEn, repo, npm?, category, subcategory }`）。

---

## 1. 竞品对照

### dsh-websearch v2.7.0
- **生态内**：无直接同类。DSH 官方 `dsh-web` 是单 provider 选择器，不聚合；web-all 家族无搜索插件。multi-provider MCP 搜索网关在更广 MCP 生态有先例（exa/parallel 各自的官方 MCP），但"注册一个 `unified` id、四后端零 key 开箱、熔断+缓存+历史"的组合在 DSH 内是独一份。
- **生态外**：OpenClaw/各类 agent harness 的 web-search 聚合插件功能重叠（fan-out、去重），但没有一个吃透 DSH 的 `ctx.web` 单 provider 语义（避免 `WEB_PROVIDER_AMBIGUOUS`）。
- **结论**：差异化站得住。护城河不在单点功能，而在「零配置可搜 + 部分后端宕机仍可用」的可靠性与 DSH 深度集成。2.7.0 的缓存/熔断/历史是可靠性叙事的续篇，方向正确，但 CHANGELOG 停在 2.4.0（见 §4），市场侧无法感知 2.5–2.7 的演进——这是叙事断档，不是产品问题。

### dsh-message-ops v0.2.0
- **生态内**：**这是四个里竞争最敏感的一个**。DSH 官方已有 Trajectory（消息级查看/回滚面），dsh-src 自带 session-log-export（整段导出）；官方 `dsh-archived-sessions` 覆盖会话级操作。消息级 revert/delete/branch 的"UI 面"与 Trajectory 部分重叠。
- **差异化**：站得住，但要主动讲清楚。(1) 分支（fork 新会话 + parentSession 链接）是官方没有的能力；(2) `message_ops` **agent 工具**让模型自己回滚/导出/分支，官方 Trajectory 是纯人机 UI，这是最大的差异点；(3) restore-replay（可恢复的遮蔽语义 + provenance 校验）把"危险操作"做成了审计链。与 session-log-export 的差异：逐条/到 seq 为止的 Markdown 导出 + 附件。
- **结论**：有替代品但差异化成立。README/发布叙事必须写一句「与 Trajectory 的关系：Trajectory 看历史，message-ops 改写历史并让 agent 自己动手」，否则会被官方用户质疑重复造轮子。

### dsh-session-lazy-view v0.2.0
- **生态内**：官方 Trajectory + archived-sessions 已覆盖"看会话"的主要场景。SLV 的独特卖点是**对超大 zstd 会话文件的 stat-only 列举 + 尾帧解压**——成本与文件大小无关，且对 `~/.dsh/sessions` 零写入。
- **生态外**：无同类（外部工具解压整文件）。
- **结论**：差异化站得住但场景较窄：它是"排查/巡检工具"而非日常会话管理器。README 已自我声明"不是 Trajectory 替代品"，这个定位诚实且正确。风险在于它是"可被官方吸收"的功能：若官方 Trajectory 加一个 tail 视图，SLV 的存在意义即消失。增长策略应主打「10GB 会话秒开」这种官方做不了/不会做的极端场景。

### dsh-devkit v0.1.0
- **生态内**：**竞争最弱、卡位最好**。better-sidebar 是侧边栏家族（28+ 插件），web-all 家族的 UI 插件各做各的入口；没有任何插件做「命令面板 + 贡献点」这一层。devkit 的 `registerCommand` 贡献点本质是在抢「DSH 生态的 VS Code Command Palette」这个生态位——一旦其他插件开始适配 `window.__dshDevkit.registerCommand`，就形成网络效应。
- **生态外**：VS Code / Obsidian 的命令面板是用户已验证的心智，无移植风险。
- **结论**：差异化最强、长期价值最高，但当前是 0.1.0 且命令多为「转发其他插件」（session-delete、message-ops、websearch 的事件），即 devkit 的价值密度依赖生态内其他插件的存在。发布叙事要正面利用这一点："装上 devkit，你已装的插件全部长出 Ctrl+K"。

---

## 2. 一句话价值主张（README 首屏）

| 插件 | 现状首句 | 建议 README 首屏主张 | 达标？ |
|---|---|---|---|
| websearch 2.7.0 | "Aggregated web search provider … fans out to eleven backends"（英文）；中文首句偏架构描述 | **中**：零配置即可用的 DSH 聚合搜索——11 个后端并发兜底，部分宕机照样出结果。**En**: Zero-config aggregated web search for DSH — 11 backends fan out with caching, circuit breakers, and results even when backends go down. | ❌ 现首句讲"是什么"，没讲"装了之后你得到什么"。核心词「零配置」「更抗宕机」未进首句 |
| message-ops 0.2.0 | "消息回滚 + 消息删除 + 消息分支 三合一" | **中**：让会话历史变得可回滚、可分支、可导出——人可以点，模型也可以自己动手（agent 工具）。**En**: Roll back, branch, and export any DSH conversation — from the UI or straight from the agent via a `message_ops` tool. Non-destructive: logs stay append-only. | ❌ 现首句列了三件功能，但最大的差异点（agent 工具、非破坏语义）埋在第 4 节。0.2.0 的主角应是 message_ops 工具 |
| session-lazy-view 0.2.0 | "会话惰性查看器（纯只读）" | **中**：10GB 会话文件也能秒开末尾——只解压最后几帧，绝不写会话目录。**En**: Peek at the tail of any DSH session file in milliseconds — decompresses only the last zstd frames, cost independent of file size, zero writes. | ❌ 「惰性查看器」是术语，不是价值。用户要的是"大文件不卡" |
| devkit 0.1.0 | "把 VS Code 的核心开发者体验移植进 DSH web 端" | **中**：给 DSH web 一个 Ctrl+K 命令面板——一条 `registerCommand`，让你装的每个插件都进面板。**En**: Ctrl+K for DSH web — a command palette and toast layer every plugin can plug into with one `registerCommand` call. Zero sidebar changes. | ⚠️ 现首句达意但面向"开发者"太窄；贡献点（对插件作者）和"一键点亮已装插件"（对用户）应进首句 |

通病：四个首句都是**架构陈述**（"注册 provider""惰性查看器""移植体验"），缺一句用户收益。建议统一改为「动词开头 + 用户可感知结果 + 一句信任状（零依赖/零写入/零侧栏改动）」。

---

## 3. 发布叙事（可直接粘贴的 release notes）

### dsh-websearch v2.7.0
**标题（中）**：v2.7.0：搜索更快也更可靠——磁盘缓存、逐后端熔断、可查历史
**标题（En）**：v2.7.0: Faster & tougher search — disk cache, per-backend circuit breakers, search history
1. 🔁 磁盘结果缓存（TTL 15 分钟、200 条、原子写入）：重复问题不再重复花钱等结果。
2. 🔌 每后端独立熔断（连续 3 次失败 → 60s 冷却，全冷却时 fail-open）：一个后端抽风不再拖慢整体。
3. 🕘 追加式搜索历史（`GET /api/websearch/history`，环形 50 条）：刚才搜过什么，一查便知——也是 devkit 面板联动的基础。

### dsh-message-ops v0.2.0
**标题（中）**：v0.2.0：现在模型自己也会回滚/分支/导出——`message_ops` agent 工具上线
**标题（En）**：v0.2.0: The agent can now roll back, branch & export — new `message_ops` tool
1. 🤖 新 agent 工具 `message_ops`（list/revert/delete/branch/restore/export 六操作），与 HTTP 路由同一套核心，语义完全一致，失败不中断回合。
2. 🌿 分支持续增强：从任意消息 fork 新会话并携带 `parentSession`，原会话一个字节不动。
3. 🔒 非破坏承诺不变：遮蔽走 surface replace + provenance 校验，append-only 日志随时可恢复。

### dsh-session-lazy-view v0.2.0
**标题（中）**：v0.2.0：会话文件再大也不怕——搜索、统计、导出全进面板
**标题（En）**：v0.2.0: Search, stats & export for huge session files, still lazy
1. 🔍 跨会话搜索：不解压整文件即可在最近事件里找关键词。
2. 📊 每项目/每会话统计（大小、mtime、大文件标红）一眼巡检。
3. 📤 导出最近 N 帧为 Markdown，快速分享一段排查现场；依旧 stat-only、零写入。

### dsh-devkit v0.1.0
**标题（中）**：v0.1.0：DSH web 的 Ctrl+K 来了——命令面板 + 贡献点，插件接入只要一行
**标题（En）**：v0.1.0: Ctrl+K arrives in DSH web — a command palette plugins can join in one line
1. ⌨️ VS Code 式命令面板 + 和弦键层（Ctrl+K Ctrl+S 速查表），全 overlay、侧边栏零改动。
2. 🧩 开放贡献点：`window.__dshDevkit.registerCommand({...})` 一行注册，Toast 同样开放；重复 id 抛错保证来源可追溯。
3. 🔗 开箱联动 websearch（打开设置）、message-ops（消息操作/导出）、session-delete（删会话）——装了哪个亮哪个，没装的优雅降级。

写法要点：每条 release 第一行必须是**用户能感知的变化**而非内部术语（"surface replace"这类词放正文不放标题）；四个 release 共用一个 hashtag（如 `#dshPlugins`）便于市场/目录聚合。

---

## 4. 市场就绪度（dshmarket manifest 契约逐项核对）

契约字段：`id, name, rank, nameEn, author, description, descriptionEn, repo, npm?, category, subcategory`（来源：`docs/aggregation-weball.md` §4）。

| 插件 | npm | repo | author | name/nameEn | description/descriptionEn | category/subcategory | 截图等资产 | 就绪度 |
|---|---|---|---|---|---|---|---|---|
| dsh-websearch 2.7.0 | ✅ `@240xu/dsh-websearch` 已发布（README 有 npm badge） | ✅ github.com/240xu/dsh-websearch（package.json repository） | ✅ 240xu | ✅ 中英均有 | ⚠️ description 是 2.7.0 功能清单式长文（package.json description ≈ 500 字），市场卡片放不下，需要 ≤140 字的短 description + En | ✅ plugins / 工具·搜索 | ❌ 无截图；websearch 有设置面板可截 | 🟡 |
| dsh-message-ops 0.2.0 | ✅ `@240xu/dsh-message-ops` | ✅ github.com/240xu/dsh-message-ops | ✅ 240xu | ✅ | ⚠️ description 可用但无 En 版 | ✅ plugins / 会话·消息 | ❌ 无任何截图/GIF；对话框 UI 是核心卖点必须可视化 | 🟡 |
| dsh-session-lazy-view 0.2.0 | ✅ `@240xu/dsh-session-lazy-view` | ✅ github.com/240xu/dsh-session-lazy-view | ✅ 240xu | ✅ | ⚠️ 无 En description；"惰性查看器"术语需换算成人话 | ✅ plugins / 会话·查看 | ❌ 无截图；`/lazyview` 面板本身可截 | 🟡 |
| dsh-devkit 0.1.0 | ❓ README 写"已发布 npm 包后 dsh plugin add"，暗示**尚未发包**；`dsh plugin add` 市场按钮走 NPM_SPEC 白名单（npm 名或 pkg@version），无 npm 则只能复制 repo 安装命令 | ✅ github.com/240xu/dsh-devkit | ✅ 240xu | ✅ | ✅ README 双语质量四者最佳 | ✅ plugins / 开发者·UI | ❌ **docs/screenshot-*.png 三张全是 70 字节占位文件**（已实测），README 却已引用——上架即破图 | 🔴 |

共性问题：
1. **截图全缺**（devkit 最严重，README 引用占位图）。市场卡片与 awesome 精选的第一眼就是图，四插件 0 张真实截图是发布前最大短板。
2. **En description 全缺或过长**。manifest 契约是显式双语字段（description/descriptionEn），不能靠 README 长文顶替。
3. websearch **CHANGELOG 停在 2.4.0**，2.5/2.6/2.7 无任何记录——npm 页与市场"更新日志"视图会显示三个月无更新，与实际 2.7.0 形成叙事断档。
4. devkit 未发包则市场"安装"按钮不可用（NPM_SPEC 拒绝 file://），只能展示复制命令，转化率打折。

---

## 5. 增长钩子

**适合 GIF/短视频（≤15s）的功能**（按传播力排序）：
1. **devkit Ctrl+K 面板**：按下快捷键 → 毛玻璃弹层浮现 → 输入中文过滤 → 回车执行。这是最像"演示给别人看就懂"的钩子，也是四者里唯一有 VS Code 心智借力的。
2. **message-ops 分支**：点分支 → 新会话瞬间生成 → 头部 parentSession 链接点回原会话。"一条历史变两条线"很视觉化。
3. **websearch 熔断演示**：故意拔掉某后端 key → 搜索照常返回（面板显示该后端跳过）。"宕机也出结果"是可靠性卖点里最可演示的。
4. **session-lazy-view 大文件 tail**：对 1GB+ 会话点 tail → 秒出末尾事件（旁边放一个 `du -h` 对照）。数字对比即钩子。

**适合 awesome-dsh-plugin 精选**：websearch（零配置即搜，对新装用户最普适）> devkit（生态基建，标题党"Ctrl+K for DSH"）> message-ops（agent 工具是新叙事）> SLV（垂直场景，作为"会话维护三件套"打包提及更好）。

**跨插件生态故事（可讲、且只有 @240xu 讲得出来）**：
> "装四个插件，DSH web 长出一条完整的开发者工作流：`Ctrl+K`（devkit）里搜命令 → 命令直接开 websearch 设置和历史 → 会话出问题时用 message-ops 回滚或分支 → 拿不准历史细节时 lazy-view 秒开文件末尾。devkit 面板已经内置了对 websearch/message-ops/session-delete 的联动入口——这四个不是四个插件，是一套。"

落点：(a) devkit 的 `/api/devkit/commands` 端点本身就是给"外部工具/文档消费"设计的，可在 awesome 页面用它生成实时命令表；(b) `dsh-websearch:open-settings` / `dsh-message-ops:open` 事件协议值得写成一段公开的「插件互操作约定」，邀请第三方插件也来注册命令——这是把 contribution point 变成事实标准的第一步；(c) 呼应 roadmap 的 `@240xu/dsh-suite` meta 包：一键装全套是最好的 CTA。

---

## 6. 风险

1. **@240xu 个人前缀对采用的影响（中）**：scope 化 npm 名是个人品牌，在市场清单里 author=240xu 且包名带个人前缀，会让新用户怀疑"这是不是某人的玩具"。缓解：market manifest 的 `name` 用功能名（websearch / message-ops），npm 名保持 scope；长期可讨论是否迁 `@dsh-*` 组织 scope，但迁移成本高，优先靠 suite meta 包 + 市场卡片建立"一套"的整体感。
2. **0.x 版本号心智（高，message-ops/SLV/devkit）**：0.2.0 / 0.1.0 在用户心智里 = "未稳定、随时 breaking"。对 devkit 这种要抢"生态贡献点标准"位置的插件尤其致命——没有人愿意把命令注册到一个 0.x 插件上。建议：devkit 在贡献点 API 稳定后尽快 1.0（哪怕功能不加，语义升级）；message-ops 的非破坏承诺（append-only、可恢复）就是它的"稳定证明"，应在 README 顶部用一句话点明。websearch 已 2.x，无此问题。
3. **Node ≥23.5 / ≥24 兼容面（中高）**：message-ops 需要 Node ≥23.5（zlib.zstdCompressSync）、SLV 需要 ≥24，而 DSH 用户大量在 Termux/Windows。DSH 本身对 Node 版本的要求若低于此，这批插件会直接装不上；即使满足，"我明明能跑 DSH 却装不了插件"的 issue 会损耗口碑。devkit 定 ≥20 是对的。缓解：README 安装节放一个明显的 Node 版本检查命令（`node -v`），错误信息里写清最低版本；未来把 zstd 压缩改为可选降级（压缩失败退 gzip 或不压缩写盘）可解锁 20/22 用户。
4. **官方吸收风险（中，SLV 专属）**：tail 查看是官方 Trajectory 最容易加的功能。SLV 的对策是守"零写入 + 极端大文件"两个官方不会做的约束，并在文档里持续强调。
5. **叙事断档（低但易修）**：websearch CHANGELOG 缺 2.5–2.7，devkit README 引用占位截图——两者都是"产品好但门面坏"，市场评分会因此失真。

---

## 汇总：市场就绪度红黄绿

| 插件 | 就绪度 | 一句话 |
|---|---|---|
| dsh-websearch 2.7.0 | 🟡 | 产品最成熟（2.x + 可靠性故事完整），缺 En 短描述、缺截图、CHANGELOG 断档 |
| dsh-message-ops 0.2.0 | 🟡 | agent 工具是独特卖点，缺截图/GIF、缺 En description、0.x 心智需用"非破坏承诺"对冲 |
| dsh-session-lazy-view 0.2.0 | 🟡 | 定位诚实但窗口期有限（防官方吸收），缺截图、缺 En、Node≥24 最挑剔 |
| dsh-devkit 0.1.0 | 🔴 | 差异化最强，但未确认发包 + README 引用 70 字节占位截图，上架即破图 |

## 发布前必须补的 3 件事

1. **补齐全部截图/GIF（最高优先，devkit 的三张占位图是阻断项）**：每个插件至少 1 张市场卡片图 + devkit 一段 Ctrl+K GIF + message-ops 一段分支 GIF。市场与 awesome 精选的第一眼资产为 0，其他一切优化无效。
2. **发包 devkit + 补 En 短描述 + 追写 websearch 2.5–2.7 CHANGELOG**：devkit 无 npm 包则市场安装按钮不可用（NPM_SPEC 限制）；manifest 契约的 descriptionEn 是显式字段；CHANGELOG 断档会让 2.7.0 的可靠性演进在 npm 页面上隐形。
3. **把四个 release 用统一叙事打包发布**：一篇「DSH 开发者工作流四件套」公告（Ctrl+K → 设置/历史 → 回滚/分支 → 秒看大文件）+ 各自可粘贴的 release notes（§3），并预告 `@240xu/dsh-suite` 一键安装路线。"一套"的叙事比四个独立 0.x 的叙事传播力强一个量级。

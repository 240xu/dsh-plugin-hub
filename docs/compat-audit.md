# @240xu 六包全维度兼容性审计报告

日期：2026-09-29 · 审计环境：Node v26.4.0 / linux (Termux) · 只读审计
对象：dsh-suite 0.1.0、dsh-websearch 2.7.2、dsh-message-ops 0.2.2、dsh-devkit 0.2.2、dsh-session-search 0.1.0、dsh-session-lazy-view 0.3.0（及 0.2.1 对照）
DSH 版本双线：npm latest 0.1.5-rc.3（SettingsProvider 线）与 next 0.1.7-rc.2（SettingsForms 线，dsh-core-pr checkout 实证）

---

## 0. 矩阵总表

图例：✔=PASS　✖=FAIL　⚠=RISK　—=不适用

| 包 | 1 双端 | 2 DSH双线 | 3 安装模式 | 4 旧格式 | 5 Node档位 | 6 并存 | 7 升级路径 |
|---|---|---|---|---|---|---|---|
| dsh-websearch 2.7.2 | ⚠ HOME env | ✖ settingsScope(0.1.7) ⚠ installSection(0.1.7) | ⚠ 6个静态peer裸克隆挂 | — | ⚠ 无engines(需≥20.3) | ✔ | ✔ |
| dsh-message-ops 0.2.2 | ✔ | ✔ 双面探测降级 | ✔ 动态import容错 | ✖ 旧单帧崩(与注释矛盾) | ✔ =23.5 准确 | ✔ | — |
| dsh-devkit 0.2.2 | ✔ | ✔ | ✔ 零peer | — | ✔ ≥20 准确 | ✔ | — |
| dsh-session-search 0.1.0 | ✔ | ✔ 动态import容错 | ✔ | ✖ 旧单帧崩 | ✔ =23.5 准确 | ✔ | — |
| dsh-session-lazy-view 0.3.0 | ✔ | ✔ (对0.1.5-rc.2考证) | ⚠ 静态import schemastery 且未声明peer | ✔ 单帧真兼容 | ⚠ ≥24过窄(实际23.5够) | ✔ | ✔(端点/存储不变) |
| dsh-suite 0.1.0 | ✔ | ✔ | ⚠ lazy-view锁^0.2.1 | — | ⚠ 无engines | ✔ x240-前缀无冲突 | ⚠ 拿不到0.3.0 |

测试实证：websearch 76 tests 全过；message-ops 31、session-search 12、devkit 51 全过；suite 6 测试中 3 过 / 3 失败（PoC mock fixtures 被 .gitignore 移除所致，见 §3）。

---

## 1. 双端（Windows / Termux）

**PASS（多数）**
- 路径拼接：六包全部 `node:path`（websearch lib/index.js:359、message-ops src/session-file.js:83、devkit src/index.js:11、session-search src/session-file.js:107-114、lazy-view lib/index.js:20,33）。无手工 `/` 拼接文件路径（grep 命中的均为 URL/HTML 字符串）。
- ~ 展开：message-ops:83、session-search:107、lazy-view:33 用 `os.homedir()`；✔
- 原子写 tmp+rename：websearch lib/cache.js:76-81（注释明确 Windows 走 libuv MoveFileExW(MOVEFILE_REPLACE_EXISTING)，README 已考证）；message-ops src/branch.js:50-52、session-search src/indexer.js:49-51 同款同目录 tmp + renameSync —— Windows 覆盖语义与 websearch 一致，✔ 同样成立。
- file: 安装：suite README:7-14 用 `link:`，websearch README:53 `file:/path/to/...`。

**RISK**
- ⚠ websearch lib/index.js:359 用 `process.env.HOME` 兜底而非 `os.homedir()`：Windows 上 HOME 通常未设 → storeDir 变 `.dsh\cache\websearch` 相对当前目录（cache.js/history.js 全部吞 fs 错误，故不崩但缓存/历史静默失效）。其余五包均 homedir，仅此一处。
- ⚠ 六包（websearch/message-ops/devkit/session-search/suite）均无 `.gitattributes`：Windows clone 检出 CRLF 不受控；JS 运行时无碍（测试文件均运行时生成），属卫生项。
- devkit fileURLToPath(import.meta.url)（src/index.js:15）取包目录：npm 与 symlink 安装下 Node 默认 realpath 解析，双模式均正确，✔。

## 2. DSH 版本双线（0.1.5-rc.3 vs 0.1.7-rc.2）

**关键 API 断层（npm tarball 实证）**
- `@deepseek-ai/dsh-settings`：0.1.5-rc.3 导出 `SettingsProvider`（s-015 lib/index.js:610），0.1.7-rc.2 导出 `SettingsForms`（s-017 lib/index.js:544）；0.1.7 checkout 中 SettingsForms 即 `settings` 服务（packages/settings/settings/src/index.ts:223-231 `super(ownerContext,'settings')`），**无 installSection 方法**（全仓 grep 为 0）。
- `settingsScope` 客户端服务：**0.1.7 起删除**（dsh-settings-scope-shim/cordis.patch.yml:1 "restores the pre-0.1.7 settingsScope service surface"）。

**逐包判定**
- ✖ **dsh-websearch 在 0.1.7 上双断**：
  1. 客户端硬注入 `["slots","locale","connection","remote","settingsScope"]`（lib/client.js:547，551 行 `ctx.settingsScope.bind(...)`）——0.1.7 无 settingsScope → 客户端 fiber 永不激活 → 设置面板/凭据刷新全死，**除非另装 dsh-settings-scope-shim**。0.1.5 上 settingsScope 存在 → 正常。
  2. 服务端 `settings.installSection`（lib/index.js:347）有 typeof 守卫（346 行），0.1.7 静默 no-op → 服务端设置 section 不安装（兜底：client settings.section slot 与 cordis config 仍可配置）。
- ⚠ websearch 其余 0.1.5 面 OK：`ctx.web.registerSearchProvider` 在 dsh-web@0.1.5-rc.3 存在（tarball grep=1，0.1.7 同）；schemastery 两线均有（@deepseek-ai/schemastery 3.18.x）。
- ✔ message-ops：surface replace 双拼写自探测（src/ops-core.js:69 `replaceShape`，测试"拒 startSeq 自动降级"过）；无 0.1.5/0.1.7 静态断层。
- ✔ devkit / session-search：只用 webServer.register + inject(["webServer"])（迟到安全），0.1.5-rc.3 的 host webserver 均有（dsh 0.1.5 依赖树含 webserver）；session-search 无 dsh.client（纯 server 包）。
- ✔ lazy-view：注释明确"verified against dsh 0.1.5-rc.2"，仅用 webServer+schemastery。
- ✔ suite：壳 inject=[]，webServer 嵌套 inject。

**结论**：0.1.5 上六包无一硬挂；真正会挂的是 **0.1.7 上的 websearch 客户端（缺 shim 即死）**。

## 3. 安装模式（npm pnpm-hoisted vs link: 裸克隆）

| 包 | 静态 import 的宿主 peer | 裸克隆（link:） | npm hoisted |
|---|---|---|---|
| websearch | dsh-web、cordis、schemastery、dsh-credentials、dsh-settings、dsh-launch-environment（lib/index.js:11-24 顶部静态） | ⚠ 挂：模块加载即失败，无降级 | ✔ |
| lazy-view | schemastery（lib/index.js:18）且**未声明 peerDependencies** | ⚠ 挂（suite README:98 的 slv-check shim 即为此病） | ✔（宿主 hoist 兜底） |
| message-ops | 无静态；dsh-tools 走 `import().catch()`（src/index.js:306-318） | ✔ 工具注册跳过、HTTP 照常 | ✔ |
| session-search | 无静态；同上动态容错（src/index.js:111-140） | ✔ | ✔ |
| devkit | 零 peer | ✔ | ✔ |
| suite | 壳零依赖，动态 import 子包失败即单行降级（src/shell.js:118-127） | ✔ | ✔ |

- suite 测试 3 失败为**环境性**：`node_modules/@240xu/mock-*` 是被 .gitignore 的 PoC fixtures（commit c864ce2），发布形态 npm 安装后由真实子包替换，非代码缺陷；但 shell.test.js 在无 fixtures 仓库里恒红，建议改用 inline mock（data: URL import）。

## 4. 旧格式兼容（session.jsonl.zstd 单帧）

**✖ FAIL（P0 级发现，实测复现）**
- message-ops src/session-file.js:9-10 注释声称"旧格式（单帧整文件）读取走同一帧扫描路径，单帧等效于解压整份"——**不成立**：readSessionFile:60 对帧 0 解压结果整段 `JSON.parse(headerText.trim())`，单帧时该文本=header行+全部事件行 → JSON.parse 抛 `Unexpected non-whitespace character after JSON`（实测复现）。
- session-search src/session-file.js 同源同病（readSessionFile/readSessionFileAsync 均炸，实测复现）。
- 两包 test/ 均无旧单帧用例（grep 单帧/legacy 仅命中 surface 的 legacy 拼写，与格式无关）→ 未覆盖。
- ✔ 对照：lazy-view lib/frames.js:9-13 明确处理 legacy（"single frame … handled as one frame at offset 0"），解压后按行拆分取首行 header，实测 `readTailFrames` 对单帧旧文件返回正常（header+events 均出）。
- 影响：装了 message-ops/session-search 的用户对**旧格式会话**执行消息回滚/导出/全文索引 → 直接报错（corrupt/parse error），而非优雅降级。
- 立修：header 解析改为 `decompress(frames[0])` 后**按首行**取 header（对齐 lazy-view），并补旧格式回归测试；message-ops 还需处理"旧文件回写升级到 v3 多帧"的策略（现 encodeSessionFile 会输出 v3 形态——格式跃迁是否被宿主接受需另验）。

## 5. Node 档位

| 包 | engines | 实际需求 API | 判定 |
|---|---|---|---|
| websearch | **未声明** | AbortSignal.any（lib/provider.js:287，≥20.3）、fetch、randomUUID | ⚠ 过宽：Node 18/20.0-20.2 首次搜索即 TypeError；建议 `>=20.3` |
| message-ops | >=23.5 | zstdCompress/DecompressSync（session-file.js:23-24，zlib zstd 自 23.5） | ✔ 准确 |
| session-search | >=23.5 | 同上 | ✔ 准确 |
| devkit | >=20 | 仅 fs/path/os/url | ✔ 准确 |
| lazy-view | >=24 | 仅 zstdDecompressSync+fs/promises（lib/frames.js:18-19） | ⚠ 过窄：23.5 即够，白白拒绝 Node 23 |
| suite | 未声明 | 依赖链需 23.5 | ⚠ 应声明 `>=23.5` |

- npm install 拒装问题：engines 默认仅 warning（engine-strict=false），**Node 20 上六包均可安装**，运行时才炸（message-ops/session-search/lazy-view 在 <23.5 调 zstd 即崩；无 engines 的 websearch 在 <20.3 搜索崩）。

## 6. 并存矩阵（suite + standalone 任意子集共装）

- 端点前缀清单（源码 grep 实证）：`/api/websearch/history{,/clear}`、`/api/unified-search/health`（websearch）、`/api/message-ops/{messages,revert,delete,branch,restore,export}`、`/api/devkit/{commands,health}`、`/api/session-search{,/refresh,/panel}`、`/lazyview{,/api/list,/api/tail,/api/search,/api/stats,/api/export}`、`/api/dsh-suite/degraded` —— **零重叠** ✔。
- cordis 行 id：standalone 用 `dsh-websearch` / `dsh-message-ops` / `dsh-devkit` / `dsh-session-search` / `dsh-session-lazy-view`；suite 全部 `x240-` 前缀（cordis.patch.yml）——无冲突 ✔（suite 行挂的是壳，standalone 同装时双实例并存：websearch name=unified-search 两实例会注册两个 search provider——README:49 称 standalone 优先，实际是双注册，⚠ 轻微：搜索 fan-out 会重复计费/重复请求，值得在 README 里写实语义）。
- 存储路径：`$DSH_HOME/cache/websearch`（websearch index.js:358-360）、`$DSH_HOME/cache/session-search`（session-search:112）、message-ops 写 sessions/<project>/<新UUID>/（crypto.randomUUID）、devkit/lazy-view 零写、suite 零写 —— 无冲突 ✔。
- 客户端 slot：message-ops `conversation.session.header.actions`(id message-ops, order 31)、devkit 同 slot(order 90)+`shell.overlay`、websearch `settings.section`(id websearch, order 16) —— id 均异 ✔。
- 跨包软依赖：devkit client 探测 `/api/session-search/health`、`/lazyview`、`/api/message-ops/messages`、`/__chameleon/session/delete`、`/api/pair/status`（client.js:519,544,623-646,1132）——全部 probe+degrade，缺包不炸 ✔。

## 7. 升级路径

- websearch 2.4/2.5 → 2.7.2：✔ 无断点。缓存 `$DSH_HOME/cache/websearch` 为 2.7.0 新增（CHANGELOG），2.5 无旧缓存结构；设置键全部增量新增（cacheEnabled/cacheTtl/breaker*/history*），未改旧键；2.7.1 仅把 breakerCooldownMs=0 语义固定为禁用。settings panel 的 installSection 断层见 §2（与版本线相关、与升级无关）。
- lazy-view 0.1.x → 0.3.0：✔ 端点 `/lazyview` 不变、零存储、patch id 不变（`dsh-session-lazy-view`），覆盖安装即迁移。0.2.1→0.3.0 仅新增 Timeline（内联 timeline.js），无破坏。
- ⚠ suite 用户拿不到 0.3.0：suite dependencies 锁 `"^0.2.1"`（0.x 下 caret=仅 0.2.x）——suite 安装者停在 0.2.1 缺 Timeline；suite 需随 lazy-view 0.3.0 发版 bump 到 `^0.3.0`。

---

## 最危险 3 项

1. **P0 — websearch 客户端在 DSH 0.1.7 上全死（settingsScope 硬注入被删服务）**。证据：lib/client.js:547 hard-inject `settingsScope`；dsh-settings-scope-shim/cordis.patch.yml:1 实证该服务 0.1.7 起移除。用户在 0.1.7 装当前 websearch → 设置面板/凭据刷新不出现且无任何报错。修复：client inject 改探测式（inject(["settingsScope"]) 包 try / ctx.get 容错），或发布时捆绑 shim。
2. **P0 — message-ops 与 session-search 读旧单帧格式 session.jsonl.zstd 必崩**，与 message-ops 自述兼容注释（src/session-file.js:9-10）直接矛盾，实测 JSON.parse 复现；测试零覆盖。旧会话一碰回滚/导出/索引即 4xx/报错。修复：帧 0 文本按行拆分取首行 header（对齐 lazy-view frames.js 实现）+ 补旧格式用例。
3. **P1 — websearch 在 0.1.7 服务端设置 section 静默 no-op**：0.1.7 settings 服务为 SettingsForms（packages/settings/.../index.ts:223-231），无 installSection，typeof 守卫（lib/index.js:346-347）吞掉 → 设置面板该节消失、只能靠 cordis config。需确认 0.1.7 的新 settings 注册路径（client settings.section slot 是否足以承载全部字段），否则按新 API 适配。

## 建议立修清单

1. [P0] websearch client.js:547：settingsScope 移出硬 inject，改 `ctx.inject(["settingsScope"]...)` 可选/或探测式 get；README 标注 0.1.7 需 shim 的过渡事实。
2. [P0] message-ops/session-search session-file.js：header 解析改"帧 0 解压→首行"，补 legacy 单帧回归测试；明确旧文件 branch/restore 回写的格式升级语义。
3. [P1] websearch 服务端：0.1.7 下 settings section 适配（SettingsForms 或客户端 slot 全量承载），并移除"静默 skip"改为一次性 debug 日志。
4. [P1] websearch 补 `engines: {"node": ">=20.3"}`；suite 补 `>=23.5`；lazy-view 放宽为 `>=23.5`。
5. [P1] suite dependencies：lazy-view bump `^0.3.0` 并发版，消除 0.2.1 滞留。
6. [P2] lazy-view package.json 补 peerDependencies（@deepseek-ai/schemastery、dsh-host-webserver 等），裸克隆才可诊断。
7. [P2] websearch index.js:359 `process.env.HOME` → `os.homedir()`（Windows 缓存静默失效）。
8. [P2] 六仓加 `.gitattributes`（`* text=auto eol=lf`）；suite shell.test.js 改 inline mock 使无 fixtures 也绿。
9. [P2] README 写实：suite+standalone 同装 websearch 时为双 provider 注册（非"standalone 优先"）。

---

## 追加（2026-09-30）：dsh 0.2.0-rc.2 升级实测

dsh 已升级 0.2.0-rc.2（npm latest=next）。实测结论：
- **版本门**：peerDependencies `^0.1.0-rc.6` 会被 0.2.0 拒绝（dsh-tools/session 等全升 0.2.0-rc.2）。
  message-ops/session-search 已放宽为 `^0.1.0-rc.6 || ^0.2.0-rc.1`（0.2.4 / 0.1.3 已发 npm），最新 boot 零跳过。
- **surface replace 拼写**：0.2.0-rc.2 运行时仍为 `{startSeq,endSeq}`（surface.js:200-317 实测）——0.2.3 的双拼写兼容未触发但保留。
- **defineTool 破坏性变更**：新签名要求 `options.output.render`（旧 run 形状抛 'reading render'）——message-ops 的 message_ops 工具与 session-search 的 session_search 工具在 0.2.0 上**未注册**（容错跳过，HTTP 端点不受影响）；迁移进行中（0.2.5/0.1.4）。
- **websearch 2.7.3 双分支守卫在 0.2.0 实测生效**：installSection 缺失 → console.warn + cordis config 继续可用（日志实证）。
- **第三方插件跳过清单**（0.2.0 版本门）：session-delete 0.3.1、chat-import 0.11.0、archived-sessions 0.1.2、message-rail 0.1.7、agent-alliance 0.1.0——均为上游 peerDeps 未跟进，需上游或 allow-version 豁免。
- **settings 线**：0.2.0-rc.2 dsh-settings 仍是 SettingsForms（0.1.7 线延续）。

# compat-02-a — 0.2.0 宿主 API 面深度核对（六包 × 七接触面）

> 真源优先级：安装运行时 `@deepseek-ai/dsh@0.2.0-rc.2`
> （/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh/，下称 RT）>
> 官方仓库 ~/dsh-src/（较旧 HEAD，仅用于补充说明，差异单独注明）。
> 方法：逐项读 RT 已构建 lib 源码并给 file:line；审计只读，未改插件代码。
> 结论行：PASS=行为与 0.1.x 一致无需动 / WARN=有差异需跟进 / FAIL=破坏性。

## 0. 矩阵总览

| 接触面 | message-ops | websearch | devkit | session-search | lazy-view | session-delete |
|---|---|---|---|---|---|---|
| 1 webServer.register | PASS | PASS | PASS | PASS | PASS | PASS |
| 2 settings | n/a | WARN→可适配 | n/a | n/a | n/a | n/a |
| 3 defineTool | PASS | n/a | n/a | PASS | n/a | PASS |
| 4 slots | PASS | n/a | n/a(只读) | n/a(无UI) | n/a | n/a(只读) |
| 5 surface replace | PASS | n/a | n/a | n/a | PASS(读) | n/a |
| 6 持久化格式 | PASS | n/a | n/a | PASS | PASS | WARN |
| 7 鉴权/围栏 | PASS | PASS | PASS | PASS | PASS | WARN |

计数：**PASS 23 / WARN 2 / FAIL 0**。

## 1. webServer.register — PASS（六包全绿）

- RT `dsh-host-webserver/lib/index.js:177-183` `register(route)`：`kind:'exact'`
  进 exact 表、其余进 prefixes 表；重复 (kind,path) 抛错（:179）——与六包全部
  `kind:'exact'` 用法一致，且六包路径互不相同无冲突。
- 分发（:233-247）：`match(pathname)` 命中即 `await route.handler(req, res)`，
  req/res 是**原生 node:http IncomingMessage/ServerResponse**，handler 拥有完整
  响应所有权（:101 "Route handlers retain direct response ownership"）；handler
  抛错由宿主兜底 400（:249-254）。0.1.x 同款签名，六包的 `handler(req,res)` +
  `res.writeHead/end` 形状零变化。
- 新增面（六包未用，无影响）：`registerUpgrade`（:191）、`registerFallback`
  （:206）、`tapIndex`（:214）、gzip 中间件（:246）。

## 2. settings 双分支 — WARN（websearch），可做真适配 ✅

- RT `dsh-settings/lib/index.js:322` `SettingsForms` 已是唯一 settings 服务；
  **没有 installSection**（全文件 grep 无该方法）→ websearch 的
  `typeof settings?.installSection === 'function'`（lib/index.js:370）在 0.2.0
  恒走 else 的 console.warn 分支。
- **真适配方案（无需等上游）**：SettingsForms 的表单是**自动生成**的——
  `schema(entry)`（:546-549）直接读 `entry.fiber.runtime.Config`（插件模块导出的
  zod schema，须有 `toJSON`），`autoGenerate` 默认 true（:436-437），
  `describe()` 把 schema 投影成 forms（:424-470）。websearch **本来就导出
  `Config`（zod，lib/index.js:132）**，所以 0.2.0 上它的设置表单应该已经在
  Settings 面板自动出现，warn 分支只是过时提示。具体适配（低成本）：
  1. 删掉/降级 installSection 分支的 console.warn（改为 debug 级或直接删除）；
  2. 可选：`ctx.get('settings')?.configure?.({ auto: true })`（configure 契约
     RT :377-387：一次一 fiber、重复配置抛错）显式声明 auto 页策略——默认即
     auto，通常无需调用；
  3. 把 `Config` 各字段补 zod `.describe()` 文案（表单标签来自 schema 注解，
     这是用户可见质量的唯一杠杆）。
- 验证入口：`dsh-api-settings-controller/lib/index.js:478` 经
  `ctx.get("settings")` 读 describe()——装好 0.2.0 后打开 Settings 面板即可确认
  websearch 表单是否已自动出现。

## 3. defineTool 0.2.0 契约 — PASS（message_ops / session_search / session-delete）

- RT `dsh-tools/lib/index.js:838-875`：`defineTool(options)` 逐字段：
  `options.execute`（必，包一层 args 严格校验 :866-869 后 `userExecute(args, exec)`
  透传 exec——我们的工具忽略第二参，语义安全）；`options.output.render`（:842
  直接解引用 `options.output.render`，缺 output 即 TypeError——三包均已提供
  `render(_args, value) => [{type:'text', text}]`，返回形态即内容块数组，合规）；
  `options.output.schema`（:843）、`parameters`（:846 编译为 JSON Schema，
  支持 string/integer/enum——message_ops 的 action enum 与 seq integer 已验证）、
  `finalizeContent/projectContent/presentCall/presentResult/isConcurrencySafe/
  timeoutMs` 均为可选。与 Lead 实测「0.2.0-rc.2 构造成功」一致；运行期语义差：
  无。

## 4. slots 名单 — PASS（shell.overlay / header.actions 都在）

- `shell.overlay`：RT `dsh-client-ui-layout/lib/client.js:312`
  `renderSlot("shell.overlay", {})`（overlay 渲染点）+ :617 槽位声明表项；
- `conversation.session.header.actions`：RT
  `dsh-client-ui-conversation/lib/client.js:16502` `renderSlot(...)` + :18268 声明。
- message-ops client 的头部按钮（header.actions）与对话框（shell.overlay）、
  devkit 的 overlay 挂载点在 0.2.0 全部仍被渲染。

## 5. surface replace — PASS（message-ops 写端当前形状精确匹配）

- RT `dsh-session/lib/types/surface.js:196-203` `isReplaceOp`：**仍要求
  `{op:'replace', startSeq, endSeq}` 恰好 3 键**——与 message-ops 0.2.3 写端
  `{startSeq,endSeq}` 精确匹配（0.2.3 起含运行时探测降级，dsh-src 未来改名
  start/end 时自动跟随）。
- 约束复核：`startSeq/endSeq >= event.seq` 拒绝（:308-309）；
  `sourceEventSeqs` 必须引用更早事件（:262）且覆盖全部被遮蔽节点——
  message-ops 的 planRevert/planDelete（live surface nodes 切片）天然满足。
- 新增强制约束：`assertToolResultRewrite`（:356+）——**仅约束
  `tool/result` 类型的 replace 必须单节点且指向当前 tool/result**；我们的
  replace marker 是 system/message，不受影响；若未来做 tool/result 级编辑需遵守。

## 6. 持久化格式 — PASS（message-ops/session-search/lazy-view）/ WARN（session-delete）

- RT `dsh-session/lib/index.js:56` 与 `types/types.js:54`：
  `SESSION_FORMAT_VERSION = 4`；`dsh-session-format-catalog/lib/index.js`：
  `currentVersion: 4`、codecs **v0–v4**、currentEncoder=v4。**无 v5 迹象**
  （全 RT grep 无 v5 codec/catalog 条目）。
- 文件名生成：`dsh-session-format/lib/index.js:472-474`
  `generation === 0 ? "session.jsonl" : \`session.v${generation}.jsonl\``（+
  `.zstd`）。**v4 判定仍准**；message-ops 0.2.3 的 v4→v3→legacy 探测序列与
  session-search/lazy-view 的发现逻辑对齐。
- 唯一新风险（WARN，session-delete + 两搜索类包低概率）：**历史 codec 覆盖
  v0–v2**——理论上磁盘可存在 `session.v1/v2.jsonl.zstd`（宿主迁移前/迁移中），
  我们的发现序列不含 v1/v2。宿主 catalog 会在读侧迁移到 v4，静默窗口极小；
  建议下个版本把探测序列扩成 v4→v3→v2→v1→legacy（一行改动，未排期）。

## 7. 鉴权/围栏 — PASS（五包）/ WARN（session-delete）

- RT `dsh-client-connection/lib/index.js:205-221` `isTrustedApiRequest(request,
  trustedHosts)`：0.1.x 同款三层（回环 Host + sec-fetch-site cross-site 拒 +
  Origin 同源）**新增 trustedHosts 扩展**（非回环部署的精确 authority 白名单，
  :195-197）——六包自建围栏（复制自 0.1.x）在 0.2.0 语义上仍保守正确
  （loopback-only 比宿主更严），无需放宽。
- **浏览器鉴权是新层**：`browserAuth` token/cookie（:224-227 `TOKEN_QUERY`、
  `COOKIE_PREFIX 'dsh-auth-'`），作用于 connection RPC 桥（`requestRejection`
  :583-586：先 403 围栏后 401 鉴权）。**插件经 webServer.register 的路由不在
  RPC 桥后**——live 3080 实测佐证：未安装路由（/api/session-search）落到
  fallback 得 "unauthorized"，而已安装的 /api/websearch/history 无 token 直接
  `{ok:true}`。结论：六包自建围栏仍是**唯一**守门人，0.2.0 没有替插件兜底，
  现状设计（每包自带围栏）保持必要。
- **WARN（session-delete）**：其 `/__chameleon/session/delete` 路由**无围栏且是
  写操作**（arch-review 四·P1-1 已点名的破坏性端点）——0.2.0 的 fallback 鉴权
  不保护已注册插件路由，该端点在浏览器里仍是任意外页可打（text/plain CSRF）。
  建议给 session-delete 补 message-ops 同款 fence + Content-Type 门（低成本，
  未排期）。

## 新风险清单（按优先级）

1. **P2** session-delete 破坏性端点无围栏（见 §7）——0.2.0 下宿主不兜底，唯一
   守门仍缺席；
2. **P3** v1/v2 历史 codec 文件名不在发现序列（§6）——宿主会迁移，静默窗口小；
3. **P3** ddg/searxng 10s 连接超时拖聚合（见 runtime-verification.md §五）；
4. 无 FAIL 项：六包在 0.2.0-rc.2 上无破坏性接触面。

## 可顺手完成的真适配（建议排期）

1. **websearch SettingsForms 适配**（§2，最高性价比）：删过时 warn、给 Config
   字段补 `.describe()`、可选 `settings.configure({auto:true})`——0.2.0 的表单
   自动生成即可接管 websearch 全部配置项，用户不再需要 cordis config 手写；
2. session-delete 补 fence + Content-Type 门（同 message-ops 0.2.1 模式，复制
   fence.js 即可）;
3. 六包发现/探测序列扩 v4→v3→v2→v1→legacy（一行 each）。

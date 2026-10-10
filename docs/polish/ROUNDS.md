# 聚合套件打磨路线（每轮一计划）

四轴评估标准（用户定调）：**① 官方 API 对接 ② UI 显示 ③ 代码质量（不堆砌）④ 性能**。
每轮出口标准：计划先行 → 实施有实测证据（单测 + Playwright/API）→ 发布 + tag →
结论回写研究册 → 本表状态更新。

## 状态矩阵

| 插件 | 版本 | git | 状态 | 下一步 |
|---|---|---|---|---|
| message-ops | 0.9.0 | 同步 | **用户另行推进，本线不碰** | — |
| dsh-websearch | 2.8.3 | 同步 | 单测 91/91 ✓ | Round C：API/缓存/性能审计 |
| dsh-session-search | 0.1.6 | 已修（origin/main） | 健康 | Round D：索引重建成本/性能 |
| dsh-session-lazy-view | (源码已找回) | 新建克隆 | 待体检 | Round D：大会话渲染/投影缓存协同 |
| dsh-devkit | 0.2.8 | 同步 | profile 曾钉旧版（重启后复核） | Round B：window 面 + e2e 通道 |
| dsh-suite | 0.1.4 | 已修（origin/main） | 健康 | Round E：聚合层版本对齐 |
| dsh-plugin-session-delete | 0.3.1 | **ahead 2（未推）** | 需补推 | Round E |
| dsh-agent-alliance / archived-sessions / opencode-go-quota | — | 同步 | 健康 | 随需 |
| dsh-better-sidebar / tech-lead* / themis / true-revert / mcp-skill-hub / settings-scope-shim / sessionfix | — | **无 git** | 无版本追溯 | 评估是否纳入版本线 |
| removed-* / *.old | — | 已归档至 ~/dsh-plugins-attic | 清出工作区 | — |

## Round A（进行中→收尾）：message-ops 0.8.0 按轮步进恢复
- [x] 服务端 upToSeq/restoredSourceSeqs/进度判定（49/49）
- [x] 客户端按轮行 + 服务端权威活跃判定
- [x] B1 修复（副本刷屏）+ v080 全环 GREEN + 回归 GREEN
- [x] 发布 0.8.0 + tag msgops-v0.8.0
- [ ] 用户主实例 3080 重启后实测（等用户）

## Round B'：研究册结论 → 演进项（来自 06/07/08 共识）
- [ ] **diskAppend 守卫**（06 硬规则）：跨实例磁盘追加前检测目标会话是否可能被
  其他实例 live 持有（至少文档警示 + 409 语义）；message-ops 0.9.0 候选项。
- [ ] **turnTail 免费槽**（08 §1.3）：官方无内置占用者——消息级动作的正规注入位
  候选（比 DOM 注入更稳），评估 props 是否含目标上下文。
- [ ] **input.left/right 免费槽**：composer 工具行的官方扩展位（quote 按钮迁址候选）。
- [x] 用户 3080 已重启 → 0.8.1 生效（restoreComplete 实测在场），惰性标记全失效，
  主会话贴条归零；8 死队友名册随重启清空。

## Round B：devkit 复核（2026-10-06 实测，结论更新）

**版本与清单：已对齐**——profile 与源码同为 0.2.8，profile package.json 声明
`"@240xu/dsh-devkit": "0.2.8"`，安装副本 `src/client.js` 含 `window.__dshDevkit`
挂载代码（5 处），`主/导出/dsh` 清单字段与源码一致。旧问题"profile 钉 0.2.3"已消除。

**但浏览器实测未激活（3080，三次独立探针）**：
- `window.__dshDevkit` = false、`__dshDevkitKeysInstalled` = false
- **Ctrl+K 无命令面板**（[role=dialog] 0）
- 打开会话视图后（composer 存在）仍同样为 false

**对照实验（关键）**：同一页面上**所有插件客户端都未激活**——
message-ops 头部按钮 false、`.mopsRd` false、websearch 按钮 false；
控制台报 `[session-controller] control stream failed: RemoteError: Cannot read
properties of undefined (reading 'length')`。

⇒ 不是 devkit 自身缺陷；阻断点在**宿主插件客户端加载 / RemoteStreamMux 控制流**
（这也解释了 07 里"GUI 零 HTTP 请求"——传输是流式复用通道，非 REST）。
**待用户确认**：真实 GUI 上插件 UI 是否正常（会话头 Message ops 按钮？Ctrl+K 面板？）
——若是探针环境假象则 Round B 结案；若否，需重建 profile 客户端 bundle 后复验。


- 问题：profile 里 devkit 是 npm 安装快照 0.2.3，源码 0.2.8 未生效；
  实测浏览器 `window.__dshDevkit` 缺失。
- 计划：`dsh plugin --profile web add` 重装/符号链接对齐 → 实测 window 面 →
  补 e2e（命令面板/会话切换走 devkit 而非侧栏轮询，e2e 稳定性↑）。
- 出口：profile 版本=0.2.8、window 面可用、e2e 用 devkit 打开会话成功。

## Round C：websearch 审计（2026-10-06，完成）
实测（2301 行 / 7 模块）：
- ①官方对接：`settings.section` 槽注入（client.js:569）、`ctx.locale.register`
  官方 i18n；HTTP 走插件带外面（history/health 用 ws.register）；网络调用
  **AbortController + 超时**（provider.js:322-327）✓
- ②UI：client.js（612 行）使用官方令牌（--dsw-alias-*/--dsh-*）✓
- ③质量：无 TODO/FIXME/console.log 残留；模块划分清晰；**修掉文档债**：
  CHANGELOG 滞后（版本 2.8.3 vs 日志只到 2.8.1）→ 已补 2.8.2、2.8.3 条目
- ④性能：缓存 TTL 900s / 容量 200 / mtime 淘汰 / TTL 可运行时变更；并发上限
  默认 6（provider.js:14）；熔断 breaker 有测试 ✓
- 遗留（低优先）：测试目录分裂 `test/` 与 `tests/`，可统一
- 验证：单测 91/91 复跑通过


- 清单：官方 fetch 约定（超时/取消/重试上限）、缓存命中与失效、
  91 测试维持、包体与冷启动、错误面文案。
- 出口：审计表逐项结论（保持/修复）+ 必要修复发布。

## Round D：lazy-view + session-search 审计（2026-10-06，完成）

### session-search 0.1.6
- ①对接：`host.register` 三路由 + 官方契约注释；硬约束"对 ~/.dsh/sessions
  **零写入**"（索引存 $DSH_HOME/cache）✓ 合规
- ②UI：panel.js（103 行）独立面板 ✓
- ③质量：模块清晰（678 行/5 文件），含 fence 鉴权 ✓
- ④性能（3080 实测）：搜索 API 首次 **4.95s**，后续 0.07s / 0.013s；
  索引 3.2MB / 296 会话，原子写（tmp+rename）；limit 1-100 + project 过滤
- **待优化**：冷启动 4.95s → 插件 apply 时预热索引（装载挪到启动期）；
  **验证需重启实例**（用户在用，择窗口执行）

### lazy-view 0.3.5（源码已找回）
- 测试 **16/16** ✓
- ④已针对大会话优化：`countFrames` **1MB 分块流式 + 3 字节重叠**统计 zstd 帧
  （不解压、`?fast=1` 有界内存）——实测最大日志 11MB（正是用户主会话）有界 ✓
- ①-③：1125 行 / lib（frames/index/timeline/artifact），单文件内联页面无打包


- 大会话（>4k 事件）渲染/搜索路径的复杂度与内存；
  投影缓存（session_projcache）协同；虚拟化窗口与 DOM 注入的相互作用。
- 出口：性能基线数字（打开/搜索耗时）+ 修复。

## Round E：suite 聚合 + 提交清理（2026-10-06）
- **suite 0.1.5**：聚合依赖版本声明滞后（声明 ^2.8.2/^0.5.2/^0.3.4/^0.1.5）→
  已对齐实际（websearch ^2.8.3 / message-ops ^0.9.0 / lazy-view ^0.3.5 /
  session-search ^0.1.6）；测试 6/6 通过 ✓（提交 d237afc，推送待网络）
- **dsh-plugin-session-delete 0.3.1**：推送 **403**——远端是他人仓库
  `lsz-asd/dsh-plugin-session-delete`（无权限，非网络问题）。
  **不影响运行**：profile 以 `file:` 引用本地目录，2 个修复（0.2.0 compat +
  IconTrashOutlineRegular SVG fallback 修 React #130 崩溃）已生效 ✓。
  云端追溯方案待用户定：保持本地 / fork 后 PR 上游 / 改挂自己仓库下（改 remote）
- **网络阻塞**：本日 git/npm 出口反复中断（GitHub 时通时断、registry.npmjs.org
  基本不通），影响发布环节；文档与代码提交均已在本地落盘，无丢失风险


- 版本对齐、hub README、研究册差异标注（若 DSH 升版，新开 mechanics 目录）。

## 纪律
- 不堆砌：每个新面必须对应一个已验证的用户场景；无场景不合入。
- 证据先行：先红后绿（Playwright/单测），结论带数字。
- 历史可翻：版本发布即打 tag（msgops-vX.Y.Z / websearch-vX.Y.Z …），
  机制结论绑 DSH 版本目录（docs/dsh-mechanics/vX/）。

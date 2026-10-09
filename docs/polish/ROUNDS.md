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

## Round B：devkit 修复（高优先：影响开发者体验与 e2e）
- 问题：profile 里 devkit 是 npm 安装快照 0.2.3，源码 0.2.8 未生效；
  实测浏览器 `window.__dshDevkit` 缺失。
- 计划：`dsh plugin --profile web add` 重装/符号链接对齐 → 实测 window 面 →
  补 e2e（命令面板/会话切换走 devkit 而非侧栏轮询，e2e 稳定性↑）。
- 出口：profile 版本=0.2.8、window 面可用、e2e 用 devkit 打开会话成功。

## Round C：websearch 审计（①④轴为主）
- 清单：官方 fetch 约定（超时/取消/重试上限）、缓存命中与失效、
  91 测试维持、包体与冷启动、错误面文案。
- 出口：审计表逐项结论（保持/修复）+ 必要修复发布。

## Round D：lazy-view + session-search 审计（④轴为主）
- 大会话（>4k 事件）渲染/搜索路径的复杂度与内存；
  投影缓存（session_projcache）协同；虚拟化窗口与 DOM 注入的相互作用。
- 出口：性能基线数字（打开/搜索耗时）+ 修复。

## Round E：suite 聚合层 + 文档同步
- 版本对齐、hub README、研究册差异标注（若 DSH 升版，新开 mechanics 目录）。

## 纪律
- 不堆砌：每个新面必须对应一个已验证的用户场景；无场景不合入。
- 证据先行：先红后绿（Playwright/单测），结论带数字。
- 历史可翻：版本发布即打 tag（msgops-vX.Y.Z / websearch-vX.Y.Z …），
  机制结论绑 DSH 版本目录（docs/dsh-mechanics/vX/）。

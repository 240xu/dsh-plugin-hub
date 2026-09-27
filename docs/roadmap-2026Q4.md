# DSH 插件生态路线图 · 2026 Q4（4 周冲刺）

> 依据：[vscode-parity.md](./vscode-parity.md) 的功能图谱与优先级结论。
> 主线：**搜索 → 时间线 → 面板入口**（跨会话搜索 → Timeline/深链 → 命令面板前缀体系）。
> 全部计划不依赖侧边栏注册面（better-sidebar 已锁定）；只用 `shell.overlay`、`conversation.session.header.actions`、自持 HTTP 端点、`defineTool`、设置段注册。

---

## 第 1 周 · 命令面板地基（devkit）

**主题**：把 devkit 命令面板从「可用」升级为「可达」——模式前缀 + MRU。

**涉及插件**：devkit（在途）

**任务**：
- 模式前缀路由：`>` 命令、`@` 会话内消息锚点、`:` 跳消息序号；`#` 本周先留占位（第 2 周接 session-search）。
- MRU 记忆：命令执行频次/最近时间持久化，排序 = f(模糊得分, MRU)；命令列表保持名称稳定排序（对齐 VS Code 官方取舍）。
- 快捷键：面板唤起键 + `Ctrl+K` chord 雏形。

**验收标准**：
- [ ] `Ctrl+P` 打开面板，输入 `>se` 能命中 session 相关命令，最近执行过的排前。
- [ ] MRU 数据刷新后重开面板仍生效。
- [ ] 无任何侧边栏注册改动；toast/键位行为回归正常。

---

## 第 2 周 · 跨会话全文搜索（dsh-session-search，新插件）

**主题**：补上生态最大空白——在所有历史会话里"找一句话/一次报错"。

**涉及插件**：`dsh-session-search`（新）、devkit（`#` 前缀接入）、session-lazy-view（深链预留）

**任务**：
- 后台增量扫描 `~/.dsh/sessions` session.jsonl[.zstd]，建轻量倒排索引（会话 id + 帧 seq + 命中偏移 + ±3 行上下文）。
- 自持 HTTP 端点：`/search?q=`、`/status`（索引进度）。
- overlay 全屏结果页（等价 VS Code Search Editor）：按会话分组、展开预览命中帧、点击跳转。
- devkit `#` 前缀接 session-search 数据源。
- `defineTool` 暴露 `session_search` 给 agent。

**验收标准**：
- [ ] 50+ 会话规模下，搜索返回 < 2s；索引增量更新不阻塞 UI。
- [ ] 结果页点击命中项能跳到对应会话与帧（深链 `?session=&frame=&context=`）。
- [ ] agent 能通过 `session_search` 工具查到历史内容。
- [ ] 手机（Termux）上大会话索引不发生 OOM/卡顿。

---

## 第 3 周 · Timeline 浏览器（session-lazy-view 升级）

**主题**：把惰性查看器从"查看器"升级为"时间线浏览器"（对齐 VS Code Timeline）。

**涉及插件**：session-lazy-view（增强）、message-ops（blame 元数据协作）、dsh-session-search（共用索引）

**任务**：
- Timeline 视图：帧序列按角色（user/assistant/tool）与类型着色，输入即筛，点击跳帧。
- Go to Message 深链完善：`?session=&frame=&context=N`，与搜索结果页互通。
- 消息 blame：每帧标注来源（本会话 / chat-import 导入 / 分支 parentSession / 回滚遮蔽恢复）——message-ops 提供遮蔽与分支元数据。
- 会话事件密度条（minimap 对应物）：标注 tool 调用/错误/回滚点，点击跳转。

**验收标准**：
- [ ] 大会话（>10k 帧）Timeline 惰性加载流畅，成本与文件大小无关（保持 lazy-view 既有承诺）。
- [ ] 从搜索结果 → Timeline → 具体帧，全程 ≤ 2 次点击。
- [ ] 被回滚遮蔽的帧在 Timeline 上有明确标识且可恢复（与 message-ops 语义一致）。

---

## 第 4 周 · 对照视图与收尾（dsh-session-compare，新插件）

**主题**：分支工作流闭环——两个会话并排对照 + 消息 diff；同步收尾。

**涉及插件**：`dsh-session-compare`（新）、message-ops（diff 预览增强）、devkit（收尾：chords、分类前缀规范）

**任务**：
- 会话对照视图：overlay 全屏层左右分栏各开一个会话，消息树 diff 高亮；从 message-ops「分支」操作一键进入（原会话 vs 新分支）。
- message-ops 回滚前 diff 预览：并排展示将被遮蔽的范围。
- devkit 收尾：chords 完善、命令分类前缀命名规范成文（供后续插件遵循）。
- 里程碑复盘：三插件（session-search / lazy-view / compare）互相引用关系核对，更新 hub README 补充新插件条目。

**验收标准**：
- [ ] 从分支对话框点"对照查看"直接打开左右分栏，diff 定位到 fork 点之后的第一条差异消息。
- [ ] 回滚确认前可见将被遮蔽消息的 diff 预览。
- [ ] 新插件全部注册为 hub 可安装条目；无侧边栏依赖；`dsh plugin --profile web add` 双端命令验证通过。

---

## 风险与依赖

- 插件间协作（devkit ↔ session-search ↔ lazy-view）走自持 HTTP 端点，需约定稳定的本地端口分配与发现方式（第 2 周内敲定）。
- 索引存储位置与大小上限需在第 2 周定义（建议 `~/.dsh/plugins/session-search/index/`，提供重建命令）。
- 侧边栏为禁区，所有 UI 落 overlay/header.actions/设置段；若某交互在 overlay 内体验不佳，宁可降级（如 Prompt Snippets 降级为剪贴板复制）也不触碰禁区。

## 后续候选（P1/P2，未排期）

- `dsh-task-panel`：job/子代理输出聚合页（对齐 VS Code Output 通道）。
- `dsh-profile-sync`：插件清单导出/导入（跨机 Termux ↔ Windows）。
- `dsh-prompt-snippets`：提示词片段库。
- message-ops 分支谱系图（parentSession 树可视化）。

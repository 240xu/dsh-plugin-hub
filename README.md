# DSH Plugin Hub · 240xu 面板聚合安装总览

DeepSeek Harness（DSH）插件安装总览：本机全部插件的**一键安装命令**，Windows 与 Termux 双端写法。
所有列出的安装均已在本机（Termux, Android aarch64）验证；Windows 写法为同构命令（路径换 `C:/`）。

> DSH 是 "Everything is a Plugin" 的 agent harness：`dsh plugin --profile <profile> add <来源>` 即装即用。
> Termux 用户请先看 [dsh-termux-setup](https://github.com/240xu/dsh-termux-setup)（一条命令装好 DSH + 全部 Termux 兼容补丁）。

---

## 1 · 自维护插件（GitHub 可装）

### @240xu/dsh-message-ops · 消息回滚/删除/分支三合一
会话头部按钮 + 侧栏菜单打开统一操作对话框：**回滚**（surface replace 遮蔽所选消息及之后全部，append-only 可恢复）、**删除**（仅遮蔽一条）、**分支**（从任意消息 fork 新会话，`parentSession` 关联，零破坏）。零 npm 依赖，Node ≥ 23.5。
- 仓库：<https://github.com/240xu/dsh-message-ops>

```sh
# Termux / Linux
dsh plugin --profile web add @240xu/dsh-message-ops
# Windows
dsh plugin --profile web add @240xu/dsh-message-ops
# 或本地目录（双端通用写法）
dsh plugin --profile web add file:C:/path/to/dsh-message-ops   # Windows
dsh plugin --profile web add file:/path/to/dsh-message-ops     # Termux
```

### @240xu/dsh-websearch · 统一网页搜索
11 后端聚合（Exa/Parallel/DDG/SearXNG 免钥 + 6 家需钥），URL 去重、可选重排、后端健康遥测。v2.6.0 起内置**系统性搜索提示词**：确定性查询整形（去口语寒暄、1500 字符上限）、双语结果呈现头（要求逐条引用来源 URL、优先官方一手来源）、遥测行自标注「仅诊断」——依据 Tavily/Exa 官方最佳实践与 Anthropic/OpenAI grounding 指引。
- 仓库：<https://github.com/240xu/dsh-websearch>

```sh
dsh plugin --profile web add @240xu/dsh-websearch     # 双端同命令
```

### @240xu/dsh-session-lazy-view · 会话惰性查看器（纯只读）
列出 `~/.dsh/sessions` 全部会话（只 stat 不解压），按帧惰性解压查看最近事件——成本与会话文件大小无关，手机上秒开大会话。
- 仓库：<https://github.com/240xu/dsh-session-lazy-view>

```sh
dsh plugin --profile web add @240xu/dsh-session-lazy-view     # 双端同命令
```

### dsh-agent-alliance · 多 agent 联盟
在 DSH 里跑 Claude Code / Codex / OpenCode / ZCode 协同。
- 仓库：<https://github.com/240xu/dsh-agent-alliance>

```sh
dsh plugin --profile web add dsh-agent-alliance     # 双端同命令
```

## 2 · 本地源码安装（file: 写法，双端通用模式）

本地开发中的插件用 `file:` 协议装入（Windows 用 `file:C:/...`，Termux 用绝对路径）：

```sh
# 技术负责人套件（tech-lead 三件套已打包为 bundle）
dsh plugin --profile web add file:C:/path/to/dsh-tech-lead-bundle    # Windows
dsh plugin --profile web add file:/data/data/com.termux/files/home/dsh-plugins-src/dsh-tech-lead-bundle   # Termux
# 同模式适用于：dsh-themis（治理仲裁）、dsh-true-revert（回撤实验源）、dsh-settings-scope-shim
```

## 3 · 本机在用的第三方插件

| 插件 | 版本 | 来源 | 安装 |
|---|---|---|---|
| @huanlin/dsh-plugin-session-delete | 0.3.1 | [lsz-asd/dsh-plugin-session-delete](https://github.com/lsz-asd/dsh-plugin-session-delete) | `dsh plugin --profile web add @huanlin/dsh-plugin-session-delete` |
| dsh-archived-sessions | 0.1.2 | [Zephyr-vibe/dsh-archived-sessions](https://github.com/Zephyr-vibe/dsh-archived-sessions) | `dsh plugin --profile web add dsh-archived-sessions` |
| dsh-opencode-go-quota | 0.3.2 | [GLFzr/dsh-opencode-go-quota](https://github.com/GLFzr/dsh-opencode-go-quota) | 本地 file: 装入 |
| dsh-chat-import | 0.11.0 | [240xu/dsh-chat-import](https://github.com/240xu/dsh-chat-import)（fork 维护） | `dsh plugin --profile web add dsh-chat-import` |
| dsh-better-sidebar | 0.21.1 | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | `dsh plugin --profile web add dsh-better-sidebar` |
| @openviking/dsh-memory-plugin | 0.5.8 | volcengine/OpenViking | `dsh plugin --profile web add @openviking/dsh-memory-plugin` |

## 4 · 周边仓库

- [240xu/dsh-termux-setup](https://github.com/240xu/dsh-termux-setup) — Termux 一键安装 DSH + 全部兼容补丁
- [240xu/dsh-zcode-agent](https://github.com/240xu/dsh-zcode-agent) — ZCode agent preset（官方开源移植 + 逆向存档双分支）
- [240xu/verdict-engine](https://github.com/240xu/verdict-engine) — 可机器校验的工程治理规范 + dsh-themis 插件
- [240xu/awesome-dsh-plugin](https://github.com/240xu/awesome-dsh-plugin) — DSH 插件精选列表（fork）

## 5 · 安装通用说明（双端）

```sh
# npm 包（发布到 npmjs 的）——双端同一条命令
dsh plugin --profile web add <npm 包名>

# 本地目录 —— Windows
dsh plugin --profile web add file:C:/path/to/plugin
# 本地目录 —— Termux / Linux
dsh plugin --profile web add file:/path/to/plugin

# 装完重启 profile 生效
```

要求：Node ≥ 20（用到 zstd 的插件需 ≥ 23.5）；所有 @240xu 插件零原生依赖，Windows / Termux / Linux 行为一致。

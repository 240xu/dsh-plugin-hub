# 六包测试质量与运行时一致性审计（test-audit）

审计日期：2026-02（本次会话） · Node v26.4.0 · 全部只读命令 + 本文件唯一写入。
对象：dsh-message-ops / dsh-websearch / dsh-devkit / dsh-session-search / dsh-suite / slv-check(=dsh-session-lazy-view)。

## 1. 测试数字表

| 包 | 命令 | tests | pass | fail | 备注 |
|---|---|---|---|---|---|
| dsh-message-ops | `node --test` | 31 | 31 | 0 | 全绿 |
| dsh-websearch | `node --test tests/*.test.js test/*.test.mjs` | 76 | 76 | 0 | 全绿 |
| dsh-devkit | `node --test test/*.test.js` | 51 | 51 | 0 | 全绿 |
| dsh-session-search | `node --test test/*.test.js` | 12 | 12 | 0 | 全绿 |
| dsh-suite | `node --test test/*.test.js` | 6 | 3 | **3** | 失败原因：`@240xu/mock-*` fixtures 不在 node_modules（README 步骤 1 要求删除，tests 未自包含） |
| slv-check | `node --test` | 11 | 11 | 0 | 全绿 |
| **合计** | | **187** | **182** | **5** | 5 个失败均为 dsh-suite 同一环境性根因 |

静态一致性：六包全部 src/lib 文件 `node --check` 通过（0 错误）。全仓 grep TODO/FIXME/XXX = 0。

## 2. 测试质量抽查（每包 2-3 文件）

- **message-ops** `fence.test.js` / `ops-core.test.js` / `session-file.test.js`：质量高。断言是行为级（HTTP 状态码 403/415/413/400、降级探测语义），边界覆盖好：非法 JSON、十进制 IPv4 Host、`foo.127.0.0.1`、半残 surfaceOp、超 frameBudget 的 partial。mock req 是最小桩（headers + asyncIterator body），对围栏纯函数足够真实；但缺真实 http server 集成层（见盲区 B2）。
- **websearch** `parse.test.js`（+ breaker/cache/v27）：纯函数解析测试为主，断言行为级（字段映射、cap、dedup、空输入→[]），空/非法 JSON 覆盖到位。ddg 端到端用 mock HTML，fixture 偏小。
- **devkit** `core.test.js` / `consistency.test.js`：`consistency.test.js` 的双源哈希漂移测试是亮点。但 VERSION 只测「是 semver 格式」，没测三处一致（见盲区 B1）。
- **session-search** `indexer.test.js`：增量索引（mtime+size 跳过/重扫/删除）+ 围栏 + 原子缓存，行为级断言，质量好；缺损坏日志容错（B4）。
- **suite** `shell.test.js`：隔离语义设计正确（degrade-not-rethrow、sibling 仍挂载），但依赖外部 mock 包，不自包含（P0，见卫生 H1）。
- **slv-check** `search.test.js` / `timeline.test.js`：node:zlib 自建多帧 zstd 工件，max/frameCap/abort/unparsable-line 边界覆盖好；损坏帧路径只断言「无 frame errors」，无真实损坏用例（B5）。

## 3. 盲区清单（测试通过但可能漏真 bug；每条附缺的用例）

- **B1（devkit）**：无版本三处一致测试。缺用例：`assert.equal(JSON.parse(pkg).version, VERSION_core)` 且 `client.js` 字面量同值——历史曾三处不同步，现有 consistency.test 只哈希函数体不含 VERSION 常量。
- **B2（message-ops）**：413 限制用 1MB ASCII 测，未测 UTF-8 多字节贴近上限的 body（若实现按字符/字节口径不一致会漏）；未测 body 含 CRLF 的 JSON 串；无真实 loopback http server 集成用例（围栏只验证到 header 层）。
- **B3（websearch）**：缺用例——(a) 缓存文件损坏（非法 JSON）时按 miss 处理而非 throw；(b) DDG HTML 实体（`&amp;`）解码；(c) CRLF 分隔的 Exa 文本块；(d) parallel/ddg 结果的 url 去重（仅 anthropic/openai 有 dedup 断言）。
- **B4（session-search）**：refresh 扫到损坏/半写 zstd 日志时的容错未测。缺用例：写入垃圾字节文件 → refresh 不崩、该会话计入 error 状态、其余会话照常索引。
- **B5（slv-check）**：缺用例：文件中段被截断/损坏的 zstd 帧 → forEachFrame 产出 error frame 且 partial 标记正确（现在只验证快乐路径帧）。
- **B6（suite）**：隔离测试 mock 桩 `ctx.plugin` 是同步调用，真实 cordis 可能异步派发——「start throw 隔离」语义在异步化后是否仍成立无回归保护。

## 4. 卫生问题清单（P0/P1/P2）

- **H1【P0】dsh-suite 测试不自包含**：tests 依赖 `@240xu/mock-*` npm 形态 fixture，README 发布前步骤要求删除 node_modules → 干净检出 `npm test` 3/6 红。修复：mock 移入 `test/fixtures/` 相对路径导入（.gitignore 已含 test/fixtures/，需调整策略）或 fixture 缺席时 `t.skip`。
- **H2【P0】dsh-suite 依赖陈旧**：`"@240xu/dsh-session-lazy-view": "^0.2.1"`，而该包现为 0.3.0——0.x caret 不会匹配 0.3.0，聚合安装会装旧版。
- **H3【P1】websearch 与 slv-check 无 `scripts` 段**：没有 `npm test` 入口（slv-check README 注释写 `Run: node --test test/`，目录形式在 Node 26 会把非测试文件也当入口跑）。补 `"test": "node --test \"test/*.test.js\""`。
- **H4【P1】slv-check 缺 `repository` 字段**：其余五包均有指向 github.com/240xu 的 repository。
- **H5【P2】test script 通配形式不一致**：devkit/suite/session-search 用未加引号的 `test/*.test.js`（Windows npm/cmd 不展开 glob → 0 tests）；message-ops 已加引号，建议统一。
- **H6【P2】slv-check `lib/index.js:164` 残留调试 `console.log("[lazy-view] apply() called...")`**：生产噪音，应删或降级。其余 console 均有意：websearch `client.js:579` 是浏览器 toast 兜底、devkit `console.warn` 是重复命令 id 警告、suite console.error/warn 是 degrade 上报——保留。
- **H7【P2】websearch description 内嵌 changelog**（v2.7.0/2.7.1 说明都堆在 description），持续膨胀；slv-check 缺 keywords、files 列 "package.json" 冗余。
- files 字段核对：六包均与实际发布物相符（websearch 含 examples/、devkit 含 docs/ 均存在；suite files 排除 test/ 正确）。exports 与 main 一致性六包均通过。

## 5. 版本一致性

| 包 | package.json | 代码 VERSION | README 最新条目 | 结论 |
|---|---|---|---|---|
| dsh-devkit | 0.2.2 | core.js 0.2.2 + client.js 0.2.2 | Changelog 0.2.2 | ✅ 四处同步（但无自动守护，见 B1） |
| dsh-websearch | 2.7.2 | 无 VERSION 常量 | v2.7.2 | ✅ |
| dsh-message-ops | 0.2.2 | 无 | 「0.2.2 前端收尾」 | ✅ |
| dsh-session-search | 0.1.0 | 无 | 无 changelog 段 | ⚠️ 无从核对，建议补 changelog |
| dsh-suite | 0.1.0 | 无 | 骨架 v0.1.0 | ✅（但依赖 H2 陈旧） |
| slv-check | 0.3.0 | 无 | v0.3.0 Timeline | ✅ |

## 6. 建议补的测试 Top5

1. **suite fixtures 自包含化**（配合 H1）：把 mock 插件改为 test 内联对象/相对路径模块，消灭 3 个环境性失败——这是当前唯一红测试。
2. **devkit 三处版本一致守卫**：package.json vs core.js VERSION vs client.js 字面量（B1）。
3. **session-search 损坏日志容错**：垃圾 zstd 文件 refresh 不崩、可报告（B4）。
4. **websearch 缓存损坏降级**：缓存文件非法 JSON → 按 miss 继续，不 throw（B3a）。
5. **message-ops UTF-8/CRLF 边界**：多字节 body 贴近 413 上限 + 导出文本含 CRLF 的往返（B2）。

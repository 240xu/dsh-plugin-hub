# 0.2.0 兼容审计 · B 线（部署与升级路径）

> 审计人：pm-product-b（三线之二）。只读审计，全部结论带命令输出或 file:line。
> 环境：安装运行时 dsh **0.2.0-rc.2**（`/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh`），宿主 Node **v26.4.0**。
> 对照 tarball：`npm pack @deepseek-ai/dsh@0.1.5-rc.3` 解包于 `~/tmp-dsh015/package/`。

---

## 0. 版本门机制（先行事实，矩阵的依据）

**版本门在 `@deepseek-ai/dsh-app-boot`，不在顶层 CLI bundle。**

- 0.2.0-rc.2：`dsh-app-boot/lib/index.js:279-312` `evaluatePluginCompatibility()`：
  - 只检查 peerDependencies 里名为 `@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` 前缀的键（:296 `if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;`）。非 dsh 前缀 peer（react、cordis 等）**不参与判定**。
  - `workspace:^ / workspace:~ / workspace:*` 三种写法别名成当前运行时版本（:299-300）。
  - 判定：`requirement.trim() === "" || !semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })` → 记为不兼容（:300）。
  - **skip 语义**：`loadProfileDirectory()`（:917-953）对不兼容且未豁免的 bundle `throw` → catch 进 `skippedBundles`，**其余 bundle 照常挂载**；boot 时 `reportSkippedBundles` 打到 stderr（`profile-boot-BZ2ZjNWi.js:516`）。
  - 豁免：profile `compatibility.json`，`dsh plugin allow-version` 授予**精确 pkg@version ↔ 精确 dsh 版本**（:355-370，区间与前缀一律拒绝）。
- **0.1.5-rc.3 的 app-boot 没有版本门**：解包 `~/tmp-dsh015/appboot015/package/lib/index.js`（1575 行）grep `satisfies|evaluatePluginCompatibility|skippedBundles.push|semver` 全部零命中，仅剩 patch 名不匹配的 skip（:99）。**0.1.5 对任何 peer 区间都放行加载**，不兼容会在 cordis 运行期才爆。

**`*` 通配判定（实证）**：用 dsh 自带的 `node_modules/semver` 跑：

```
'*' @ 0.1.5-rc.3 => true   '*' @ 0.1.7-rc.2 => true   '*' @ 0.2.0-rc.2 => true
'^0.1.0-rc.6 || ^0.2.0-rc.1' @ 三列 => true/true/true
'^0.1.0-rc.6' @ 0.2.0-rc.2 => false        （session-delete/archived/chat-import(旧)/rail/alliance 的门）
'^0.1.0-rc.7 || ^0.1.1-rc.2 || ^0.1.2-alpha.2' @ 0.2.0-rc.2 => false   （dshmarket 旧版）
'^0.2.0-rc.1' @ 0.1.7-rc.2 => false        （better-sidebar 在 0.1.x 反向不兼容）
```

**结论：`*` 永远通过版本门**（`*` 匹配一切合法 semver 含 prerelease），websearch 六个 `*` peer 不会被门跳过。注意版本门**只读 peerDependencies，不读 engines**——Node 档位不构成 skip 理由。

---

## 1. 三版本支持矩阵（六包 × 0.1.5-rc.3 / 0.1.7-rc.2 / 0.2.0-rc.2）

图例：✅ 全功能　⚠️ 降级（原因）　❓ 未实测（机制推定）　⛔ 版本门跳过

| 包（版本） | dsh 0.1.5-rc.3 | dsh 0.1.7-rc.2 | dsh 0.2.0-rc.2 | 依据 |
|---|---|---|---|---|
| **websearch 2.8.0**（peer 全 `*`，Node ≥20.3） | ✅/❓ settingsScope 服务在 0.1.5 存在，设置卡片完整（先验+shim README 交叉印证） | ⚠️ 设置卡片缺失：0.1.7 起 settingsScope 移除，`lib/client.js:548-560` 显式降级并 warn「unified-search settings card disabled」；装 dsh-settings-scope-shim 0.0.1（peer `*`，三列全过门）即恢复 | ⚠️ 同 0.1.7 列；**2.8.0 已在 live（本会话运行时）实测跑通** | client.js:548-560；live profile deps `link:…/dsh-websearch`(src 2.8.0) |
| **message-ops 0.2.4**（peer dsh-tools `^0.1.0-rc.6 \|\| ^0.2.0-rc.1`，Node ≥23.5） | ❓ 门可通过；但 0.1.5 顶层依赖表无 `@deepseek-ai/dsh-tools`、CLI lib 无引用（tarball deps 全表 + grep 零命中）→ tools face 缺席，`registerToolTolerantly`（src/index.js:301）静默跳过 agent 工具；HTTP/回滚/分支理论可用，**0.1.5 的 surface replace API 存在性未实测** | ✅ 机制推定全功能（门过、dsh-tools rc.6+ 在）| ✅ **全功能，live 实测**：门过（上表 true）、surface 拼写不变（`dsh-session/lib/types/surface.js:200` `{op:'replace',startSeq,endSeq}` 实测仍在）、defineTool 的 output.render 已提供（`src/index.js:246` render 定义） | surface.js:200；index.js:246/301；live link 0.2.4 |
| **session-lazy-view 0.3.3**（无 dsh-* peer，Node ≥24） | ❓ 门恒过（无 dsh-* peer）；功能是纯文件读取，与 dsh 版本解耦；旧格式单帧路径 README 已覆盖；**未实测** | ❓ 同左 | ✅ suitetest 实测链路 0.3.x（suite R2：0.3.1 过）；npm 最新 0.3.3 同 caret 线。**注意 live profile 还钉在 0.1.1（`profiles/web/package.json`），应升** | profiles/web/package.json deps；suite README R2 表 |
| **devkit 0.2.3**（无 peer，Node ≥20） | ❓ 门恒过；只依赖 slots/header-actions/overlay 等既有兼容面；未在 0.1.x 端到端实测 | ❓ 同左 | ✅ suitetest 实测（R2 五子包含 0.2.3，/api/devkit/health 200、与 standalone 共存）；live profile deps 0.2.3（注意存在 bak-devkit-off-* 开关历史，行级 disable 需复核当前状态） | suite README R2；profiles/web/package.json |
| **session-search 0.1.4**（peer 同 message-ops，Node ≥23.5） | ❓ 同 message-ops：tools face 缺席 → agent 工具降级，索引/HTTP 推定可用 | ❓ 推定全功能 | ✅ live link 0.1.4 运行中 + suitetest 故障注入隔离实测（0.1.2 起验） | suite README R2 第 5 步 |
| **suite 0.1.3**（meta，deps caret，Node ≥20） | ❓ 未实测（子包行为见上） | ❓ 未实测 | ✅ suitetest R2（2026-09-30）实测：五条 x240-* 行挂载、degraded 空、故障注入仅降级单行、standalone 共存 | suite README「端到端验证结果 R2」 |

矩阵计数：✅ 实测全功能 4 格（message-ops/0.2.0、devkit+search+suite/0.2.0、websearch-live/0.2.0 算 1 格）；⚠️ 降级 2 格（websearch 的 0.1.7/0.2.0 列，均系 settingsScope 移除且有 shim 恢复路径）；⛔ 版本门跳过 0 格（六包自己的 peer 全部通过三列）；❓ 未实测 9 格（集中在 0.1.5/0.1.7 两列——0.1.5 无版本门放行加载，但 dsh-tools face 缺席是结构性差异）。

---

## 2. peerDeps 版本门现状 + 第三方跳过包上游核实

### 2.1 版本门判定要点（重申）
`*` 永远通过；只有显式 `^0.1.x-rc.n` 区间在 0.2.0 上为 false（prerelease 参与 satisfies，0.2.0-rc.2 不落在 <0.2.0 区间内）。豁免是精确版本对精确版本，不能写区间 → 对第三方包，**升级 peer 上限是唯一体面解**，`allow-version` 只做应急。

### 2.2 第三方跳过包逐个核实（npm registry 实查 2026-09-30）

| 包 | 安装版（web profile） | 上游最新 | 上游 peer 对 0.2.0 | 结论/动作 |
|---|---|---|---|---|
| @huanlin/dsh-plugin-session-delete | 0.3.1 | **不在 npm**（404） | 安装版 `dsh-tools ^0.1.0-rc.6` → 0.2.0 被 skip | 无上游发布通道；需作者发包或改 git 源 + bump peer，或临时 allow-version |
| dsh-archived-sessions | 0.1.2 | 0.1.1（registry latest 低于本地安装版） | `^0.1.0-rc.5` 族（11 个 dsh-* peer）→ skip | 上游未发 0.2.0 版；继续 skip 或 fork |
| dsh-chat-import | 0.11.0 | **0.22.2** ✅ | 新 peer：`dsh-tools >=0.1.0-rc.6 <0.3.0`、`dsh >=0.1.5-rc.1` → **通过** | **升级到 0.22.2 即解除 skip**（注意 0.11→0.22 跨度大，功能面回归要过一遍） |
| dsh-message-rail | 0.1.7 | 0.1.7（同版） | `^0.1.0-rc.6` 族 → skip | 上游无新版 |
| dsh-agent-alliance | 0.1.0 | **不在 npm**（unscoped/`@240xu` 均 404） | `dsh-tools ^0.1.0-rc.6` → skip | 本地源码包；自行 bump peer 为 `^0.1.0-rc.6 \|\| ^0.2.0-rc.1` 后重装即可 |
| dsh-themis | 未安装于 web profile | 1.5.0 | peerDeps 未能从 registry 摘要取得（`npm view` 仅返回版本号），**需实装核对** | 与 web profile 无关；暂不阻塞 |
| dshmarket | 1.59.0 | **1.66.6** ✅ | `dsh-settings … \|\| ^0.2.0-rc.1` → **通过** | **升级到 1.66.6 即解除 skip** |
| （参照）dsh-better-sidebar | 0.24.1 | 0.24.1（同版） | 全套 `^0.2.0-rc.1` → **0.2.0 通过**；但在 0.1.5/0.1.7 反向不兼容 | 已就绪；这是 0.1.x↔0.2.0 双向不可共存的最大单项 |

**汇总**：6 个 skip 包里 2 个有上游 0.2.0 兼容新版可直接升级（chat-import、dshmarket），2 个 npm 无发布（session-delete、agent-alliance，需作者侧动作），1 个上游未动（archived-sessions），1 个未装（themis）。

---

## 3. suite 0.1.4 发布建议

**发现一个发布物缺口**：npm 上 suite 0.1.3 的 dependencies 是 `websearch ^2.8.0 / message-ops ^0.2.3 / lazy-view ^0.3.1 / search ^0.1.2`（npm view 实查），**不含 devkit**；但 suite README R2 实测是「五子包（2.7.3/0.2.3/0.3.1/0.2.3/0.1.2，含 devkit 0.2.3）」，本地工作副本 deps 同样没有 devkit。README 承诺的「五条 family 行」与 manifest 的四个 dep 不一致——R2 实测时 devkit 应是手工/临时加入，发布物回不到实测状态。

**建议：发 suite 0.1.4，dependencies 定为（ floors 提到实测版本）：**

```json
{
  "@240xu/dsh-websearch": "^2.8.0",          // 2.8.0 live（0.2.0-rc.2）实测
  "@240xu/dsh-message-ops": "^0.2.4",        // 0.2.4 live 实测（门过 + surface + render 齐备）
  "@240xu/dsh-session-lazy-view": "^0.3.3",  // 0.3.x suitetest 验证线；live 还在 0.1.1 必须拉起
  "@240xu/dsh-devkit": "^0.2.3",             // **补回缺失 dep**；suitetest+live 双验证
  "@240xu/dsh-session-search": "^0.1.4"      // 0.1.4 live link 运行中
}
```

逐包 0.2.0 验证状态与 bump 判定：
| 子包 | caret 现值（0.1.3） | 0.2.0 验证 | 是否 bump floor |
|---|---|---|---|
| websearch | ^2.8.0 | 2.8.0 live 实测 ✅ | 不必动（已是 2.8.0） |
| message-ops | ^0.2.3 | 0.2.4 live 实测 ✅ | **bump 到 ^0.2.4**（把 surface/render 双修的版本设为下限） |
| lazy-view | ^0.3.1 | 0.3.1 suitetest ✅（0.3.3 同线） | **bump 到 ^0.3.3** |
| devkit | **缺失** | 0.2.3 suitetest+live ✅ | **补回 ^0.2.3** |
| search | ^0.1.2 | 0.1.2 suitetest ✅；0.1.4 live ✅ | **bump 到 ^0.1.4** |

发布前置检查：suite README 的 R2 流程（link→dump-config 五行→degraded 空→故障注入→standalone 共存）对 0.1.4 的最终依赖集**复跑一遍**（R2 跑的是 2.7.3/0.2.3/0.3.1/0.2.3/0.1.2 组合，与 0.1.4 floors 不同）。

---

## 4. Node 档位

- **dsh 本体无 engines 字段**：0.2.0-rc.2 与 0.1.5-rc.3 的 package.json 均 grep 不到 `engines`（实查）。Node 下限事实上由子模块与运行时 API 决定，不由 npm 声明约束。
- 六包 engines：websearch ≥20.3、devkit ≥20、suite ≥20、message-ops ≥23.5、session-search ≥23.5、lazy-view ≥24。
- **交集**：单独装任意三包最低 20.x 即可跑；**suite 全家 = max(≥24)**（被 lazy-view 抬到 24）。宿主实测 v26.4.0，无问题。
- **发现一个档位乐观值**：message-ops/session-search 的 ≥23.5 依赖 `node:zlib` 的 zstd API，而 zstd（`zlib.zstdCompressSync/DecompressSync`）实际落地于 **Node 23.8.0**（[Node v23.8.0 release](https://nodejs.org/en/blog/release/v23.8.0)，zlib API 文档同证）。23.5–23.7 会装上但在压缩/解压时抛 `zstdCompressSync is not a function`。建议两者 engines 提到 **≥23.8**（或统一 ≥24 与 lazy-view 对齐，省一条心智线）。
- 升级路径建议：suite README 加一行「`node -v` ≥ 24」前置检查，fail 早于 install。

## 5. Windows 专项

- **官方侧**：安装运行时 0.2.0-rc.2 的 README grep `windows|win32` 零命中（无官方平台差异声明在本包内）；GitHub releases 页存在（https://github.com/deepseek-ai/deepseek-harness/releases ）但本次抓取网络失败，release notes 细节未取得——此条留为待补。
- **tmp+rename 模式有官方背书**：dsh 0.2.0 自己的会话持久化走 `@deepseek-ai/dsh-atomic-write`——「写同目录临时文件 → `rename` 覆盖目标，读者 lock-free」（`dsh-atomic-write/lib/index.js:2,8-13,31-35`）。我们 message-ops 分支的「先写临时文件再原子 rename」与官方同构（README 安全设计节）。Node 的 `fs.rename` 在 Windows 上映射 `MoveFileEx(REPLACE_EXISTING)`，覆盖已存在文件合法——**结论：该模式 Windows 可用，与官方实现一致，无需改造**。
  - 唯一 Windows 特有残余风险：杀软/索引器瞬时占用导致 rename 抛 `EPERM/EACCES`。官方 atomic-write 未见重试逻辑（:31-35 单次 rename）——官方也不防，我们与官方持平即可，不值得单独加。
- **zstd 跨平台**：`node:zlib` 的 zstd 在官方 Windows 发行版同样自 23.8.0 起提供，Windows 的 Node 档位约束与 §4 相同（≥23.8/24），无额外平台分叉。
- **路径形态**：六包源码均用 `node:path` 拼接（message-ops README 明示 Termux/Windows 通用），devkit README 提供 Windows 本地路径安装示例（`file:///C:/...`）；已知 `dsh plugin add` 的 NPM_SPEC 拒绝 `file://` 进市场按钮（aggregation-weball.md §4），本地 file: 安装仅限手工场景——两平台一致。

---

## 附：取证命令索引

- 版本门源码：`…/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:279-312, 917-953`
- 0.1.5 无门：`~/tmp-dsh015/appboot015/package/lib/index.js`（grep satisfies/evaluatePluginCompatibility 零命中）
- `*`/caret 判定：dsh 自带 semver 逐例 satisfies（§0 输出）
- surface 拼写：`…/@deepseek-ai/dsh-session/lib/types/surface.js:200-204`
- defineTool render：`…/@deepseek-ai/dsh-tools/lib/index.js:838-868`；message-ops 提供 render：`dsh-message-ops/src/index.js:246`
- 第三方包版本：`npm view <pkg> version peerDependencies --json`（2026-09-30，registry.npmjs.org）
- live profile：`~/.dsh/profiles/web/package.json`（bundles/deps 全文在案）
- suite 验证：`~/dsh-plugins-src/dsh-suite/README.md`（R2 表，2026-09-30）

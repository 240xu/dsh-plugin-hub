# cross-settings-forms — websearch SettingsForms 适配联合裁决（仲裁者之二：websearch-innovator）

> 2026-09-29 · 仲裁对象：A 线（compat-02-a.md §2）适配方案 × websearch 维护者核查
> 证据源：RT `@deepseek-ai/dsh@0.2.0-rc.2` 安装运行时（/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh/，下称 RT）
> 方法：逐行读 RT dsh-settings/lib/index.js 已构建源码 + schemastery lib 实测（volatile 门控、toJSON 投影），并实跑 websearch Config。

## 1. 裁决结论

**A 线机制考证全部属实，但核心结论「websearch 的表单在 0.2.0 上应该已经自动出现」不成立。**

| A 线主张 | 核实 | 证据 |
|---|---|---|
| SettingsForms 是唯一 settings 服务，无 installSection | ✅ | RT dsh-settings/lib/index.js 末行 export：`SettingsConflictError, SettingsForms, SettingsForms as default, redactSecrets`；installSection 全文件 0 命中 |
| `schema(entry)` 读 `entry.fiber.runtime.Config` | ✅ | RT :546-549 `const schema = entry.fiber?.runtime?.Config; return schema !== void 0 && "toJSON" in schema ? schema : void 0;`——websearch 导出的 zod Config 确实会被拾取 |
| `autoGenerate` 默认 true | ✅ | RT :434 `this.presentations.get(entry.fiber)?.auto ?? true` |
| `configure({auto:true})` 可选、一次一 fiber、重复抛错 | ✅ | RT :378-387 `if (this.presentations.has(fiber)) throw ...` |
| **「0.2.0 上表单应该已自动出现，warn 只是过时提示」** | ❌ | **见 §2——volatileForm 门控被漏掉** |

## 2. A 线漏掉的关键门控：`meta.volatile`

RT describe()（:424-470）对每个 entry 调 `volatileForm(schema)`（:426），而 **volatileForm（:122-138）只保留带 `meta.volatile` 的字段**：

- schema 自身 `meta.volatile` → 整棵 plainSchema 即表单；
- object 类型 → 逐字段递归，**无 volatile 的字段被整字段丢弃**；
- 一个 volatile 字段都没有 → 返回 `undefined` → describe() 对该 entry 返回 `[]` → **Settings 面板不出现任何 websearch 表单**。

实测（RT 自带 schemastery lib/index.mjs）：
- `z.object({ a: z.boolean().default(true) })`（无 volatile）→ `volatileForm === undefined` ⇒ **NO FORM**；
- 任一字段 `.volatile()` → 表单生成，且只含 volatile 字段；
- 顶层对象挂 `meta.volatile` → 整棵 Config 成为表单（plainSchema 全量）。

websearch 的 Config **没有任何 volatile 字段** ⇒ 0.2.0 上它现在**不会**自动出现在 Settings 面板。autoGenerate=true 只是「页策略」，不是「表单来源」；表单来源是 volatile 门控 + describe 注解。**因此 A 线第 3 步（补 .describe()）不是「锦上添花」，而是与 volatile 一起构成必要条件；且第 1 步（删 warn）单独执行会让 0.2.0 用户连「去哪配置」的线索都没有。**

## 3. websearch 2.8.1 具体适配 diff 方案（修订版）

```js
// lib/index.js —— 改动 1（核心，一行）：
// Config 定义之后（FIELD_LABELS 循环之前）：
Config.meta = { ...Config.meta, volatile: true };
// 说明：不链式 .volatile()——它返回新 schema 且对已包装 schema 抛错（RT schemastery
// lib/index.mjs:235-237），直接挂 meta 在 0.1.5/0.2.0 两条 schemastery 线上等价且
// 幂等（0.1.5 线 profiles/web/.../schemastery/lib/index.mjs 实测含 volatile 支持）。
// 效果：volatileForm 走 plainSchema(整棵 Config)，全部字段进 0.2.0 表单。

// 改动 2（A 线方案修订）：installSection 双分支重写——
//   0.1.5 线：installSection 存在 → 原路径安装，行为不变；
//   0.2.0 线：删除 console.warn（Config 已 volatile，SettingsForms 自动接管，
//   warn 只会对 0.2.0 用户制造「面板有表单却提示未安装」的自相矛盾）。
//   保留一行注释说明 SettingsForms 接管事实即可。

// 改动 3（表单质量，fe-ui W1 延续）：describe() 投影的字段文案来自
// meta.description（实测 toJSON: {"meta":{"default":true,"description":"启用搜索
// 结果缓存","volatile":true}}）——v2.7.2 已给全部 v2.7+ 字段配了人话 description；
// 2.8.1 补齐剩余裸字段（7 个 *ApiKeyEnv、8 个 *BaseURL、3 个 *Model、
// tavilySearchDepth、enabledBackends）的 .description()，一行一个。
// 注意：v2.7.2 挂的 meta.label 在 0.2.0 表单渲染里**不被读取**（RT 表单只消费
// meta.description），label 挂载可保留（无害）但不应作为适配依据。

// 改动 4（不做）：configure({auto:true}) 不调用——auto 默认 true（:434），
// 显式调用反而引入「重复配置抛错」风险（:381），收益为零。

// 回归守卫：新增测试断言 Config.meta.volatile === true（防止未来重构误删），
// 以及 Config 每个顶层字段都有非空 description（表单质量门）。
```

## 4. C 线「settings.section 槽迁移」裁决：同一断层的另一面，但**不是同一件事**，且不该做

- C 线（compat-02-c.md B3）说的是**客户端**设置卡：settingsScope 已删 → 卡停装（websearch 2.7.3 已内置降级+面包屑）。
- 本裁决说的是**服务端**配置表单：SettingsForms 自动生成。
- 两者是 0.1.x「一张设置卡干两件事」拆开后的两面：0.2.0 上配置编辑归 SettingsForms 表单（服务端 schema 驱动），客户端只剩展示/跳转类 UI。**因此 C 线主张的「把 UnifiedSearchCardController 迁移到 settings.section 槽 + 新 config 读取面」是重复建设**——SettingsForms 表单接管编辑后，设置卡的存在价值归零。裁决：**不迁移**；client 维持 2.7.3 的停装降级即可，未来若要在面板放「打开后端控制台/密钥获取链接」类纯展示 UI，再以 settings.section 槽重入（与 open-settings 协议同族）。
- 顺带修正 C 线一句话：B3 的短期出路不是「继续依赖 shim」，而是 2.8.1 的 volatile 表单（零客户端依赖）。

## 5. 验证入口（0.2.0 真机）

装 2.8.1 后打开 Settings 面板：websearch 表单应出现且含全部 Config 字段（含 description 文案）；`dsh-api-settings-controller/lib/index.js:478` 的 describe() 应返回 websearch entry 的非空 descriptor（autoGenerate: true）。若字段缺 description 将以键名渲染——改动 3 是用户可见质量的唯一杠杆。

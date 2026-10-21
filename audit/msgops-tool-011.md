## tool action enum
## tool registration
/tmp/m/package/src/index.js:3: * 工具 message_ops，核心逻辑在 src/ops-core.js；工具注册容错（缺 services 只跳过）。
/tmp/m/package/src/index.js:22:// apply 内部容错探测，见 registerToolTolerantly。
/tmp/m/package/src/index.js:295:// 核心操作：HTTP 与 message_ops 工具共用（返回普通对象，失败抛 OpsError）
/tmp/m/package/src/index.js:774:// Agent 工具 message_ops（容错注册）
/tmp/m/package/src/index.js:778: * 构造 message_ops 工具定义。defineTool 由调用方注入（@deepseek-ai/dsh-tools），
/tmp/m/package/src/index.js:784:    name: "message_ops",
/tmp/m/package/src/index.js:860:function registerToolTolerantly(ctx) {
/tmp/m/package/src/index.js:1062:  registerToolTolerantly(ctx);
/tmp/m/package/src/ops-core.js:9: * HTTP 路由（src/index.js）与 Agent 工具 message_ops 共用这里的函数，
## index branch/export refs
19:export const name = "dsh-message-ops";
23:export const inject = [];
612:export const _internals = { opsList, opsSearch, loadDerived, loadSearchCorpus, derivedCache, searchCache };
782:export function createMessageOpsTool({ defineTool, ops, ctx }) {
786:      "Manage DSH conversation messages: list messages with visibility, revert to a seq (surface replace shadows the tail), delete a single message, restore (replay) messages shadowed by a previous revert. These are the message-level operations dsh does NOT provide natively (use the built-in session/fork for branching and /export for archives). Sessions must not be running for mutating actions.",
890:export function apply(ctx) {
1065:export default { name, inject, apply };

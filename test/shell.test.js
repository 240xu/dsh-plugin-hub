import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { apply, listActiveRows, listDegraded, _resetDegraded } from "../src/shell.js";

// 自包含 fixtures（随 git 提交，干净检出即可跑）：以 file: URL 导入，
// 不依赖 node_modules 布局——真实安装下 shell 的 spec 是裸包名，
// 解析语义相同（都是 ESM 动态 import）。
const FIXTURE = (name) => pathToFileURL(join(import.meta.dirname, "fixtures", name, "index.js")).href;

// 最小 cordis 风格 ctx 桩：effect 登记清理项、inject 捕获子 fiber、plugin 记录挂载。
function makeCtx() {
  const mounted = [];
  const effects = [];
  const injected = [];
  const ctx = {
    mounted, effects, injected,
    effect(fn, label) { effects.push({ fn, label }); },
    // 与 cordis 语义一致：ctx.plugin 同步调用插件 apply（同步抛错由壳的 try 捕获）
    plugin(p, config) { const r = typeof p === "function" ? p(ctx, config) : p.apply(ctx, config); mounted.push({ name: p?.name ?? "anon", config }); return Promise.resolve(r); },
    inject(_, fn) { injected.push(fn); },
  };
  return ctx;
}

test("good plugin mounts through the shell", async () => {
  _resetDegraded();
  const ctx = makeCtx();
  await apply(ctx, { plugin: FIXTURE("mock-good") });
  assert.equal(ctx.mounted.length, 1);
  assert.equal(ctx.mounted[0].name, "mock-good");
  assert.equal(listDegraded().length, 0);
});

test("import failure degrades the row without rethrowing", async () => {
  _resetDegraded();
  const ctx = makeCtx();
  await assert.doesNotReject(() => apply(ctx, { plugin: FIXTURE("mock-badimport") }));
  assert.equal(ctx.mounted.length, 0);
  const d = listDegraded();
  assert.equal(d.length, 1);
  assert.equal(d[0].plugin, FIXTURE("mock-badimport"));
  assert.equal(d[0].stage, "import");
});

test("bad shape degrades instead of aborting", async () => {
  _resetDegraded();
  const ctx = makeCtx();
  await apply(ctx, { plugin: FIXTURE("mock-badshape") });
  assert.equal(ctx.mounted.length, 0);
  assert.equal(listDegraded()[0].stage, "shape");
});

test("start throw degrades, sibling rows still mount (isolation semantics)", async () => {
  _resetDegraded();
  const ctxA = makeCtx();
  await apply(ctxA, { plugin: FIXTURE("mock-badstart") });
  assert.equal(ctxA.mounted.length, 0);
  const ctxB = makeCtx();
  await apply(ctxB, { plugin: FIXTURE("mock-good") });
  assert.equal(ctxB.mounted.length, 1);
  assert.equal(listDegraded().find((d) => d.stage === "start").plugin, FIXTURE("mock-badstart"));
});

test("bare-row / empty config mounts quietly (override shape)", async () => {
  _resetDegraded();
  for (const config of [undefined, {}]) {
    const ctx = makeCtx();
    await apply(ctx, config);
    assert.equal(ctx.mounted.length, 0);
    assert.equal(listDegraded().length, 0);
  }
});

test("health route registers via nested webServer inject fiber", async () => {
  _resetDegraded();
  const ctx = makeCtx();
  await apply(ctx, { plugin: FIXTURE("mock-good") });
  assert.equal(ctx.injected.length, 1);
  // 模拟 webServer 服务迟到后 fiber 执行
  const fakeWs = { register: (route) => { return () => {}; } };
  let subWebServer;
  ctx.inject = (deps, fn) => { subWebServer = fn({ webServer: fakeWs }); };
  ctx.injected.forEach((fn) => fn({ webServer: fakeWs }));
  assert.ok(ctx.effects.some((e) => String(e.label).includes("health route")));
});

// webServer 立即就绪的 ctx：直接登记路由，便于调用 handler 断言。
function makeCtxWithWebServer() {
  const routes = new Map();
  const effects = [];
  const webServer = {
    register(route) {
      routes.set(route.path, route);
      return () => routes.delete(route.path);
    },
  };
  const ctx = {
    routes,
    effects,
    effect(fn, label) { effects.push({ fn, label }); },
    plugin() { return Promise.resolve(); },
    inject(deps, fn) { if (deps.includes("webServer")) fn({ webServer }); },
  };
  return ctx;
}

async function callRoute(route, request = {}) {
  let status = 0;
  let body = "";
  const res = {
    writeHead(code) { status = code; },
    end(chunk) { body = String(chunk ?? ""); },
  };
  await route.handler(request, res);
  return { status, body, json: () => JSON.parse(body) };
}

test("active-row ledger records a mounted row and drops it on dispose", async () => {
  _resetDegraded();
  const ctx = makeCtxWithWebServer();
  await apply(ctx, { plugin: FIXTURE("mock-good") });
  assert.deepEqual(listActiveRows(), [FIXTURE("mock-good")]);
  const cleanup = ctx.effects.find((entry) => String(entry.label).includes("active row"));
  assert.ok(cleanup, "active row cleanup effect missing");
  cleanup.fn()();
  assert.deepEqual(listActiveRows(), []);
});

test("active-row ledger keeps a degraded row visible to the browser half", async () => {
  _resetDegraded();
  const ctx = makeCtxWithWebServer();
  await apply(ctx, { plugin: FIXTURE("mock-badimport") });
  assert.deepEqual(listActiveRows(), [FIXTURE("mock-badimport")]);
  assert.equal(listDegraded()[0].plugin, FIXTURE("mock-badimport"));
});

test("active-row ledger refcounts duplicate rows", async () => {
  _resetDegraded();
  const ctxA = makeCtxWithWebServer();
  const ctxB = makeCtxWithWebServer();
  await apply(ctxA, { plugin: FIXTURE("mock-good") });
  await apply(ctxB, { plugin: FIXTURE("mock-good") });
  assert.deepEqual(listActiveRows(), [FIXTURE("mock-good")]);
  ctxA.effects.find((entry) => String(entry.label).includes("active row")).fn()();
  assert.deepEqual(listActiveRows(), [FIXTURE("mock-good")]);
  ctxB.effects.find((entry) => String(entry.label).includes("active row")).fn()();
  assert.deepEqual(listActiveRows(), []);
});

test("rows route serves active rows to remote browsers without the loopback fence", async () => {
  _resetDegraded();
  const ctx = makeCtxWithWebServer();
  await apply(ctx, { plugin: FIXTURE("mock-good") });
  const route = ctx.routes.get("/api/dsh-suite/rows");
  assert.ok(route, "rows route missing");
  const response = await callRoute(route, {
    socket: { remoteAddress: "203.0.113.5" },
    headers: { host: "dsh.example" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json(), { ok: true, children: [FIXTURE("mock-good")] });
});

test("degraded route stays loopback- and Host-fenced", async () => {
  _resetDegraded();
  const ctx = makeCtxWithWebServer();
  await apply(ctx, { plugin: FIXTURE("mock-good") });
  const route = ctx.routes.get("/api/dsh-suite/degraded");
  assert.ok(route, "degraded route missing");
  const remote = await callRoute(route, {
    socket: { remoteAddress: "203.0.113.5" },
    headers: { host: "127.0.0.1" },
  });
  assert.equal(remote.status, 403);
  const rebinding = await callRoute(route, {
    socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "evil.example" },
  });
  assert.equal(rebinding.status, 403);
  const local = await callRoute(route, {
    socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "127.0.0.1:3999" },
  });
  assert.equal(local.status, 200);
  assert.deepEqual(local.json(), { ok: true, degraded: [] });
});

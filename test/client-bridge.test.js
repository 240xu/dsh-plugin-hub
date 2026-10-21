import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const BUNDLE = join(import.meta.dirname, "..", "client", "index.js");
const SUITE = "@240xu/dsh-plugin-hub";
const CHILD = {
  messageOps: { name: "@240xu/dsh-message-ops", moduleId: "@240xu/dsh-plugin-hub/client/message-ops" },
  websearch: { name: "@240xu/dsh-websearch", moduleId: "@240xu/dsh-plugin-hub/client/websearch" },
};

function loadBundle({ entries = [], fetchImpl } = {}) {
  const registrations = new Map();
  const boot = { entries };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    URL,
    Promise,
    fetch: fetchImpl ?? (async () => {
      throw new Error("offline");
    }),
    __DSH_BOOT__: boot,
  };
  sandbox.window = {
    __DSH_BOOT__: boot,
    __ModuleLoader__: {
      load(registration) {
        registrations.set(registration.id, registration);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(BUNDLE, "utf8"), sandbox, { filename: BUNDLE });
  return { registrations };
}

function suiteFace(registrations) {
  const registration = registrations.get(SUITE);
  assert.ok(registration, "suite graph registration missing");
  const face = registration.factory((id) => {
    throw new Error(`factory must not require ${id}`);
  });
  assert.equal(typeof face.apply, "function");
  assert.equal(face.inject?.length ?? 0, 0);
  return face;
}

function activeRows(children) {
  return async () => ({
    ok: true,
    async json() {
      return { ok: true, children };
    },
  });
}

function makeCtx({ throwFor, rejectFor } = {}) {
  const mounted = [];
  return {
    mounted,
    plugin(definition) {
      if (definition.name === throwFor) throw new Error(`boom ${definition.name}`);
      if (definition.name === rejectFor) return Promise.reject(new Error(`reject ${definition.name}`));
      mounted.push(definition);
      return Promise.resolve();
    },
    effect() {},
  };
}

function fakeCreate(child) {
  return {
    default: {
      apply() {},
      inject: child.name === CHILD.websearch.name ? ["slots", "locale"] : ["slots"],
    },
  };
}

test("composed bundle registers exactly one suite graph entry", () => {
  const { registrations } = loadBundle();
  assert.deepEqual([...registrations.keys()], [SUITE]);
});

test("folded child bundles capture a factory without materializing it", () => {
  const { registrations } = loadBundle();
  const face = suiteFace(registrations);
  assert.deepEqual(
    [...face.__test.CHILDREN].map((child) => [child.name, child.moduleId]),
    [
      [CHILD.messageOps.name, CHILD.messageOps.moduleId],
      [CHILD.websearch.name, CHILD.websearch.moduleId],
    ],
  );
  for (const child of face.__test.CHILDREN) {
    assert.equal(typeof child.capture(), "function", `${child.name} did not register a factory`);
  }
});

test("suite bridge mounts only rows reported active by the host ledger", async () => {
  const { registrations } = loadBundle({ fetchImpl: activeRows([CHILD.messageOps.name]) });
  const face = suiteFace(registrations);
  const ctx = makeCtx();
  await face.__test.mountChildren(ctx, { create: fakeCreate });
  assert.deepEqual(ctx.mounted.map((entry) => entry.name), [CHILD.messageOps.name]);
  assert.deepEqual([...ctx.mounted[0].inject], ["slots"]);
});

test("rows-route failure fails open and mounts every folded child", async () => {
  const { registrations } = loadBundle({
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  const face = suiteFace(registrations);
  const ctx = makeCtx();
  await face.__test.mountChildren(ctx, { create: fakeCreate });
  assert.deepEqual(
    ctx.mounted.map((entry) => entry.name).sort(),
    [CHILD.messageOps.name, CHILD.websearch.name].sort(),
  );
});

test("a child that already owns a standalone graph entry is not double-mounted", async () => {
  const { registrations } = loadBundle({
    entries: [CHILD.websearch.name],
    fetchImpl: activeRows([CHILD.messageOps.name, CHILD.websearch.name]),
  });
  const face = suiteFace(registrations);
  const ctx = makeCtx();
  await face.__test.mountChildren(ctx, { create: fakeCreate });
  assert.deepEqual(ctx.mounted.map((entry) => entry.name), [CHILD.messageOps.name]);
});

test("one folded child throwing does not stop its sibling", async () => {
  const { registrations } = loadBundle({
    fetchImpl: activeRows([CHILD.messageOps.name, CHILD.websearch.name]),
  });
  const face = suiteFace(registrations);
  const ctx = makeCtx({ throwFor: CHILD.messageOps.name });
  await face.__test.mountChildren(ctx, { create: fakeCreate });
  assert.deepEqual(ctx.mounted.map((entry) => entry.name), [CHILD.websearch.name]);
});

test("a child whose fiber rejects is released for a later bridge pass", async () => {
  const { registrations } = loadBundle({
    fetchImpl: activeRows([CHILD.messageOps.name, CHILD.websearch.name]),
  });
  const face = suiteFace(registrations);
  const first = makeCtx({ rejectFor: CHILD.messageOps.name });
  await face.__test.mountChildren(first, { create: fakeCreate });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = makeCtx();
  await face.__test.mountChildren(second, { create: fakeCreate });
  assert.deepEqual(second.mounted.map((entry) => entry.name), [CHILD.messageOps.name]);
});

test("disposing the suite releases its mount claims for the next apply", async () => {
  const { registrations } = loadBundle({ fetchImpl: activeRows([CHILD.messageOps.name]) });
  const face = suiteFace(registrations);
  let dispose;
  const ctx = {
    mounted: [],
    effect(fn) { dispose = fn(); },
    plugin(definition) { this.mounted.push(definition); return Promise.resolve(); },
  };
  face.apply(ctx, { create: fakeCreate });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(ctx.mounted.map((entry) => entry.name), [CHILD.messageOps.name]);
  assert.equal(face.__test.mountedRegistry().has(CHILD.messageOps.name), true);
  dispose();
  assert.equal(face.__test.mountedRegistry().has(CHILD.messageOps.name), false);
  const second = makeCtx();
  await face.__test.mountChildren(second, { create: fakeCreate });
  assert.deepEqual(second.mounted.map((entry) => entry.name), [CHILD.messageOps.name]);
});

test("a second bridge pass does not double-mount claimed children", async () => {
  const { registrations } = loadBundle({
    fetchImpl: activeRows([CHILD.messageOps.name, CHILD.websearch.name]),
  });
  const face = suiteFace(registrations);
  const ctx = makeCtx();
  await face.__test.mountChildren(ctx, { create: fakeCreate });
  await face.__test.mountChildren(ctx, { create: fakeCreate });
  assert.deepEqual(
    ctx.mounted.map((entry) => entry.name).sort(),
    [CHILD.messageOps.name, CHILD.websearch.name].sort(),
  );
});

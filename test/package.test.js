import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

test("suite entry imports and exposes the shell plugin (bare anchor row path)", async () => {
  const mod = await import(pathToFileURL(join(ROOT, "src", "index.js")).href);
  assert.equal(mod.name, "@240xu/dsh-suite");
  assert.equal(typeof mod.apply, "function");
  assert.deepEqual(mod.inject, []);
  assert.equal(typeof mod.default.apply, "function");
});

test("package declares the browser graph entry and ships the composed client bundle", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dsh.client.platform, "web");
  assert.deepEqual(pkg.dsh.client.inject, []);
  assert.equal(pkg.exports["./client"], "./client/index.js");
  assert.ok(pkg.files.includes("client"), "client/ must be published");
  assert.ok(existsSync(join(ROOT, "client", "index.js")), "client/index.js must exist");
});

test("bundle patch keeps four isolated shell rows and adds one bare suite anchor", () => {
  const patch = read("cordis.patch.yml");
  assert.match(patch, /id:\s*x240-suite\s*\n\s*name:\s*'@240xu\/dsh-suite'/);
  assert.equal(
    (patch.match(/name:\s*'@240xu\/dsh-suite\/(?:websearch|message-ops|session-lazy-view|session-search)'/g) ?? []).length,
    4,
  );
  for (const plugin of [
    "@240xu/dsh-websearch",
    "@240xu/dsh-message-ops",
    "@240xu/dsh-session-lazy-view",
    "@240xu/dsh-session-search",
  ]) {
    assert.ok(patch.includes(`plugin: '${plugin}'`), `missing shell row for ${plugin}`);
  }
});

test("composed client bundle is in sync with the installed child clients", () => {
  const result = spawnSync(process.execPath, ["scripts/build-client.mjs", "--check"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `build --check failed:\n${result.stdout}\n${result.stderr}`);
});

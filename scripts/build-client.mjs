import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "client", "index.js");
const TEMPLATE = join(ROOT, "scripts", "client-runtime.template.js");

// Keep this list explicit: it is the published browser surface of the suite.
// Each entry's client half is inlined into the suite's single graph entry so a
// subpath shell row can never be mistaken for a client graph row.
const CHILDREN = [
  {
    name: "@240xu/dsh-message-ops",
    moduleId: "@240xu/dsh-plugin-hub/client/message-ops",
  },
  {
    name: "@240xu/dsh-websearch",
    moduleId: "@240xu/dsh-plugin-hub/client/websearch",
  },
];

const requireFromRoot = createRequire(join(ROOT, "package.json"));

function resolveChild(child) {
  const pkgPath = requireFromRoot.resolve(`${child.name}/package.json`);
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const exported = pkg.exports?.["./client"];
  const clientRelative = typeof exported === "string" ? exported : exported?.default;
  if (typeof clientRelative !== "string" || clientRelative === "") {
    throw new Error(`${child.name} does not export a ./client bundle`);
  }
  const sourcePath = join(dirname(pkgPath), clientRelative);
  if (!existsSync(sourcePath)) throw new Error(`${child.name} ./client points at a missing file: ${sourcePath}`);
  const source = readFileSync(sourcePath, "utf8")
    .replace(/^\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, "")
    .replace(/^\s*\/\/[#@]\s*sourceURL=.*$/gm, "")
    .replace(/\r\n/g, "\n");
  if (!source.includes("window.__ModuleLoader__.load")) {
    throw new Error(`${child.name} ${clientRelative} is not a __ModuleLoader__ bundle`);
  }
  const digest = createHash("sha256").update(source).digest("hex");
  return {
    ...child,
    version: pkg.version,
    relative: clientRelative,
    source,
    digest,
  };
}

function renderChild(child) {
  const missing = `[dsh-plugin-hub] ${child.name} client bundle did not register a factory`;
  return `      {
        name: ${JSON.stringify(child.name)},
        moduleId: ${JSON.stringify(child.moduleId)},
        capture() {
          let factory;
          const loader = window.__ModuleLoader__;
          const original = loader.load;
          loader.load = (registration) => { factory = registration.factory; };
          try {
${child.source}
          } finally {
            loader.load = original;
          }
          if (typeof factory !== "function") throw new Error(${JSON.stringify(missing)});
          return factory;
        },
        create(require) {
          const factory = this.capture();
          return factory(require);
        },
      }`;
}

function render(children) {
  const template = readFileSync(TEMPLATE, "utf8");
  if (!template.includes("__CHILDREN__")) throw new Error("client runtime template is missing __CHILDREN__");
  const header = `/* @240xu/dsh-plugin-hub — generated browser bundle. DO NOT EDIT.
 * Regenerate: node scripts/build-client.mjs
 * Inputs:
${children.map((child) => ` *   ${child.name}@${child.version} ${child.relative} sha256:${child.digest}`).join("\n")}
 */`;
  const entries = children.map(renderChild).join(",\n");
  return `${header}\n${template.replace("__CHILDREN__", `[\n${entries},\n    ]`)}`;
}

const children = CHILDREN.map(resolveChild);
const output = render(children);
const check = process.argv.includes("--check");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--check");
if (unknown.length > 0) {
  console.error(`build-client: unknown argument(s): ${unknown.join(" ")}`);
  process.exit(2);
}

if (check) {
  if (!existsSync(OUT)) {
    console.error("client bundle stale: client/index.js is missing; run: node scripts/build-client.mjs");
    process.exit(1);
  }
  const current = readFileSync(OUT, "utf8");
  if (current === output) {
    console.log(`client bundle up to date (${Buffer.byteLength(output)} bytes, ${children.length} folded children)`);
    process.exit(0);
  }
  const currentLines = current.split("\n");
  const outputLines = output.split("\n");
  let line = 0;
  while (line < currentLines.length && line < outputLines.length && currentLines[line] === outputLines[line]) line += 1;
  console.error(
    `client bundle stale: client/index.js (${Buffer.byteLength(current)} bytes) != expected (${Buffer.byteLength(output)} bytes); first difference at line ${line + 1}\nrun: node scripts/build-client.mjs`,
  );
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
const temporary = `${OUT}.tmp-${process.pid}`;
writeFileSync(temporary, output, { mode: 0o644 });
renameSync(temporary, OUT);
console.log(`wrote client/index.js (${Buffer.byteLength(output)} bytes, ${children.length} folded children)`);

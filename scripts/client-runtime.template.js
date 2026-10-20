window.__ModuleLoader__.load({
  id: "@240xu/dsh-suite",
  factory: (require) => {
    const CHILDREN = __CHILDREN__;
    const ROWS_PATH = "api/dsh-suite/rows";
    const FETCH_TIMEOUT_MS = 1500;
    const MOUNTED = Symbol.for("dsh-suite.mounted-client-plugins");

    function mountedRegistry() {
      const root = globalThis;
      return (root[MOUNTED] ??= new Set());
    }

    function ownClientEntryIds() {
      const entries = globalThis.__DSH_BOOT__?.entries;
      const ids = new Set();
      if (!Array.isArray(entries)) return ids;
      for (const entry of entries) {
        if (typeof entry === "string") ids.add(entry);
        else if (entry && typeof entry.id === "string") ids.add(entry.id);
      }
      return ids;
    }

    async function fetchActiveRows() {
      if (typeof fetch !== "function") return undefined;
      let timer;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const response = await fetch(ROWS_PATH, {
          credentials: "same-origin",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return undefined;
        const payload = await response.json();
        if (!payload || payload.ok !== true || !Array.isArray(payload.children)) return undefined;
        return new Set(payload.children.filter((name) => typeof name === "string"));
      } catch {
        return undefined;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }

    function pluginShape(module) {
      const face = module && module.default !== undefined ? module.default : module;
      if (typeof face === "function") return { apply: face, inject: undefined };
      if (face && typeof face.apply === "function") {
        return { apply: face.apply, inject: face.inject };
      }
      return undefined;
    }

    async function mountChildren(ctx, options = {}) {
      const active = await fetchActiveRows();
      if (options.isDisposed?.()) return;
      const own = ownClientEntryIds();
      const registry = mountedRegistry();
      const claimed = options.claimed ?? new Set();
      const create = options.create ?? ((child) => child.create(require));
      for (const child of CHILDREN) {
        if (options.isDisposed?.()) return;
        if (active !== undefined && !active.has(child.name)) continue;
        if (own.has(child.name)) continue;
        if (registry.has(child.name)) continue;
        registry.add(child.name);
        claimed.add(child.name);
        try {
          const shape = pluginShape(create(child));
          if (shape === undefined) {
            registry.delete(child.name);
            claimed.delete(child.name);
            console.error(`[dsh-suite] folded client ${child.name} has no usable plugin shape`);
            continue;
          }
          const definition = {
            name: child.name,
            inject: Array.isArray(shape.inject) ? [...shape.inject] : [],
            apply: shape.apply,
          };
          const fiber = ctx.plugin(definition);
          Promise.resolve(fiber).then(undefined, (error) => {
            registry.delete(child.name);
            claimed.delete(child.name);
            console.error(`[dsh-suite] folded client ${child.name} failed to start:`, error);
          });
        } catch (error) {
          registry.delete(child.name);
          claimed.delete(child.name);
          console.error(`[dsh-suite] folded client ${child.name} failed to mount:`, error);
        }
      }
    }

    function apply(ctx, options = {}) {
      const claimed = new Set();
      let disposed = false;
      try {
        ctx.effect(() => () => {
          disposed = true;
          const registry = mountedRegistry();
          for (const name of claimed) registry.delete(name);
          claimed.clear();
        }, "dsh-suite: client mount claims");
      } catch (error) {
        console.warn("[dsh-suite] failed to register client mount cleanup:", error);
      }
      void mountChildren(ctx, { ...options, claimed, isDisposed: () => disposed }).catch((error) => {
        console.error("[dsh-suite] folded client bridge failed:", error);
      });
    }

    return {
      apply,
      inject: [],
      __test: { CHILDREN, mountChildren, fetchActiveRows, ownClientEntryIds, mountedRegistry },
    };
  },
});

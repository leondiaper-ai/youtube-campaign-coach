const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (name) => {
    if (name === "next/navigation")
      return { usePathname: () => "/labels/partisan", useRouter:()=>({refresh(){}}) };
    if (name === "next/link")
      return {
        __esModule: true,
        default: ({ children, ...props }) =>
          React.createElement("a", props, children),
      };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/")
        ? path.resolve("src", name.slice(2))
        : path.resolve(path.dirname(file), name);
      return load(target + (fs.existsSync(target + ".ts") ? ".ts" : ".tsx"));
    }
    return require(name);
  };
  new Function("require", "module", "exports", code)(req, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}

load('src/lib/coach/__tests__/landing.test.ts');

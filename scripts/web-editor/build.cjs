const esbuild = require("esbuild"),
  fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const root = path.resolve(__dirname, "../.."),
  vendor = path.join(root, "apps/web_studio/static/vendor"),
  modules = path.join(__dirname, "node_modules");
fs.mkdirSync(vendor, { recursive: true });
const builds = [
  ["monaco-entry.js", "monaco.js"],
  ["parsers-entry.js", "parsers.js"],
];
const patchedSanitizer = {
  name: "patched-monaco-dompurify",
  setup(build) {
    build.onResolve({ filter: /\/dompurify\/dompurify\.js$/ }, () => ({
      path: path.join(modules, "dompurify/dist/purify.es.mjs"),
    }));
  },
};
(async () => {
  for (const [entry, out] of builds)
    await esbuild.build({
      entryPoints: [path.join(__dirname, entry)],
      bundle: true,
      plugins: [patchedSanitizer],
      minify: true,
      format: "iife",
      target: "es2020",
      outfile: path.join(vendor, out),
      loader: { ".ttf": "file" },
      assetNames: "fonts/[name]-[hash]",
      logLevel: "warning",
    });
  for (const [label, entry] of Object.entries({
    editor: "vs/editor/editor.worker.js",
    html: "vs/language/html/html.worker.js",
    css: "vs/language/css/css.worker.js",
    json: "vs/language/json/json.worker.js",
    typescript: "vs/language/typescript/ts.worker.js",
  }))
    await esbuild.build({
      entryPoints: [path.join(modules, "monaco-editor/esm", entry)],
      bundle: true,
      plugins: [patchedSanitizer],
      minify: true,
      format: "iife",
      target: "es2020",
      outfile: path.join(vendor, "workers", label + ".js"),
      logLevel: "warning",
    });
  fs.copyFileSync(
    path.join(modules, "grapesjs/dist/grapes.min.js"),
    path.join(vendor, "grapes.js"),
  );
  fs.copyFileSync(
    path.join(modules, "grapesjs/dist/css/grapes.min.css"),
    path.join(vendor, "grapes.css"),
  );
  const licenses = path.join(vendor, "licenses");
  fs.mkdirSync(licenses, { recursive: true });
  const metadata = [];
  for (const name of [
    "grapesjs",
    "monaco-editor",
    "parse5",
    "css-tree",
    "es-module-lexer",
    "backbone",
    "backbone-undo",
    "underscore",
    "entities",
    "mdn-data",
    "source-map-js",
    "@vscode/vscode-languagedetection",
    "dompurify",
    "marked",
    "html-entities",
    "promise-polyfill",
    "codemirror",
    "codemirror-formatting",
  ]) {
    const dir = path.join(modules, name);
    if (!fs.existsSync(dir)) continue;
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf8"),
    );
    const candidate = fs
      .readdirSync(dir)
      .find((f) => /^licen[sc]e(?:\.|$)/i.test(f));
    let fallback = null;
    if (name === "backbone-undo")
      fallback = fs
        .readFileSync(path.join(dir, "README.md"), "utf8")
        .split("## License (MIT License)")[1];
    if (name === "codemirror-formatting")
      fallback =
        "codemirror-formatting " +
        pkg.version +
        " declares MIT in package.json and is derived from the CodeMirror formatting addon. Upstream does not ship a separate LICENSE.\nRepository: " +
        pkg.repository.url +
        "\n" +
        fs.readFileSync(path.join(dir, "README.md"), "utf8") +
        "\nCodeMirror upstream license:\n" +
        fs.readFileSync(path.join(modules, "codemirror/LICENSE"), "utf8");
    if (fallback)
      fs.writeFileSync(path.join(licenses, name + ".txt"), fallback);
    if (candidate)
      fs.copyFileSync(
        path.join(dir, candidate),
        path.join(licenses, name.replaceAll("/", "_") + ".txt"),
      );
    fs.chmodSync(path.join(licenses, name.replaceAll("/", "_") + ".txt"), 0o644);
    metadata.push({
      name,
      version: pkg.version,
      license: pkg.license,
      license_file:
        candidate || fallback
          ? "licenses/" + name.replaceAll("/", "_") + ".txt"
          : null,
    });
  }
  const notices = path.join(modules, "monaco-editor/ThirdPartyNotices.txt");
  if (fs.existsSync(notices))
    fs.copyFileSync(
      notices,
      path.join(licenses, "monaco-ThirdPartyNotices.txt"),
    );
  const files = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name !== "NOTICE.json") {
        const data = fs.readFileSync(full);
        files[path.relative(vendor, full).replaceAll("\\", "/")] = {
          sha256: crypto.createHash("sha256").update(data).digest("hex"),
          bytes: data.length,
        };
      }
    }
  }
  walk(vendor);
  fs.writeFileSync(
    path.join(vendor, "NOTICE.json"),
    JSON.stringify(
      {
        generated: "2026-10-31",
        packages: metadata,
        files,
        total_bytes: Object.values(files).reduce((a, f) => a + f.bytes, 0),
        bundledDomPurify:
          "3.4.17 (Monaco internal import redirected by esbuild adapter)",
        notes: [
          "Offline build; no React/Vue frontend added.",
          "GrapesJS backbone-undo is transitive/deprecated; Agata uses its own patch-command history.",
          "No Webstudio, OmniTune, codi.link or proprietary SDK code/assets included.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Vendor bytes",
    Object.values(files).reduce((a, f) => a + f.bytes, 0),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

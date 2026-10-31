const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
global.self = globalThis;
require("../apps/web_studio/static/vendor/parsers.js");
require("../apps/web_studio/static/js/document.js");
function document() {
  const source =
    '<!doctype html><html><head><!-- preserve head --><link rel="stylesheet" href="css/base.css"></head><body><main data-agata-id="main"><section data-agata-id="row"><p data-agata-id="a">A</p><p data-agata-id="b">B</p></section><ul data-agata-id="list"><li data-agata-id="item">Item</li></ul></main><script type="module">/* untouched */ const x = "<div>";</script></body></html>';
  return new AgataWebDomain.WebDocument(
    {
      project: {
        id: "test",
        web_document: { version: 1, entry: "index.html" },
      },
      revision: 1,
      files: {
        "index.html": { encoding: "utf8", content: source, sha256: "html" },
        "css/base.css": {
          encoding: "utf8",
          content:
            "/* untouched CSS */ .row { display: flex; gap: var(--gap) !important; } @media(width > 700px){.row{display:grid}}",
          sha256: "css",
        },
      },
    },
    AgataWebParsers,
  );
}
test("five logical inserts undo one at a time and preserve imported scripts/comments", () => {
  const d = document(),
    original = d.text("index.html");
  for (let i = 0; i < 5; i++)
    d.insert("index.html", "main", "<div>Action " + i + "</div>");
  d.history.undo();
  assert(d.text("index.html").includes("Action 3"));
  assert(!d.text("index.html").includes("Action 4"));
  for (let i = 0; i < 4; i++) d.history.undo();
  assert.equal(d.text("index.html"), original);
  for (let i = 0; i < 5; i++) d.history.redo();
  assert(d.text("index.html").includes("Action 4"));
});
test("structural reordering retains flex/grid source and stable identities", () => {
  const d = document(),
    css = d.text("css/base.css");
  d.move("b", "row", "a");
  assert.deepEqual(
    d.node("row").children.map((n) => n.id),
    ["b", "a"],
  );
  assert.equal(d.text("css/base.css"), css);
  assert(!d.text("index.html").includes("position:absolute"));
  d.history.undo();
  assert.deepEqual(
    d.node("row").children.map((n) => n.id),
    ["a", "b"],
  );
});
test("invalid content models and ancestor cycles reject without editing", () => {
  const d = document(),
    original = d.text("index.html");
  assert.throws(
    () => d.insert("index.html", "list", "<div>Invalid</div>"),
    /inválida/,
  );
  assert.throws(() => d.move("main", "row"), /si mesmo/);
  assert.equal(d.text("index.html"), original);
});
test("visual CSS overrides preserve unknown rules, comments, important and media source", () => {
  const d = document(),
    css = d.text("css/base.css");
  d.style("a", "border-radius", "var(--radius-lg)");
  assert.equal(d.text("css/base.css"), css);
  assert(d.text("css/overrides.css").includes("var(--radius-lg)"));
  assert(d.text("index.html").includes("data-agata-overrides"));
  d.history.undo();
  assert(!d.files.has("css/overrides.css"));
  assert(!d.text("index.html").includes("data-agata-overrides"));
});
test("compound actions undo atomically and failed transactions roll back", () => {
  const d = document(),
    original = d.text("index.html");
  d.transaction("Center", () => {
    d.style("row", "justify-content", "center");
    d.style("row", "align-items", "center");
  });
  assert.equal(d.history.past.length, 1);
  d.history.undo();
  assert.equal(d.text("index.html"), original);
  assert(!d.files.has("css/overrides.css"));
  assert.throws(() =>
    d.transaction("Failure", () => {
      d.style("row", "color", "red");
      d.move("main", "row");
    }),
  );
  assert.equal(d.text("index.html"), original);
  assert(!d.files.has("css/overrides.css"));
});
test("binary assets can be imported renamed removed and undone as commands", () => {
  const d = document();
  d.command("Asset", [
    {
      file: "assets/a.png",
      before: null,
      after: "YWJj",
      afterEncoding: "base64",
    },
  ]);
  d.rename("assets/a.png", "assets/b.png");
  assert.equal(d.files.get("assets/b.png").encoding, "base64");
  d.removeFile("assets/b.png");
  d.history.undo();
  assert.equal(d.files.get("assets/b.png").content, "YWJj");
  d.history.undo();
  assert.equal(d.files.get("assets/a.png").encoding, "base64");
});

test("folder moves patch recognized local references atomically and keep binary assets", async () => {
  await AgataWebParsers.ready;
  require("../apps/web_studio/static/js/references.js");
  const d = document();
  d.references = AgataWebReferences;
  d.edit("js/main.js", "import './modules/a.js'; // retain comment");
  d.edit("js/modules/a.js", "export const value=1;");
  d.command("Asset", [
    {
      file: "js/modules/art.png",
      before: null,
      after: "YWJj",
      afterEncoding: "base64",
    },
  ]);
  d.editMetadata("Folder", (m) => (m.folders = ["js/modules"]));
  d.renamePath("js/modules", "shared");
  assert(d.text("js/main.js").includes("../shared/a.js"));
  assert.equal(d.files.get("shared/art.png").encoding, "base64");
  assert(d.metadata.folders.includes("shared"));
  d.history.undo();
  assert(d.files.has("js/modules/art.png"));
  assert(d.text("js/main.js").includes("./modules/a.js"));
  assert(d.metadata.folders.includes("js/modules"));
});

test("component instances have scoped CSS and can detach without changing the definition", () => {
  const d = document();
  d.edit(
    "components/nav.html",
    '<nav data-agata-id="definition"><a href="/index.html" data-agata-id="link">Home</a></nav>',
  );
  d.insert(
    "index.html",
    "main",
    '<agata-include src="components/nav.html"></agata-include>',
  );
  const instance = [...d.nodes.values()].find((n) => n.tag === "agata-include");
  d.style("link", "color", "red", "", "", instance.id);
  assert(
    d
      .text("css/overrides.css")
      .includes('[data-agata-id="' + instance.id + '"] [data-agata-id="link"]'),
  );
  const source = d.text("components/nav.html");
  d.detachComponent(instance.id);
  assert.equal(d.text("components/nav.html"), source);
  assert(!d.nodes.has(instance.id));
  d.history.undo();
  assert(d.nodes.has(instance.id));
  assert.equal(
    d.toInterfaceModel().nodes.find((n) => n.id === instance.id).type,
    "component-instance",
  );
});

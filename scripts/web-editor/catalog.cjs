const fs = require("fs"),
  path = require("path"),
  { pathToFileURL } = require("url");
(async () => {
  const root = path.resolve(__dirname, "../.."),
    source = path.join(
      __dirname,
      "node_modules/monaco-editor/esm/external/vscode-html-languageservice/lib/esm/languageFacts/data/webCustomData.js",
    );
  const data = await import(pathToFileURL(source));
  const provider = data.htmlData || data.default || Object.values(data)[0];
  const categories = {
    Document: "html head body title meta link base".split(" "),
    Layout:
      "header main footer nav section article aside search address hgroup".split(
        " ",
      ),
    Text: "h1 h2 h3 h4 h5 h6 p span strong em small mark code pre blockquote a br hr b i u s sub sup abbr cite q time data kbd samp var wbr del ins dfn ruby rt rp bdi bdo".split(
      " ",
    ),
    Lists: "ul ol li dl dt dd menu".split(" "),
    Forms:
      "form input label button select option optgroup textarea fieldset legend output progress meter datalist".split(
        " ",
      ),
    Media:
      "img picture source video audio track canvas svg map area figure figcaption".split(
        " ",
      ),
    Tables: "table thead tbody tfoot tr td th caption colgroup col".split(" "),
    Interactive: "details summary dialog".split(" "),
    Development: "script style template slot noscript".split(" "),
    Advanced: "iframe object embed math".split(" "),
  };
  const deprecated = new Set(
      "acronym applet basefont bgsound big blink center content dir font frame frameset image keygen marquee menuitem nobr noembed noframes param plaintext rb rtc shadow strike tt xmp".split(
        " ",
      ),
    ),
    voids = new Set(
      "area base br col embed hr img input link meta source track wbr".split(
        " ",
      ),
    );
  const names = new Set([
    ...(provider.tags || []).map((t) => t.name),
    ...Object.values(categories).flat(),
    ...deprecated,
  ]);
  const elements = [...names].sort().map((name) => ({
    name,
    category:
      Object.entries(categories).find(([, tags]) => tags.includes(name))?.[0] ||
      "Advanced",
    deprecated: deprecated.has(name),
    visual:
      !categories.Document.includes(name) &&
      !categories.Development.includes(name) &&
      !deprecated.has(name),
    void: voids.has(name),
    reference:
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/" +
      name,
  }));
  const target = path.join(root, "apps/web_studio/static/model");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(
    path.join(target, "html-elements.json"),
    JSON.stringify(
      {
        version: "2026.10.31",
        source:
          "Monaco 0.57.0 / vscode-html-languageservice webCustomData tag names; MDN/WHATWG reference; Agata category/content metadata original",
        license: "MIT metadata; names only, no copied documentation text",
        elements,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Versioned HTML elements", elements.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

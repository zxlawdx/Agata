/* Distribui Fabric.js 5.3.0 localmente, sem CDN durante o uso do Yara. */
const fs = require("node:fs");
const path = require("node:path");
const source = require.resolve("fabric/dist/fabric.js");
const output = path.resolve(__dirname, "../apps/sketch_editor/static/vendor/fabric.js");
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.copyFileSync(source, output);
console.log("Fabric copiado para:", output);

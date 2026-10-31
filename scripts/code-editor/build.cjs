/* Development only. Runtime loads the committed IIFE and never invokes npm. */
const esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['scripts/code-editor/editor.js'],outfile:'apps/android_designer/static/vendor/codemirror.js',nodePaths:[...((process.env.NODE_PATH||'').split(':')),require('node:path').join(__dirname,'node_modules')],bundle:true,minify:true,format:'iife',platform:'browser',target:['es2020'],legalComments:'eof'});

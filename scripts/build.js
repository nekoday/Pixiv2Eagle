const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: [path.resolve(__dirname, '../src/index.js')],
  outfile: path.resolve(__dirname, '../dist/Pixiv.js'),
  bundle: true,
  format: 'iife',
  minify: false,
  sourcemap: false,
  banner: {
    js: `// ==UserScript==
// @name         Re_Pixiv2Eagle
// @namespace    https://github.com/juzijun233/Re_Pixiv2Eagle
// @version      0.0.1
// @description  Save Pixiv artworks to Eagle
// @author       juzijun233
// @match        https://www.pixiv.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @connect      localhost
// @connect      pixiv.net
// @connect      i.pximg.net
// @license      MIT
// ==/UserScript==
`,
  },
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('[build] watching for changes...');
  } else {
    await esbuild.build(config);
    console.log('[build] done');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

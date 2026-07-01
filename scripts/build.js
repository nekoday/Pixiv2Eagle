const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const root = path.resolve(__dirname, '..');
const banner = fs.readFileSync(path.join(root, 'src/header.txt'), 'utf8');

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: [path.join(root, 'src/index.js')],
  outfile: path.join(root, 'dist/RePixiv2Eagle.js'),
  bundle: true,
  format: 'iife',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  banner: { js: banner },
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('[build] watching for changes...');
  } else {
    await esbuild.build(config);
    console.log('[build] done -> dist/RePixiv2Eagle.js');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

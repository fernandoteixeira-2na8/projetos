import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

const options = {
  entryPoints: {
    background: 'src/background/index.ts',
    content: 'src/content/index.ts',
    panel: 'src/panel/panel.ts',
    options: 'src/options/options.ts',
  },
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  // Sem splitting: o service worker do MV3 carrega um arquivo so.
  splitting: false,
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
};

async function copyStatic() {
  await cp('src/manifest.json', `${outdir}/manifest.json`);
  await cp('src/panel/panel.html', `${outdir}/panel.html`);
  await cp('src/panel/panel.css', `${outdir}/panel.css`);
  await cp('src/options/options.html', `${outdir}/options.html`);
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  await copyStatic();
  console.log('[build] observando alteracoes...');
} else {
  await build(options);
  await copyStatic();
  console.log(`[build] pronto em ${outdir}/`);
}

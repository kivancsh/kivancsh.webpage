import { defineConfig } from 'vite';

const BUILD = Date.now().toString(36); // see url() in src/content.js

// Start the downloads the first screen waits for as soon as the HTML arrives, instead of
// after the main script has run: the 3D scene's code and the content file. (Fonts are
// left out on purpose: on a slow phone connection preloading them delayed the first paint
// more than it helped; they're small subsets and load with the stylesheet.)
function preloadCritical() {
  return {
    name: 'preload-critical',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle || {});
        const pick = (re) => files.find((f) => re.test(f));
        const tags = [];
        const stage = pick(/^assets\/stage-[^/]+\.js$/);
        if (stage) tags.push({ tag: 'link', attrs: { rel: 'modulepreload', href: `./${stage}`, crossorigin: '' }, injectTo: 'head' });
        tags.push({ tag: 'link', attrs: { rel: 'preload', href: `./content/records.json?v=${BUILD}`, as: 'fetch', crossorigin: '' }, injectTo: 'head' });
        return tags;
      },
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [preloadCritical()],
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  server: { port: 5178, host: true },
});

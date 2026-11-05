import { defineConfig } from 'vitest/config';

// Orbit Shift's fixed dev/preview port. SkyHop uses 5605; this one must not collide with it.
const PORT = 5610;

export default defineConfig({
  // Relative asset URLs: the Android WebView serves the bundle from its own origin, not from the domain root.
  base: './',
  server: {
    port: PORT,
    strictPort: true,
    host: 'localhost',
    // Gradle and the test runners write into these folders; none of it should reload the page.
    watch: { ignored: ['**/android/**', '**/artifacts/**', '**/coverage/**', '**/tests/**/output/**'] },
  },
  preview: { port: PORT, strictPort: true, host: 'localhost' },
  build: {
    target: 'es2020',
    // Phaser alone is ~1.2 MB minified; the game is one bundle that is loaded from the device, never a network.
    chunkSizeWarningLimit: 1800,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.ts'],
      // Three documented exceptions, each exercised by the Playwright suite in tests/e2e instead:
      //  - src/phaser/** is the thin Phaser scene and drawing glue, which needs a real WebGL canvas;
      //  - src/main.ts is the browser entry point;
      //  - src/app/dev.ts is the development inspector, imported only behind import.meta.env.DEV (never shipped).
      exclude: ['src/main.ts', 'src/phaser/**', 'src/app/dev.ts', 'src/game/levels/data/**', 'src/**/*.d.ts'],
      thresholds: { lines: 90, statements: 90, branches: 90, functions: 90 },
    },
  },
});

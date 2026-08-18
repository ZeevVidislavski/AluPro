import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Standalone Vitest config, not merged with vite.config.js — the `@/`
// alias in this project comes from @base44/vite-plugin, which we don't
// want to depend on inside the test runner. Declaring the alias directly
// here keeps unit tests independent of that plugin's behavior.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});

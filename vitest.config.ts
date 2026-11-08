import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@baturpay/core': r('./packages/core/src/index.ts'),
      '@baturpay/simulator': r('./packages/simulator/src/index.ts'),
      '@baturpay/webhook': r('./packages/webhook/src/index.ts'),
      '@baturpay/contracts': r('./packages/contracts/src/index.ts'),
      '@baturpay/config': r('./packages/config/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**'],
    environment: 'node',
    reporters: ['default'],
    passWithNoTests: false,
  },
});

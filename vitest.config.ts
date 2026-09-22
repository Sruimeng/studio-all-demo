import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } }, test: { include: ['app/**/test/**/*.spec.ts', 'app/**/tests/**/*.spec.ts', 'app/**/*.test.mjs', 'test/**/*.spec.ts'], environment: 'node', restoreMocks: true } });

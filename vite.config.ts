import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { keystoneApi } from './server/vite-plugin.ts';

export default defineConfig({
  plugins: [react(), keystoneApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: { port: 5180, watch: { ignored: ['**/data/**'] } },
  build: { chunkSizeWarningLimit: 1600 },
  test: { include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'server/**/*.test.ts'], environment: 'node' },
} as any);

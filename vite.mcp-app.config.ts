import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(rootDir, 'mcp-apps/otp-setup'),
  plugins: [viteSingleFile()],
  build: {
    outDir: path.join(rootDir, 'dist/mcp-apps'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(rootDir, 'mcp-apps/otp-setup/index.html'),
    },
  },
});

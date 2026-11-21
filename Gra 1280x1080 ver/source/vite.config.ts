import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Збірка в один HTML-файл: демо можна відкрити подвійним кліком, без сервера.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { include: ['src/**/*.test.ts'] },
});

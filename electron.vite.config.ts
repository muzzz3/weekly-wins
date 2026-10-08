import { defineConfig } from 'electron-vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'rss-parser']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          floating: 'src/preload/floating.ts',
          dashboard: 'src/preload/dashboard.ts'
        }
      }
    }
  },
  renderer: {
    plugins: [preact()],
    build: {
      rollupOptions: {
        input: {
          floating: 'src/renderer/floating/index.html',
          dashboard: 'src/renderer/dashboard/index.html'
        }
      }
    }
  }
});

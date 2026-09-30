import { readFileSync } from 'fs';
import { defineConfig } from 'vitest/config';

const htmlAsText = {
  name: 'html-as-text',
  enforce: 'pre' as const,
  load(id: string) {
    const path = id.split('?')[0];
    if (!path.endsWith('.html')) return null;

    return `export default ${JSON.stringify(readFileSync(path, 'utf8'))};`;
  }
};

export default defineConfig({
  plugins: [htmlAsText],
  define: {
    'process.env.FINDMUSIC_BASE_URL': JSON.stringify('https://findmusic.club'),
    'process.env.FINDMUSIC_ORIGIN_PATTERN': JSON.stringify('https://*.findmusic.club/*')
  },
  test: {
    environment: 'happy-dom',

    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: ['test/**/*.bak', 'node_modules/**', 'test/setup.ts', 'test/utils.ts'],

    globals: true,

    setupFiles: ['./test/setup.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/**', 'dist/**', 'test/**', '**/*.d.ts', '**/*.config.*']
    },

    env: {
      NODE_ENV: 'test'
    }
  },

  resolve: {
    alias: {
      '@': '/src'
    }
  }
});

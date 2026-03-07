import { defineConfig } from 'tsup';

export default defineConfig(options => ({
  entry: {
    main: './src/main.ts',
    background: './src/background.ts',
    findmusic_permission: './src/findmusic_permission.ts'
  },
  format: ['iife'],
  target: 'es2022',
  platform: 'browser',
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: options.env?.NODE_ENV === 'production',
  outDir: 'dist',
  outExtension() {
    return {
      js: '.js'
    };
  },
  loader: {
    '.html': 'text',
    '.svg': 'text'
  },
  external: [],
  swc: {
    jsc: {
      target: 'es2022',
      transform: {
        useDefineForClassFields: true
      }
    }
  },
  esbuildOptions(esbuildOpts) {
    const isProduction = options.env?.NODE_ENV === 'production';
    esbuildOpts.define = {
      ...esbuildOpts.define,
      global: 'globalThis',
      'process.env.FINDMUSIC_BASE_URL': JSON.stringify(
        isProduction ? 'https://findmusic.club' : 'http://localhost:3000'
      ),
      'process.env.FINDMUSIC_ORIGIN_PATTERN': JSON.stringify(
        isProduction ? 'https://*.findmusic.club/*' : 'http://localhost:3000/*'
      )
    };
    esbuildOpts.inject = esbuildOpts.inject || [];
  },
  onSuccess: options.env?.NODE_ENV === 'development' ? 'echo "Build completed"' : undefined
}));

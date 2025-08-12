import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    main: './src/main.ts',
    background: './src/background.ts'
  },
  format: ['iife'],
  target: 'es2022',
  platform: 'browser',
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === 'production',
  outDir: 'dist',
  outExtension() {
    return {
      js: '.js',
    }
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
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      global: 'globalThis',
    }
    options.inject = options.inject || []
  },
  onSuccess: process.env.NODE_ENV === 'development' ? 'echo "Build completed"' : undefined,
})

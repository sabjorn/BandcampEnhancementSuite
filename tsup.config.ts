import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    main: './src/main.js',
    background: './src/background.js'
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
    // Browser extension compatibility
    options.define = {
      ...options.define,
      global: 'globalThis',
    }
    // Polyfill Node.js globals for browser
    options.inject = options.inject || []
  },
  // Development server for watch mode
  onSuccess: process.env.NODE_ENV === 'development' ? 'echo "Build completed"' : undefined,
})
import { defineConfig } from 'vitest/config'

export default defineConfig({
  assetsInclude: ['**/*.html'],
  test: {
    environment: 'happy-dom',
    
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'test/**/*.bak', 
      'node_modules/**',
      'test/setup.ts',
      'test/utils.ts'
    ],
    
    globals: true,
    
    setupFiles: ['./test/setup.ts'],
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
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
})

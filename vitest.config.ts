import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use happy-dom for browser-like environment (faster than jsdom)
    environment: 'happy-dom',
    
    // Include test files
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'test/**/*.bak', 
      'node_modules/**',
      // Exclude old karma test files that haven't been migrated yet
      'test/audioFeatures.js',
      'test/cart.js',
      'test/checkout.js', 
      'test/config_backend.js',
      'test/download_helper.js',
      'test/label_view.js',
      'test/label_view_backend.js',
      'test/logger.js',
      'test/player.js',
      'test/utilities.js',
      'test/waveform_backend.js',
      // Exclude setup and utils files
      'test/setup.ts',
      'test/utils.ts'
    ],
    
    // Global test functions (describe, it, expect)
    globals: true,
    
    // Setup files
    setupFiles: ['./test/setup.ts'],
    
    // Coverage configuration
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
    
    // Browser-like globals
    env: {
      NODE_ENV: 'test'
    }
  },
  
  // TypeScript path resolution
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
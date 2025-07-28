// Test setup file for Vitest
import { beforeEach, afterEach } from 'vitest'

// Mock chrome extension APIs globally
const mockChrome = {
  runtime: {
    connect: () => ({
      postMessage: () => {},
      onMessage: {
        addListener: () => {},
        removeListener: () => {}
      }
    }),
    onMessage: {
      addListener: () => {},
      removeListener: () => {}
    }
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    }
  }
}

// Make chrome available globally
Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true
})

// Clean up DOM between tests
beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  // Clean up any test nodes
  const testNodes = document.getElementById('test-nodes')
  if (testNodes) {
    testNodes.remove()
  }
  
  const pageData = document.getElementById('pagedata')
  if (pageData) {
    pageData.remove()
  }
})
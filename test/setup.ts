import { beforeEach, afterEach, vi } from 'vitest';

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
      set: () => Promise.resolve()
    }
  }
};

Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true
});

// Global fetch mock to prevent real network requests
globalThis.fetch = vi.fn().mockResolvedValue(new Response('{"mock": true}', { status: 200 }));

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  const testNodes = document.getElementById('test-nodes');
  if (testNodes) {
    testNodes.remove();
  }

  const pageData = document.getElementById('pagedata');
  if (pageData) {
    pageData.remove();
  }
});

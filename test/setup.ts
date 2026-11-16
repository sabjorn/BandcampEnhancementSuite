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
    },
    sendMessage: vi.fn().mockResolvedValue({})
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

globalThis.fetch = vi.fn().mockResolvedValue(new Response('{"mock": true}', { status: 200 }));

beforeEach(() => {
  document.body.innerHTML = '';
  if (vi.isMockFunction(globalThis.chrome?.runtime?.sendMessage)) {
    vi.mocked(globalThis.chrome.runtime.sendMessage).mockClear();
  }
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

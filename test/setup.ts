import { beforeEach, afterEach } from 'vitest';

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

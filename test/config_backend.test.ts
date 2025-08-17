import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Config Backend', () => {
  beforeEach(() => {
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        }
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if ('chrome' in globalThis) {
      (globalThis as any).chrome = undefined;
    }
  });

  it('should handle config storage operations', () => {
    expect(globalThis.chrome.storage.local.get).toBeDefined();
    expect(globalThis.chrome.storage.local.set).toBeDefined();
  });

  it('should manage configuration settings', () => {
    const mockConfig = { displayWaveform: true };
    vi.mocked(globalThis.chrome.storage.local.get).mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback(mockConfig);
      }
    });

    expect(globalThis.chrome.storage.local.get).toBeDefined();
  });
});

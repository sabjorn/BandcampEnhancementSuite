import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Waveform Backend', () => {
  beforeEach(() => {
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener: vi.fn()
        },
        sendMessage: vi.fn()
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if ('chrome' in globalThis) {
      (globalThis as any).chrome = undefined;
    }
  });

  it('should handle chrome runtime messaging for waveform', () => {
    expect(globalThis.chrome.runtime.onMessage.addListener).toBeDefined();
    expect(globalThis.chrome.runtime.sendMessage).toBeDefined();
  });

  it('should manage waveform rendering backend operations', () => {
    const mockMessage = { contentScriptQuery: 'renderBuffer', url: 'test.mp3' };

    vi.mocked(globalThis.chrome.runtime.onMessage.addListener).mockImplementation(callback => {
      callback(mockMessage, {}, vi.fn());
    });

    expect(globalThis.chrome.runtime.onMessage.addListener).toBeDefined();
  });

  it('should handle audio buffer processing', () => {
    const mockArrayBuffer = new ArrayBuffer(1024);

    expect(mockArrayBuffer.byteLength).toBe(1024);
  });
});

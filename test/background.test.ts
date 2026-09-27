import { describe, it, expect, beforeEach, vi } from 'vitest';

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
};

let dbGate = deferred();

vi.mock('../src/utilities', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/utilities')>();
  return { ...actual, getDB: vi.fn(() => dbGate.promise) };
});

const settled = async (promise: Promise<unknown>) => {
  const marker = Symbol('pending');
  return (await Promise.race([promise.then(() => 'resolved'), Promise.resolve(marker)])) !== marker;
};

describe('background service worker', () => {
  beforeEach(() => {
    vi.resetModules();
    dbGate = deferred();
    globalThis.chrome = {
      runtime: {
        onConnect: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() }
      }
    } as any;
  });

  it('registers every port and message listener without waiting on the config database', async () => {
    await import('../src/background');

    expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledTimes(5);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(5);
  });

  it('does not resolve a config read until the store has been seeded', async () => {
    await import('../src/background');
    const { getConfig } = await import('../src/background/config_backend');

    const read = getConfig();
    expect(await settled(read)).toBe(false);

    const put = vi.fn().mockResolvedValue(undefined);
    dbGate.resolve({ get: vi.fn().mockResolvedValue(undefined), put });

    expect(await read).toMatchObject({ displayWaveform: true, enablePlayedCaching: true });
    expect(put).toHaveBeenCalledWith('config', expect.objectContaining({ displayWaveform: true }), 'config');
  });

  it('seeds the config store only once across repeated reads', async () => {
    await import('../src/background');
    const { getConfig } = await import('../src/background/config_backend');

    const put = vi.fn().mockResolvedValue(undefined);
    dbGate.resolve({ get: vi.fn().mockResolvedValue({ displayWaveform: false }), put });

    await getConfig();
    await getConfig();
    await getConfig();

    expect(put).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults when the stored record is missing a newly added key', async () => {
    await import('../src/background');
    const { getConfig } = await import('../src/background/config_backend');

    dbGate.resolve({
      get: vi.fn().mockResolvedValue({ displayWaveform: false }),
      put: vi.fn().mockResolvedValue(undefined)
    });

    const config = await getConfig();

    expect(config.displayWaveform).toBe(false);
    expect(config.enablePlayedCaching).toBe(true);
  });
});

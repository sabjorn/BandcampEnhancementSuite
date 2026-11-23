import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventually } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/clients/findmusic', () => ({
  exchangeBandcampToken: vi.fn().mockResolvedValue('a-token')
}));

vi.mock('../src/theme', () => ({
  applyThemeFromConfig: vi.fn()
}));

const db = { get: vi.fn(), put: vi.fn() };

vi.mock('../src/utilities', () => ({
  getDB: vi.fn(async () => db)
}));

const storedConfig = () => ({
  displayWaveform: true,
  enableMetadataCaching: false,
  enableFetchCaching: false,
  enablePlayedCaching: false
});

const openPermissionPage = async (granted: boolean) => {
  vi.resetModules();
  vi.clearAllMocks();
  db.get.mockResolvedValue(storedConfig());
  db.put.mockResolvedValue(undefined);

  globalThis.chrome = {
    permissions: { request: vi.fn().mockResolvedValue(granted) },
    runtime: { getURL: vi.fn(() => 'icons/icon48.png') },
    tabs: { create: vi.fn() }
  } as any;
  window.close = vi.fn();

  document.body.innerHTML = `
    <img id="header-logo" />
    <div id="status"></div>
    <button id="grant-permission"></button>
    <button id="cancel-button"></button>
    <a id="privacy-link"></a>
    <a id="terms-link"></a>
  `;

  await import('../src/findmusic_permission');

  (document.getElementById('grant-permission') as HTMLButtonElement).click();
};

describe('FindMusic.club permission grant', () => {
  beforeEach(() => {
    db.get.mockReset();
    db.put.mockReset();
  });

  it('should enable all three caches once the user grants permission', async () => {
    await openPermissionPage(true);

    await eventually(() => expect(db.put).toHaveBeenCalled());
    expect(db.put).toHaveBeenCalledWith(
      'config',
      expect.objectContaining({
        enableMetadataCaching: true,
        enableFetchCaching: true,
        enablePlayedCaching: true
      }),
      'config'
    );
  });

  it('should leave the rest of the config as it found it', async () => {
    await openPermissionPage(true);

    await eventually(() => expect(db.put).toHaveBeenCalled());
    expect(db.put.mock.calls[0][1]).toMatchObject({ displayWaveform: true });
  });

  it('should send the user on to FindMusic.club with a token', async () => {
    await openPermissionPage(true);

    await eventually(() => expect(chrome.tabs.create).toHaveBeenCalled());
    expect(vi.mocked(chrome.tabs.create).mock.calls[0][0].url).toContain('bes_token=a-token');
  });

  it('should write nothing when the user denies permission', async () => {
    await openPermissionPage(false);

    await eventually(() =>
      expect((document.getElementById('status') as HTMLElement).textContent).toContain('Permission denied')
    );
    expect(db.put).not.toHaveBeenCalled();
  });
});

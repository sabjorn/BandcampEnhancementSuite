import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestConfig, toggleSetting, saveKeyboardSettings, resetKeyboardSettings } from '../src/config';
import { DEFAULT_KEYBOARD_SETTINGS } from '../src/types/keyboard';

describe('config requests', () => {
  beforeEach(() => {
    globalThis.chrome = {
      runtime: { sendMessage: vi.fn().mockResolvedValue({ displayWaveform: true }) }
    } as any;
  });

  it('should read the config', async () => {
    await expect(requestConfig()).resolves.toMatchObject({ displayWaveform: true });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'requestConfig' });
  });

  it('should toggle a setting by name and return the config that resulted', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ displayWaveform: false });

    await expect(toggleSetting('displayWaveform')).resolves.toMatchObject({ displayWaveform: false });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      contentScriptQuery: 'toggleSetting',
      setting: 'displayWaveform'
    });
  });

  it('should save keyboard settings', async () => {
    await saveKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      contentScriptQuery: 'updateKeyboardSettings',
      settings: DEFAULT_KEYBOARD_SETTINGS
    });
  });

  it('should reset keyboard settings', async () => {
    await resetKeyboardSettings();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'resetKeyboardSettings' });
  });

  it('should surface a rejected keyboard save as an error the caller can show', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ keyboardSettingsError: ['Duplicate key binding'] });

    await expect(saveKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS)).resolves.toMatchObject({
      keyboardSettingsError: ['Duplicate key binding']
    });
  });
});

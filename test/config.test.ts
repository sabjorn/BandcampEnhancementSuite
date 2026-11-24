import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toggleSetting, saveKeyboardSettings, resetKeyboardSettings, onConfigChanged } from '../src/config';
import { DEFAULT_KEYBOARD_SETTINGS } from '../src/types/keyboard';

describe('announcing a config change', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.chrome = {
      runtime: { sendMessage: vi.fn().mockResolvedValue({ displayWaveform: false }) }
    } as any;
  });

  it('should tell everything on the page what the config now is after a toggle', async () => {
    const heard: unknown[] = [];
    onConfigChanged(config => heard.push(config));

    await toggleSetting('displayWaveform');

    expect(heard).toEqual([{ displayWaveform: false }]);
  });

  it('should reach every listener, not just the first', async () => {
    const first = vi.fn();
    const second = vi.fn();
    onConfigChanged(first);
    onConfigChanged(second);

    await toggleSetting('displayWaveform');

    expect(first).toHaveBeenCalledWith({ displayWaveform: false });
    expect(second).toHaveBeenCalledWith({ displayWaveform: false });
  });

  it('should announce saved keyboard settings', async () => {
    const heard = vi.fn();
    onConfigChanged(heard);
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ keyboardSettings: DEFAULT_KEYBOARD_SETTINGS });

    await saveKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);

    expect(heard).toHaveBeenCalledWith({ keyboardSettings: DEFAULT_KEYBOARD_SETTINGS });
  });

  it('should announce a reset', async () => {
    const heard = vi.fn();
    onConfigChanged(heard);
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ keyboardSettings: DEFAULT_KEYBOARD_SETTINGS });

    await resetKeyboardSettings();

    expect(heard).toHaveBeenCalled();
  });

  it('should say nothing when the backend rejected the settings', async () => {
    const heard = vi.fn();
    onConfigChanged(heard);
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ keyboardSettingsError: ['Duplicate key binding'] });

    await saveKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);

    expect(heard).not.toHaveBeenCalled();
  });

  it('should say nothing when the request failed outright', async () => {
    const heard = vi.fn();
    onConfigChanged(heard);
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no backend'));

    await expect(toggleSetting('displayWaveform')).rejects.toThrow('no backend');

    expect(heard).not.toHaveBeenCalled();
  });
});

import { sendRequest } from './messaging';
import { KeyboardSettings } from './types/keyboard';
import type { Config, ConfigResponse, ToggleName } from './background/config_backend';

export type { Config, ConfigResponse, ToggleName };

export function requestConfig(): Promise<Config> {
  return sendRequest<Config>({ contentScriptQuery: 'requestConfig' });
}

export function toggleSetting(setting: ToggleName): Promise<Config> {
  return sendRequest<Config>({ contentScriptQuery: 'toggleSetting', setting });
}

export function saveKeyboardSettings(settings: KeyboardSettings): Promise<ConfigResponse> {
  return sendRequest<ConfigResponse>({ contentScriptQuery: 'updateKeyboardSettings', settings });
}

export function resetKeyboardSettings(): Promise<Config> {
  return sendRequest<Config>({ contentScriptQuery: 'resetKeyboardSettings' });
}

export function isKeyboardSettingsError(response: ConfigResponse): response is { keyboardSettingsError: string[] } {
  return 'keyboardSettingsError' in response;
}

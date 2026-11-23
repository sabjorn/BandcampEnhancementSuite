import { sendRequest } from './messaging';
import { KeyboardSettings } from './types/keyboard';
import type { Config, ConfigResponse, ToggleName } from './background/config_backend';

export type { Config, ConfigResponse, ToggleName };

export function requestConfig(): Promise<Config> {
  return sendRequest<Config>({ contentScriptQuery: 'requestConfig' });
}

const listeners: ((config: Config) => void)[] = [];

export function onConfigChanged(listener: (config: Config) => void): void {
  listeners.push(listener);
}

function announce<T extends ConfigResponse>(response: T): T {
  if (!('keyboardSettingsError' in response)) listeners.forEach(listener => listener(response));

  return response;
}

export async function toggleSetting(setting: ToggleName): Promise<Config> {
  return announce(await sendRequest<Config>({ contentScriptQuery: 'toggleSetting', setting }));
}

export async function saveKeyboardSettings(settings: KeyboardSettings): Promise<ConfigResponse> {
  return announce(await sendRequest<ConfigResponse>({ contentScriptQuery: 'updateKeyboardSettings', settings }));
}

export async function resetKeyboardSettings(): Promise<Config> {
  return announce(await sendRequest<Config>({ contentScriptQuery: 'resetKeyboardSettings' }));
}

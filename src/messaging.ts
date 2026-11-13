import type { Config, ToggleName } from './background/config_backend';
import type { KeyboardSettings } from './types/keyboard';

export type BesRequest =
  | { contentScriptQuery: 'queryPreviews'; ids: string[] }
  | { contentScriptQuery: 'togglePreview'; id: string }
  | { contentScriptQuery: 'markPreviewed'; id: string }
  | { contentScriptQuery: 'requestConfig' }
  | { contentScriptQuery: 'toggleSetting'; setting: ToggleName }
  | { contentScriptQuery: 'updateKeyboardSettings'; settings: KeyboardSettings }
  | { contentScriptQuery: 'resetKeyboardSettings' };

export async function sendRequest<T>(message: BesRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as T | undefined;

  if (response === undefined) throw new Error(`No backend handled ${message.contentScriptQuery}`);

  return response;
}

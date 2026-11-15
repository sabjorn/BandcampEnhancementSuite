import type { ConfigRequest } from './background/config_backend';

export type PreviewHistoryRequest =
  | { contentScriptQuery: 'queryPreviews'; ids: string[] }
  | { contentScriptQuery: 'togglePreview'; id: string }
  | { contentScriptQuery: 'markPreviewed'; id: string };

export type BesRequest = PreviewHistoryRequest | ConfigRequest;

export async function sendRequest<T>(message: BesRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as T | undefined;

  if (response === undefined) throw new Error(`No backend handled ${message.contentScriptQuery}`);

  return response;
}

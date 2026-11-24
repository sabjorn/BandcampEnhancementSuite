import type { ConfigRequest } from './background/config_backend';

export type PreviewHistoryRequest =
  | { contentScriptQuery: 'queryPreviews'; ids: string[] }
  | { contentScriptQuery: 'togglePreview'; id: string }
  | { contentScriptQuery: 'markPreviewed'; id: string };

export type BesRequest = PreviewHistoryRequest | ConfigRequest;

export interface BackendFailure {
  error: string;
}

function isFailure(response: unknown): response is BackendFailure {
  return typeof (response as BackendFailure)?.error === 'string';
}

export async function sendRequest<T>(message: BesRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as T | BackendFailure | undefined;

  if (response === undefined) throw new Error(`No backend handled ${message.contentScriptQuery}`);

  if (isFailure(response)) throw new Error(`${message.contentScriptQuery} failed: ${response.error}`);

  return response;
}

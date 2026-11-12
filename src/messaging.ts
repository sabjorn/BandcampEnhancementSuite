export type BesRequest =
  | { contentScriptQuery: 'queryPreviews'; ids: string[] }
  | { contentScriptQuery: 'togglePreview'; id: string }
  | { contentScriptQuery: 'markPreviewed'; id: string };

export async function sendRequest<T>(message: BesRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as T | undefined;

  if (response === undefined) throw new Error(`No backend handled ${message.contentScriptQuery}`);

  return response;
}

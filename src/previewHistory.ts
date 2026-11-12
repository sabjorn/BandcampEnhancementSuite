import { sendRequest } from './messaging';

export interface PreviewState {
  id: string;
  value: boolean;
}

export async function markPreviewed(id: string): Promise<void> {
  await sendRequest<PreviewState>({ contentScriptQuery: 'markPreviewed', id });
}

export async function togglePreview(id: string): Promise<boolean> {
  const state = await sendRequest<PreviewState>({ contentScriptQuery: 'togglePreview', id });

  return state.value;
}

export async function queryPreviews(ids: string[]): Promise<Record<string, boolean>> {
  if (ids.length === 0) return {};

  return await sendRequest<Record<string, boolean>>({ contentScriptQuery: 'queryPreviews', ids });
}

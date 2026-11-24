import { sendRequest } from './messaging';

export interface PreviewState {
  id: string;
  value: boolean;
}

export function setHistory(id: string, state: boolean): void {
  const historybox = document.querySelector(`[id="${id}"] .historybox`);
  if (!historybox) return;

  historybox.classList.add('follow-unfollow');
  historybox.classList.toggle('following', state);
}

export async function markPreviewed(id: string): Promise<void> {
  await sendRequest<PreviewState>({ contentScriptQuery: 'markPreviewed', id });

  setHistory(id, true);
}

export async function togglePreview(id: string): Promise<boolean> {
  const state = await sendRequest<PreviewState>({ contentScriptQuery: 'togglePreview', id });

  return state.value;
}

export async function queryPreviews(ids: string[]): Promise<Record<string, boolean>> {
  if (ids.length === 0) return {};

  return await sendRequest<Record<string, boolean>>({ contentScriptQuery: 'queryPreviews', ids });
}

import { getDB } from '../utilities';
import Logger from '../logger';

const log = new Logger();

export async function query(storeName: string, key: string): Promise<boolean> {
  const db = await getDB();
  const value = await db.get(storeName, key);

  if (value === undefined) {
    await db.put(storeName, false, key);
    return false;
  }

  return value;
}

export async function toggle(storeName: string, key: string): Promise<boolean> {
  const db = await getDB();
  const value = !(await db.get(storeName, key));

  await db.put(storeName, value, key);

  return value;
}

export async function setTrue(storeName: string, key: string): Promise<void> {
  const db = await getDB();
  await db.put(storeName, true, key);
}

async function queryAll(ids: string[]): Promise<Record<string, boolean>> {
  const states = await Promise.all(ids.map(async id => [id, await query('previews', id)] as const));

  return Object.fromEntries(states);
}

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const answer = (work: Promise<any>) => {
    work.then(sendResponse).catch((error: Error) => {
      log.error(`${request.contentScriptQuery} failed: ${error.message}`);
      sendResponse({ error: error.message });
    });
  };

  if (request.contentScriptQuery === 'queryPreviews') {
    answer(queryAll(request.ids));
    return true;
  }

  if (request.contentScriptQuery === 'togglePreview') {
    answer(toggle('previews', request.id).then(value => ({ id: request.id, value })));
    return true;
  }

  if (request.contentScriptQuery === 'markPreviewed') {
    answer(setTrue('previews', request.id).then(() => ({ id: request.id, value: true })));
    return true;
  }

  return false;
}

export async function initLabelViewBackend(): Promise<void> {
  log.info('initializing LabelViewBackend');

  chrome.runtime.onMessage.addListener(processRequest);
}

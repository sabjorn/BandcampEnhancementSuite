import { vi } from 'vitest';

// vi.waitFor polls every 50ms by default, which is most of what a wait on a settling promise
// chain costs. These waits are not about timing, so poll as fast as the loop allows.
export const eventually = <T>(check: () => T | Promise<T>, timeout = 1000): Promise<T> =>
  vi.waitFor(check, { interval: 1, timeout });

export const createPagedata = (): void => {
  const pagedata = document.createElement('div');
  pagedata.setAttribute('id', 'pagedata');
  pagedata.setAttribute('data-blob', '{"lo_querystr":"?item_id=testId&item_type="}');
  document.body.appendChild(pagedata);
};

export const createDomNodes = (tagString: string): DocumentFragment => {
  const testNodes = document.createElement('div');
  testNodes.setAttribute('id', 'test-nodes');
  document.body.appendChild(testNodes);

  const range = document.createRange();
  range.selectNode(testNodes);
  const documentFragment = range.createContextualFragment(tagString);
  document.getElementById('test-nodes')!.appendChild(documentFragment);
  return documentFragment;
};

export const cleanupTestNodes = (): void => {
  const elem = document.getElementById('test-nodes');
  if (elem) {
    elem.parentNode!.removeChild(elem);
  }
};

export function mockApiResponse(body: Record<string, any> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-type': 'application/json' }
  });
}

type ItemType = 't' | 'a';

export const stubCollection = (overrides: Record<string, any> = {}) => ({
  isAvailable: vi.fn((): boolean => true),
  isWishlisted: vi.fn((_itemType: ItemType, _itemId: number): boolean => false),
  isOwned: vi.fn((_itemType: ItemType, _itemId: number): boolean => false),
  toggleWishlisted: vi.fn(async (_itemType: ItemType, _itemId: number, _host: string): Promise<boolean> => true),
  ...overrides
});

export const createPagedata = (): void => {
  const pagedata = document.createElement('div')
  pagedata.setAttribute('id', 'pagedata')
  pagedata.setAttribute('data-blob', '{"lo_querystr":"?item_id=testId&item_type="}')
  document.body.appendChild(pagedata)
}

export const createDomNodes = (tagString: string): DocumentFragment => {
  const testNodes = document.createElement('div')
  testNodes.setAttribute('id', 'test-nodes')
  document.body.appendChild(testNodes)

  const range = document.createRange()
  range.selectNode(testNodes)
  const documentFragment = range.createContextualFragment(tagString)
  document.getElementById('test-nodes')!.appendChild(documentFragment)
  return documentFragment
}

export const cleanupTestNodes = (): void => {
  const elem = document.getElementById('test-nodes')
  if (elem) {
    elem.parentNode!.removeChild(elem)
  }
}

export function mockApiResponse(body: Record<string, any> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-type': 'application/json' }
  })
}

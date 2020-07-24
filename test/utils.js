/**
 * Pagedata creation helper
 * Used in specific tests, but needed for most since renderDom()
 * is called in the constructor.
 */

export const createPagedata = () => {
  const pagedata = document.createElement("div");
  pagedata.setAttribute("id", "pagedata");
  pagedata.setAttribute(
    "data-blob",
    '{"lo_querystr":"?item_id=testId&item_type="}'
  );
  document.body.appendChild(pagedata);
};

/**
 * DOM node creation helper
 * Makes nodes with id='test-nodes' and adds the contents
 * in `tagString` as children.
 */
export const createDomNodes = tagString => {
  const testNodes = document.createElement("div");
  testNodes.setAttribute("id", "test-nodes");
  document.body.appendChild(testNodes);

  // Make the parent of the first div in the document becomes the context node
  const range = document.createRange();
  range.selectNode(testNodes);
  var documentFragment = range.createContextualFragment(tagString);
  document.getElementById("test-nodes").appendChild(documentFragment);
  return documentFragment;
};

/**
 * DOM node cleanup helper.
 * Removes elements with id='test-nodes'
 */
export const cleanupTestNodes = () => {
  var elem = document.getElementById("test-nodes");
  if (elem) {
    elem.parentNode.removeChild(elem);
  }
};

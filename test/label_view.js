import chai from 'chai';
import sinon from 'sinon';
//import chrome from 'sinon-chrome';
import sinonChai from 'sinon-chai'
import { assert, expect } from 'chai';
chai.use(sinonChai);

import LabelView from '../src/label_view.js';

const mockPort = {
  postMessage: sinon.spy(),
  onMessage: {
    addListener: sinon.spy()
  }
};

const mockChrome = {
  runtime: {
    connect: () => mockPort
  }
}

const createDomNodes = (tagString) => {
  const testNodes = document.createElement('div')
  testNodes.setAttribute('id', 'test-nodes')
  document.body.appendChild(testNodes)

  // Make the parent of the first div in the document becomes the context node
  const range = document.createRange();
  range.selectNode(testNodes);
  var documentFragment = range.createContextualFragment(tagString);
  document.getElementById('test-nodes').appendChild(documentFragment);
  return documentFragment
}

const cleanupTestNodes = () => {
  var elem = document.getElementById('test-nodes');
  if(elem){
    elem.parentNode.removeChild(elem);
  }
}

describe.only("Label View", () => {
  let lv;
  let sandbox;
  global.chrome = mockChrome;

  beforeEach(() => {
    // Reset state before each test run
    sandbox = sinon.createSandbox();
    lv = new LabelView()
  });

  afterEach(() => {
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("setHistory()", () => {
    describe("when state is valid", () => {
      it("should do a thing", () => {
        expect(true).to.be.true;
        // Todo: what are id and state supposed to be?
      });
    });
  });

  describe("setPreviewed()", () => {
    it("should postMessage with setTrue:id", () => {
      lv.setPreviewed(1)
      expect(mockPort.postMessage).to.be.calledWith({setTrue: 1});
    });
  });

  describe("boxClicked()", () => {
    it("should postMessage with toggle:id of parent", () => {
      createDomNodes(`
        <div id="boxClickedParent">
          <div id="boxClickedChild">boxClicked() test</div>
        </div>
      `)

      const mockEvent = {
        target: document.getElementById('boxClickedChild')
      }

      lv.boxClicked(mockEvent)
      expect(mockPort.postMessage).to.be.calledWith({toggle: 'boxClickedParent'});
    });
  });

  describe("previewClicked()", () => {
    it("should call setPreviewed with the parent id", () => {
      createDomNodes(`
        <div id="previewClickedParent">
          <div id="previewClickedChild">previewClicked() test</div>
        </div>
      `)

      const mockEvent = {
        target: document.getElementById('previewClickedChild')
      }

      sandbox.stub(lv, 'setPreviewed')
      lv.previewClicked(mockEvent)
      expect(lv.setPreviewed).to.be.calledWith('previewClickedParent');
    });
  });

  describe("fillFrame()", () => {
    it("should delete .preview-frame contents", () => {
      createDomNodes(`
        <div class="music-grid-item">
          <div id="fillFrameEventTarget"></div>
          <div id="type-fillFrameTest1" class="preview-frame">
            <div class="this-should-disappear"></div>
          </div>
        </div>
      `)

      const mockEvent = {
        target: document.getElementById('fillFrameEventTarget')
      }

      lv.fillFrame(mockEvent);
      const foundElems = document.querySelectorAll('.this-should-disappear')
      expect(foundElems.length).to.equal(0);
    });

    describe("when preview is open", () => {
      describe("when previewId matches the target", () => {
        it("should set previewOpen to false", () => {
          createDomNodes(`
            <div class="music-grid-item">
              <div id="fillFrameEventTarget"></div>
              <div id="type-fillFrameTest1" class="preview-frame"></div>
            </div>
          `)

          const mockEvent = {
            target: document.getElementById('fillFrameEventTarget')
          }

          lv.previewOpen = true;
          lv.previewId = 'fillFrameTest1';
          lv.fillFrame(mockEvent);
          expect(lv.previewOpen).to.be.false;
        });
      });

      describe("when previewId does not match the target", () => {
        it("should keep previewOpen as true", () => {
          createDomNodes(`
            <div class="music-grid-item">
              <div id="fillFrameEventTarget"></div>
              <div id="type-fillFrameTest1" class="preview-frame"></div>
            </div>
          `)

          const mockEvent = {
            target: document.getElementById('fillFrameEventTarget')
          }

          lv.previewOpen = true;
          lv.previewId = 'doesnt-match-fillFrameTest1';
          lv.fillFrame(mockEvent);
          expect(lv.previewOpen).to.be.true;
        });
      });

      it("should not create an iframe", () => {
        createDomNodes(`
          <div id="fillFrameTest1" class="music-grid-item">
            <div id="fillFrameEventTarget"></div>
            <div id="type-fillFrameTest1" class="preview-frame"></div>
            <div class="historybox"></div>
          </div>
        `)

        const mockEvent = {
          target: document.getElementById('fillFrameEventTarget')
        }

        lv.previewOpen = true;
        lv.previewId = 'fillFrameTest1';
        lv.fillFrame(mockEvent);
        const foundIframe = document.querySelector('#fillFrameTest1 iframe')
        expect(foundIframe).to.be.null;
      });
    });

    describe("when preview is not open", () => {
      it("should set previewId and previewOpen", () => {
        createDomNodes(`
          <div id="fillFrameTest1" class="music-grid-item">
            <div id="fillFrameEventTarget"></div>
            <div id="type-fillFrameTest1" class="preview-frame"></div>
            <div class="historybox"></div>
          </div>
        `)

        const mockEvent = {
          target: document.getElementById('fillFrameEventTarget')
        }

        lv.previewOpen = false;
        lv.fillFrame(mockEvent);
        expect(lv.previewOpen).to.be.true;
        expect(lv.previewId).to.equal('fillFrameTest1');
      });

      describe("when it creates an iframe", () => {
        it("should singularly exist inside .preview-frame", () => {
          createDomNodes(`
            <div id="fillFrameTest1" class="music-grid-item">
              <div id="fillFrameEventTarget"></div>
              <div id="type-fillFrameTest1" class="preview-frame"></div>
              <div class="historybox"></div>
            </div>
          `)

          const mockEvent = {
            target: document.getElementById('fillFrameEventTarget')
          }

          lv.previewOpen = false;
          lv.fillFrame(mockEvent);
          const foundIframe = document.querySelectorAll('.preview-frame iframe')
          expect(foundIframe.length).to.equal(1);

          it("and have type=id in the URL", () => {
            expect(true).to.be.true;
          })
        });

        it("the iframe should have type=id in the URL", () => {
          createDomNodes(`
            <div id="fillFrameTest1" class="music-grid-item">
              <div id="fillFrameEventTarget"></div>
              <div id="type-fillFrameTest1" class="preview-frame"></div>
              <div class="historybox"></div>
            </div>
          `)

          const mockEvent = {
            target: document.getElementById('fillFrameEventTarget')
          }

          lv.previewOpen = false;
          lv.fillFrame(mockEvent);
          const foundIframe = document.querySelector('.preview-frame iframe')
          const url = foundIframe.getAttribute('src')
          expect(url).to.contain("type=fillFrameTest1");
        });
      });
    });
  });

  describe("generatePreview()", () => {
    // todo
  })

  describe("renderDom()", () => {
    // todo
  })
});

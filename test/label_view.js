import { createPagedata, createDomNodes, cleanupTestNodes } from "./utils.js";
import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
chai.use(sinonChai);

import LabelView from "../src/label_view.js";

const mockPort = {
  postMessage: sinon.spy(),
  onMessage: {
    addListener: sinon.spy()
  }
};

const mockChrome = {
  runtime: {
    connect: (_extensionId, _connectInfo) => mockPort
  }
};

describe("Label View", () => {
  let lv;
  let sandbox;
  createPagedata();

  beforeEach(() => {
    // Reset state before each test run
    sandbox = sinon.createSandbox();
    global.chrome = mockChrome;
    lv = new LabelView();

    lv.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };
  });

  afterEach(() => {
    // Preemptive removal of any test-nodes
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("setHistory()", () => {
    describe("when historybox element does not exist", () => {
      beforeEach(() => {
        createDomNodes(`
            <div id="testId" class="preview">
              <button class="NOThistorybox"></button>
            </div>
          `);
      });
      it("takes no action", () => {
        lv.setHistory("testId", true);
        const hbox = document.querySelector("#testId .NOThistorybox");
        expect(hbox.getAttribute("class")).to.not.include("following");
        expect(hbox.getAttribute("class")).to.not.include("follow-unfollow");
      });
    });
    describe("when historybox element exists", () => {
      beforeEach(() => {
        createDomNodes(`
            <div id="testId" class="preview">
              <button class="historybox"></button>
            </div>
          `);
      });
      describe("when state is true", () => {
        it("should add a class to historybox", () => {
          lv.setHistory("testId", true);
          const hbox = document.querySelector("#testId .historybox");
          expect(hbox.getAttribute("class")).to.include("following");
          expect(hbox.getAttribute("class")).to.include("follow-unfollow");
        });
      });

      describe("when state is false", () => {
        it("should add a class to historybox", () => {
          lv.setHistory("testId", false);
          const hbox = document.querySelector("#testId .historybox");
          expect(hbox.getAttribute("class")).to.not.include("following");
          expect(hbox.getAttribute("class")).to.include("follow-unfollow");
        });
      });
    });
  });

  describe("setPreviewed()", () => {
    it("should postMessage with setTrue:id", () => {
      lv.setPreviewed(1);
      expect(mockPort.postMessage).to.be.calledWith({ setTrue: 1 });
    });
  });

  describe("boxClicked()", () => {
    it("should postMessage with toggle:id of parent", () => {
      createDomNodes(`
        <div id="boxClickedParent">
          <div id="boxClickedChild">boxClicked() test</div>
        </div>
      `);

      const mockEvent = {
        target: document.getElementById("boxClickedChild")
      };

      lv.boxClicked(mockEvent);
      expect(mockPort.postMessage).to.be.calledWith({
        toggle: "boxClickedParent"
      });
    });
  });

  describe("previewClicked()", () => {
    it("should call setPreviewed with the parent id", () => {
      createDomNodes(`
        <div id="previewClickedParent">
          <div id="previewClickedChild">previewClicked() test</div>
        </div>
      `);

      const mockEvent = {
        target: document.getElementById("previewClickedChild")
      };

      sandbox.stub(lv, "setPreviewed");
      lv.previewClicked(mockEvent);
      expect(lv.setPreviewed).to.be.calledWith("previewClickedParent");
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
      `);

      const mockEvent = {
        target: document.getElementById("fillFrameEventTarget")
      };

      lv.fillFrame(mockEvent);
      const foundElems = document.querySelectorAll(".this-should-disappear");
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
          `);

          const mockEvent = {
            target: document.getElementById("fillFrameEventTarget")
          };

          lv.previewOpen = true;
          lv.previewId = "fillFrameTest1";
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
          `);

          const mockEvent = {
            target: document.getElementById("fillFrameEventTarget")
          };

          lv.previewOpen = true;
          lv.previewId = "doesnt-match-fillFrameTest1";
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
        `);

        const mockEvent = {
          target: document.getElementById("fillFrameEventTarget")
        };

        lv.previewOpen = true;
        lv.previewId = "fillFrameTest1";
        lv.fillFrame(mockEvent);
        const foundIframe = document.querySelector("#fillFrameTest1 iframe");
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
        `);

        const mockEvent = {
          target: document.getElementById("fillFrameEventTarget")
        };

        lv.previewOpen = false;
        lv.fillFrame(mockEvent);
        expect(lv.previewOpen).to.be.true;
        expect(lv.previewId).to.equal("fillFrameTest1");
      });

      describe("when it creates an iframe", () => {
        it("should singularly exist inside .preview-frame", () => {
          createDomNodes(`
            <div id="fillFrameTest1" class="music-grid-item">
              <div id="fillFrameEventTarget"></div>
              <div id="type-fillFrameTest1" class="preview-frame"></div>
              <div class="historybox"></div>
            </div>
          `);

          const mockEvent = {
            target: document.getElementById("fillFrameEventTarget")
          };

          lv.previewOpen = false;
          lv.fillFrame(mockEvent);
          const foundIframe = document.querySelectorAll(
            ".preview-frame iframe"
          );
          expect(foundIframe.length).to.equal(1);

          it("and have type=id in the URL", () => {
            expect(true).to.be.true;
          });
        });

        it("the iframe should have type=id in the URL", () => {
          createDomNodes(`
            <div id="fillFrameTest1" class="music-grid-item">
              <div id="fillFrameEventTarget"></div>
              <div id="type-fillFrameTest1" class="preview-frame"></div>
              <div class="historybox"></div>
            </div>
          `);

          const mockEvent = {
            target: document.getElementById("fillFrameEventTarget")
          };

          lv.previewOpen = false;
          lv.fillFrame(mockEvent);
          const foundIframe = document.querySelector(".preview-frame iframe");
          const url = foundIframe.getAttribute("src");
          expect(url).to.contain("type=fillFrameTest1");
        });
      });
    });
  });

  describe("generatePreview()", () => {
    it("should return a parent with properties", () => {
      const elem = lv.generatePreview("testId", "testIdType");
      expect(elem.getAttribute("class")).to.equal("preview");
      expect(elem.getAttribute("id")).to.equal("testId");
    });

    it("should add a preview elem with properties", () => {
      const elem = lv.generatePreview("testId", "testIdType");
      const preview = elem.querySelector(".preview-frame");
      expect(preview).to.be.ok;
      expect(preview.getAttribute("id")).to.equal("testIdType-testId");
    });

    it("should add a button elem with properties", () => {
      const elem = lv.generatePreview("testId", "testIdType");
      const btn = elem.querySelector(".open-iframe");
      expect(btn).to.be.ok;
      expect(btn.getAttribute("title")).to.equal("load preview player");
      expect(btn.getAttribute("class")).to.contain("follow-unfollow");
      expect(btn.getAttribute("class")).to.contain("open-iframe");
    });

    it("should add a checkbox elem with properties", () => {
      const elem = lv.generatePreview("testId", "testIdType");
      const btn = elem.querySelector(".historybox");
      expect(btn).to.be.ok;
      expect(btn.getAttribute("title")).to.contain("preview history");
      expect(btn.getAttribute("class")).to.contain("follow-unfollow");
      expect(btn.getAttribute("class")).to.contain("historybox");
    });
  });

  describe("renderDom()", () => {
    it("should add preview panes to each .music-grid-item[data-item-id]", () => {
      createDomNodes(`
        <ul id="renderDomTest1">
          <li id="rdt1" class="music-grid-item" data-item-id="testIdType1-testId1"></li>
          <li id="rdt2" class="music-grid-item" data-item-id="testIdType2-testId2"></li>
        </ul>
      `);
      sandbox.stub(lv, "generatePreview").callThrough();
      lv.renderDom();
      const gridItems = document.querySelectorAll(".music-grid-item");
      expect(gridItems[0].querySelector(".preview")).to.be.ok;
      expect(gridItems[1].querySelector(".preview")).to.be.ok;
      expect(lv.generatePreview).to.be.calledWith("testId1", "testIdType1");
      expect(lv.generatePreview).to.be.calledWith("testId2", "testIdType2");
    });

    it("should call postMessage for each .music-grid-item[data-item-id]", () => {
      createDomNodes(`
        <ul id="renderDomTest1">
          <li id="rdt1" class="music-grid-item" data-item-id="testIdType1-testId1"></li>
          <li id="rdt2" class="music-grid-item" data-item-id="testIdType2-testId2"></li>
        </ul>
      `);
      lv.renderDom();
      expect(mockPort.postMessage).to.be.calledWith({ query: "testId1" });
      expect(mockPort.postMessage).to.be.calledWith({ query: "testId2" });
    });

    it("should add preview panes to each .music-grid-item[data-tralbumid]", () => {
      createDomNodes(`
        <ul id="renderDomTest1">
          <li id="rdt1" class="music-grid-item" data-tralbumid="tId1" data-tralbumtype="a"></li>
          <li id="rdt2" class="music-grid-item" data-tralbumid="tId2" data-tralbumtype="a"></li>
        </ul>
      `);
      sandbox.stub(lv, "generatePreview").callThrough();
      lv.renderDom();
      const gridItems = document.querySelectorAll(".music-grid-item");
      expect(gridItems[0].querySelector(".preview")).to.be.ok;
      expect(gridItems[1].querySelector(".preview")).to.be.ok;
      expect(lv.generatePreview).to.be.calledWith("tId1", "album");
      expect(lv.generatePreview).to.be.calledWith("tId2", "album");
    });

    it("should call postMessage for each .music-grid-item[data-tralbumid]", () => {
      createDomNodes(`
        <ul id="renderDomTest1">
          <li id="rdt1" class="music-grid-item" data-tralbumid="tId1" data-tralbumtype="a"></li>
          <li id="rdt2" class="music-grid-item" data-tralbumid="tId2" data-tralbumtype="a"></li>
        </ul>
      `);
      lv.renderDom();
      expect(mockPort.postMessage).to.be.calledWith({ query: "testId1" });
      expect(mockPort.postMessage).to.be.calledWith({ query: "testId2" });
    });

    describe("when data-blob has an item_id in urlParams", () => {
      it("should call setPreviewed", () => {
        sandbox.stub(lv, "setPreviewed");
        lv.renderDom();
        expect(lv.setPreviewed).to.be.calledWith("testId");
      });
    });

    describe("when data-blob does not have an item_id in urlParams", () => {
      it("should not call setPreviewed", () => {
        const querystr = '{"lo_querystr":"?item_id=&item_type="}';
        const pagedata = document.querySelector("#pagedata");
        pagedata.setAttribute("data-blob", querystr);

        sandbox.stub(lv, "setPreviewed");
        lv.renderDom();
        expect(lv.setPreviewed).to.not.be.called;
      });
    });
  });
});

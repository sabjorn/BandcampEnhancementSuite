import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { expect, assert } from "chai";
chai.use(sinonChai);

import { DownloadHelper, preamble } from "../src/download_helper.js";

/**
 * DOM node creation helper
 * Makes nodes with id='test-nodes' and adds the contents
 * in `tagString` as children.
 */
const createDomNodes = tagString => {
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
const cleanupTestNodes = () => {
  var elem = document.getElementById("test-nodes");
  if (elem) {
    elem.parentNode.removeChild(elem);
  }
};

describe("Download Helper", () => {
  let dh;
  let sandbox;

  before(async () => {
    sandbox = sinon.createSandbox();

    dh = new DownloadHelper();

    // Prevent Logger output during tests
    sandbox.stub(dh, "log");
  });

  afterEach(() => {
    // Preemptive removal of any test-nodes
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("generateDownloadList()", () => {
    it("should create a string of curl calls with urls from a.item-button", async () => {
      createDomNodes(`
        <span id="testId" class="download-title">
          <a class="item-button" href="url1"></button>
          <a class="item-button" href="url2"></button>
        </span>
      `);
      const curlCommand = "curl -OJ url1 \\ &\ncurl -OJ url2";
      const downloadList = DownloadHelper.generateDownloadList();
      expect(downloadList).to.equal(curlCommand);
    });
  });

  describe("createButton()", () => {
    it("should add a button to the end of div.download-titles", async () => {
      createDomNodes(`
        <div id="testId" class="download-titles"></div>
      `);

      dh.createButton();
      const button = document.querySelector(".downloadall");

      expect(button != null).to.be.true;
    });

    it("should not replace existing button at the end of div.download-titles", async () => {
      createDomNodes(`
        <div id="testId" class="download-titles">
          <button class="downloadall fake" id="someId"></button>
        </div>
      `);

      {
        const button = document.querySelector(".downloadall");
        const idAttribute = button.getAttribute("id");
        expect(idAttribute).to.be.equal("someId");
      }

      dh.createButton();

      {
        const button = document.querySelectorAll(".downloadall");
        assert(button.length == 1);
        const idAttribute = button[0].getAttribute("id");
        expect(idAttribute).to.be.equal("someId");
      }
    });

    it("should create specific properties for the button", async () => {
      createDomNodes(`
        <div id="testId" class="download-titles"></div>
      `);

      dh.createButton();

      const buttonClassName = "downloadall";
      expect(dh.button.className).to.equal(buttonClassName);

      const buttonTitleExpected =
        "Generates a file for automating downloads using 'curl'";
      expect(dh.button.title).to.equal(buttonTitleExpected);

      expect(dh.button.disabled).to.be.true;

      expect(dh.button.textContent).to.equal("preparing download");
    });
  });

  describe("enableButton()", () => {
    it("button should call functions on click", async () => {
      DownloadHelper.dateString = sinon.fake.returns("dateString");
      DownloadHelper.generateDownloadList = sinon.fake.returns("downloadList");
      DownloadHelper.download = sinon.spy();

      dh.button = document.createElement("button");

      dh.enableButton();

      dh.button.click();

      expect(DownloadHelper.dateString).to.have.been.called;
      expect(DownloadHelper.generateDownloadList).to.have.been.called;

      expect(DownloadHelper.download).to.have.been.called;
      expect(DownloadHelper.download.getCall(0).args[0]).to.equal(
        "bandcamp_dateString.txt"
      );
      expect(DownloadHelper.download.getCall(0).args[1]).to.equal(
        preamble + "downloadList"
      );
    });

    it("button should have specific properties", async () => {
      dh.button = document.createElement("button");

      dh.enableButton();

      expect(dh.button.disabled).to.be.false;
      expect(dh.button.textContent).to.equal("Download curl File");
    });
  });

  describe("disableButton()", () => {
    it("button listener should be removed", async () => {
      dh.button = document.createElement("button");
      dh.button.removeEventListener = sinon.spy();

      dh.disableButton();

      expect(dh.button.removeEventListener).to.have.been.called;
    });
    it("button should have specific properties", async () => {
      dh.button = document.createElement("button");

      dh.disableButton();

      expect(dh.button.disabled).to.be.true;
      expect(dh.button.textContent).to.equal("preparing download");
    });
  });

  describe("callback()", () => {
    it("enables button when all style.display blank", async () => {
      createDomNodes(`
        <div id="testId1" class="download-title"><div class="item-button" style="display: none"></div></div>
        <div id="testId2" class="download-title"><div class="item-button" style="display: none"></div></div>
        <div id="testId3" class="download-title"><div class="item-button" style="display: none"></div></div>
      `);

      dh.enableButton = sinon.spy();

      dh.mutationCallback();
      expect(dh.enableButton.notCalled).to.be.true;

      //change DOM nodes
      let nodes = document.querySelectorAll(".download-title .item-button");
      nodes.forEach(function(element, index) {
        element.style.display = "";
      });

      dh.mutationCallback();
      expect(dh.enableButton).to.have.been.called;
    });

    it('disables button when all style.display ""', async () => {
      createDomNodes(`
        <div id="testId1" class="download-title"><div class="item-button" style="display:"></div></div>
        <div id="testId2" class="download-title"><div class="item-button" style="display:"></div></div>
        <div id="testId3" class="download-title"><div class="item-button" style="display:"></div></div>
      `);

      dh.disableButton = sinon.spy();

      dh.mutationCallback();
      expect(dh.disableButton.notCalled).to.be.true;

      //change DOM nodes
      let nodes = document.querySelectorAll(".download-title .item-button");
      nodes.forEach(function(element, index) {
        element.style.display = "none";
      });

      dh.mutationCallback();
      expect(dh.disableButton).to.have.been.called;
    });
  });

  describe("init()", () => {
    it("creates button", async () => {
      dh.createButton = sinon.spy();

      dh.init();

      expect(dh.createButton).to.have.been.called;
    });

    it("calls mutationCallback", async () => {
      dh.mutationCallback = sinon.spy();

      dh.init();

      expect(dh.mutationCallback).to.have.been.called;
    });

    it("adds observers to nodes", async () => {
      createDomNodes(`
        <div id="testId1" class="download-title"><div class="item-button"></div></div>
        <div id="testId2" class="download-title"><div class="item-button"></div></div>
        <div id="testId3" class="download-title"><div class="item-button"></div></div>
      `);
      dh.observer.observe = sinon.spy();

      dh.init();

      const configExpectation = { attributes: true, attributeFilter: ["href"] }; //

      let nodes = document.querySelectorAll(".download-title .item-button");
      nodes.forEach(function(element, index) {
        expect(
          dh.observer.observe.calledWith(element, configExpectation)
        ).to.be.true;
      });
    });
  });
});

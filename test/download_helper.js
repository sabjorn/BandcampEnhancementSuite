import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai'
import { expect, assert } from 'chai';
chai.use(sinonChai);

import {DownloadHelper, preamble} from '../src/download_helper.js';

/**
 * DOM node creation helper
 * Makes nodes with id='test-nodes' and adds the contents
 * in `tagString` as children.
 */
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

/**
 * DOM node cleanup helper.
 * Removes elements with id='test-nodes'
 */
const cleanupTestNodes = () => {
  var elem = document.getElementById('test-nodes');
  if(elem){
    elem.parentNode.removeChild(elem);
  }
}

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
    it('should create a string of curl calls with urls from a.item-button', async () => {
      createDomNodes(`
        <span id="testId" class="download-title">
          <a class="item-button" href="url1"></button>
          <a class="item-button" href="url2"></button>
        </span>
      `)
      const curlCommand = "curl -OJ url1 \\ &\ncurl -OJ url2"
      const downloadList = DownloadHelper.generateDownloadList();
      expect(downloadList == curlCommand).to.be.true;
    });
  });

  describe("createButton()", () => {
    it('should add a button to the end of div.download-titles', async () => {
      createDomNodes(`
        <div id="testId" class="download-titles"></div>
      `);

      dh.createButton();
      const button = document.querySelector(".downloadall")

      expect(button != null).to.be.true;
    });

    it('should not replace existing button at the end of div.download-titles', async () => {
      createDomNodes(`
        <div id="testId" class="download-titles">
          <button class="downloadall fake" id="someId"></button>
        </div>
      `)

      {
        const button = document.querySelector(".downloadall")
        const idAttribute = button.getAttribute("id");
        expect(idAttribute == "someId").to.be.true;
      }

      dh.createButton();
      
      {
        const button = document.querySelectorAll(".downloadall")
        assert(button.length == 1);
        const idAttribute = button[0].getAttribute("id");
        expect(idAttribute == "someId").to.be.true;
      }
    });

    it('should create specific properties for the button', async () => {
      createDomNodes(`
        <div id="testId" class="download-titles"></div>
      `)
      
      dh.createButton();

      const buttonClassName = "downloadall"
      expect(dh.button.className == buttonClassName).to.be.true;

      const buttonTitleExpected = "Generates a file for automating downloads using 'curl'"
      expect(dh.button.title == buttonTitleExpected).to.be.true;

      expect(dh.button.disabled).to.be.true;

      expect(dh.button.textContent == "preparing download").to.be.true;
    });
  });

  describe("enableButton()", () => {
    it('button should call functions on click', async () => {
      DownloadHelper.dateString = sinon.fake.returns("dateString");
      DownloadHelper.generateDownloadList = sinon.fake.returns("downloadList");
      DownloadHelper.download = sinon.spy();

      dh.button = document.createElement("button");

      dh.enableButton();

      dh.button.click();

      expect(DownloadHelper.dateString.calledOnce).to.be.true;
      expect(DownloadHelper.generateDownloadList.calledOnce).to.be.true;
      
      expect(DownloadHelper.download.calledOnce).to.be.true;
      expect(DownloadHelper.download.getCall(0).args[0] == "bandcamp_dateString.txt").to.be.true;
      expect(DownloadHelper.download.getCall(0).args[1] == preamble + "downloadList").to.be.true;
    });

    it('button should have specific properties', async () => {
      dh.button = document.createElement("button");

      dh.enableButton();

      expect(dh.button.disabled).to.be.false;
      expect(dh.button.textContent == "Download curl File").to.be.true;
    });
  });

  describe("disableButton()", () => {
    it('button listener should be removed', async () => {
      dh.button = document.createElement("button")
      dh.button.removeEventListener = sinon.spy();

      dh.disableButton();

      expect(dh.button.removeEventListener.calledOnce).to.be.true;

    });
    it('button should have specific properties', async () => {
      dh.button = document.createElement("button")

      dh.disableButton();

      expect(dh.button.disabled).to.be.true;
      expect(dh.button.textContent == "preparing download").to.be.true;
    });
  });

  describe("callback()", () => {
    it('enables button when all style.display blank', async () => {
      createDomNodes(`
        <div id="testId" class="download-title"><div class="item-button" style="display: none"></div></div>
        <div id="testId" class="download-title"><div class="item-button" style="display: none"></div></div>
        <div id="testId" class="download-title"><div class="item-button" style="display: none"></div></div>
      `)

      dh.enableButton = sinon.spy();

      dh.mutationCallback();
      expect(dh.enableButton.notCalled).to.be.true;

      //change DOM nodes
      let nodes = document.querySelectorAll(".download-title .item-button")
      nodes.forEach(function(element, index) {
        element.style.display = "";
      });
      
      dh.mutationCallback();
      expect(dh.enableButton.calledOnce).to.be.true;
    });

    it('disables button when all style.display ""', async () => {
      createDomNodes(`
        <div id="testId" class="download-title"><div class="item-button" style="display:"></div></div>
        <div id="testId" class="download-title"><div class="item-button" style="display:"></div></div>
        <div id="testId" class="download-title"><div class="item-button" style="display:"></div></div>
      `)

      dh.disableButton = sinon.spy();

      dh.mutationCallback();
      expect(dh.disableButton.notCalled).to.be.true;

      //change DOM nodes
      let nodes = document.querySelectorAll(".download-title .item-button")
      nodes.forEach(function(element, index) {
        element.style.display = "none";
      });

      dh.mutationCallback();
      expect(dh.disableButton.calledOnce).to.be.true;
    });
  });

  describe("init()", () => {
    it('creates button', async () => {
      dh.createButton = sinon.spy();

      dh.init();

      expect(dh.createButton.called).to.be.true;
    });

    it('calls mutationCallback', async () => {
      dh.mutationCallback = sinon.spy();

      dh.init();

      expect(dh.mutationCallback.called).to.be.true;
    });

    it('adds observers to nodes', async () => {
      createDomNodes(`
        <div id="testId" class="download-title"><div class="item-button"></div></div>
        <div id="testId" class="download-title"><div class="item-button"></div></div>
        <div id="testId" class="download-title"><div class="item-button"></div></div>
      `)
      dh.observer.observe = sinon.spy();

      dh.init();

      const configExpectation = { attributes: true, attributeFilter: ["href"] }; //
      
      let nodes = document.querySelectorAll(".download-title .item-button")
      nodes.forEach(function(element, index) {
        expect(dh.observer.observe.calledWith(element, configExpectation)).to.be.true;
      });
    });
  });
});

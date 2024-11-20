import { mockApiResponse } from "./utils.js";

import chai from "chai";
import sinon from "sinon";
import sinonStubPromise from "sinon-stub-promise";
sinonStubPromise(sinon);

import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);
import chrome from "sinon-chrome";

import WaveformBackend from "../src/background/waveform_backend.js";

describe("WaveformBackend", () => {
  let wb;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    wb = new WaveformBackend();

    wb.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("init()", () => {
    beforeEach(() => {
      global.chrome = chrome;
    });
    afterEach(() => {
      chrome.flush();
    });

    it("should call chrome.runtime.onConnect", () => {
      wb.init();
      expect(chrome.runtime.onMessage.addListener).to.be.calledWith(
        wb.processRequest
      );
    });
  });

  describe("processRequest()", () => {
    let request;

    let sendResponseSpy = sinon.spy();

    let stubedFetch;

    const buffer = new Uint8Array([0, 1, 2, 3]);

    beforeEach(() => {
      request = {
        contentScriptQuery: "notTheRightSender",
        url: "test"
      };

      stubedFetch = sinon.stub(window, "fetch");
      stubedFetch.returns(Promise.resolve(mockApiResponse()));
    });

    afterEach(() => {
      stubedFetch.restore();
    });

    // TODO: 'sendResponseSpy' will never be called in this test
    //    it("should return without doing anything", () => {
    //      let returnValue = wb.processRequest(request, null, sendResponseSpy);
    //
    //      expect(returnValue).to.be.false;
    //      expect(sendResponseSpy).to.be.not.called;
    //    });

    // TODO: 'sendResponseSpy' will never be called in this test
    it("should send a Buffer back with 'sendResponse'", () => {
      request.contentScriptQuery = "renderBuffer";
      let returnValue = wb.processRequest(request, null, sendResponseSpy);

      expect(stubedFetch).to.be.calledWith(
        "https://t4.bcbits.com/stream/" + request.url
      );
      expect(returnValue).to.be.true;
      //expect(sendResponseSpy).to.be.called;
    });
  });
});

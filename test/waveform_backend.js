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

    sandbox.stub(wb, "log");
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
      delete global.chrome;
    });

    it("should call chrome.runtime.onConnect", () => {
      wb.init();
      expect(chrome.runtime.onMessage.addListener).to.be.calledWith(
        wb.boundProcessAudio
      );
    });
  });

  // we test wb.boundProcessAudio because "log" is stubbed there
  describe("boundProcessAudio()", () => {
    let request;

    let sendResponseSpy = sinon.spy();

    let stubedFetch;

    beforeEach(() => {
      request = {
        contentScriptQuery: "notTheRightSender",
        datapoints: 128,
        length: 1024,
        fs: 44100,
        url: "test"
      };

      stubedFetch = sinon.stub(window, "fetch");
      window.fetch.returns(Promise.resolve(mockApiResponse));

      sandbox.stub(window, "OfflineAudioContext");
      window.OfflineAudioContext.callThroughWithNew().returns(sinon.spy());
    });

    afterEach(() => {
      stubedFetch.restore();
    });

    it("should return without doing anything", () => {
      wb.boundProcessAudio(request, null, sendResponseSpy);

      expect(sendResponseSpy).to.be.not.called;
      expect(window.OfflineAudioContext).to.be.not.called;
    });

    it("should call AudioContext", () => {
      request.contentScriptQuery = "renderBuffer";
      let returnValue = wb.boundProcessAudio(request, null, sendResponseSpy);

      expect(window.OfflineAudioContext).to.be.called;
      expect(stubedFetch).to.be.calledWith(
        "https://t4.bcbits.com/stream/" + request.url
      );
      expect(returnValue).to.be.true;
    });
  });
});

import { createPagedata, createDomNodes, cleanupTestNodes } from "./utils.js";

import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import chrome from "sinon-chrome";
chai.use(sinonChai);

import { mousedownCallback } from "../src/utilities.js";
import Waveform from "../src/waveform.js";

describe("Waveform", () => {
  let wf;
  let sandbox;

  let ctx = {
    globalCompositeOperation: {},
    fillStyle: {},
    fillRect: sinon.spy(),
    clearRect: sinon.spy()
  };

  let canvas = {
    getContext: sinon.stub().returns(ctx),
    width: 100,
    height: 100
  };

  const mockPort = {
    onMessage: { addListener: sinon.stub() },
    postMessage: sinon.spy()
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    global.chrome = chrome;
    chrome.runtime.connect.returns(mockPort);

    wf = new Waveform();

    sandbox.stub(wf, "log");

    createDomNodes(`
      <audio></audio>
    `);
  });

  afterEach(() => {
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("constructor", () => {
    describe("chrome communication configuration", () => {
      it("configures chrome.runtime.connection", () => {
        new Waveform();

        expect(chrome.runtime.connect).to.be.calledWith(null, {
          name: "bandcamplabelview"
        });
      });

      it("does not throw error if 'Error in invocation'", () => {
        const error = new Error("Error in invocation of runtime.connect");
        chrome.runtime.connect.throws(error);

        const throwCheck = () => new Waveform();

        expect(throwCheck).to.not.throw();
      });

      it("should throw error for all other errors from chrome'", () => {
        const error = new Error("some error message");
        chrome.runtime.connect.throws(error);

        const throwCheck = () => new Waveform();

        expect(throwCheck).to.throw();
      });
    });
  });

  describe("init()", () => {
    let canvasSpy = {
      addEventListener: sinon.spy(),
      style: { display: "inherit" }
    };

    let toggleDivSpy = {
      addEventListener: sinon.spy()
    };

    let toggleSpy = {
      checked: false,
      parentNode: toggleDivSpy
    };

    let trackTitleElement;

    let audioSpy = {
      addEventListener: sinon.spy()
    };

    let getPropertyValueStub = sinon.stub().returns("rgb(255, 0, 0)");

    beforeEach(() => {
      sandbox.stub(Waveform, "createCanvas").returns(canvasSpy);
      sandbox.stub(Waveform, "createCanvasDisplayToggle").returns(toggleSpy);
      sandbox.stub(Waveform, "invertColour");
      sandbox.stub(document, "querySelector");

      sandbox.stub(window, "getComputedStyle").callsFake(() => {
        return {
          getPropertyValue: sinon.stub().returns("rgb(255, 0, 0)")
        };
      });
      document.querySelector.withArgs("audio").returns(audioSpy);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("creates canvas with clickable interface", () => {
      wf.init();
      expect(Waveform.createCanvas).to.be.called;
      expect(canvasSpy.addEventListener).to.have.been.calledWith(
        "click",
        mousedownCallback
      );
    });

    it("creates toggle which acts as a display for toggle state", () => {
      wf.init();
      expect(Waveform.createCanvasDisplayToggle).to.be.called;
    });

    it("creates div which can beclicked on to trigger state changes", () => {
      wf.init();
      expect(toggleDivSpy.addEventListener).to.have.been.calledWith(
        "click",
        wf.boundToggleWaveformCanvas
      );
    });

    it("gets the background colour for specific element", () => {
      wf.init();

      const rgbResult = "rgb(255, 0, 0)";
      expect(wf.waveformColour).to.be.equal(rgbResult);
      expect(Waveform.invertColour).to.be.calledWith(rgbResult);
    });

    it("adds eventListener for audio element 'canplay'", () => {
      wf.init();
      expect(audioSpy.addEventListener).to.have.been.calledWith(
        "canplay",
        wf.boundMonitorAudioCanPlay
      );
    });

    it("adds eventListener for audio element 'timeupdate'", () => {
      wf.init();
      expect(audioSpy.addEventListener).to.have.been.calledWith(
        "timeupdate",
        wf.boundMonitorAudioTimeupdate
      );
    });

    it("adds listener to port.onMessage", () => {
      wf.init();
      expect(mockPort.onMessage.addListener).to.have.been.calledWith(
        wf.boundApplyConfig
      );
    });

    it("posts message to request configs from backend AFTER canvasDisplayToggle", () => {
      wf.init();
      sinon.assert.callOrder(
        toggleDivSpy.addEventListener,
        mockPort.postMessage
      );
      expect(mockPort.postMessage).to.have.been.calledWith({
        requestConfig: {}
      });
    });
  });

  describe("generateWaveform()", () => {
    before(() => {
      global.chrome = chrome;
    });

    let audioContext = {
      sampleRate: 44100
    };

    let audioSpy = {
      src: "stream/nothing",
      duration: 10
    };

    beforeEach(() => {
      chrome.runtime.sendMessage.flush();

      sandbox.stub(document, "querySelector");
      document.querySelector.withArgs("audio").returns(audioSpy);

      sandbox.stub(window, "AudioContext");
      window.AudioContext.returns(audioContext);

      wf.canvas = canvas;
    });
    afterEach(() => {
      sandbox.restore();
    });
    after(() => {
      chrome.flush();
      delete global.chrome;
    });

    it("does nothing if target matches audio.source", () => {
      wf.currentTarget = "stream/nothing";

      wf.generateWaveform();
      expect(chrome.runtime.sendMessage).to.not.be.called;
    });

    it("updates target to audio.source if they do not match", () => {
      audioSpy.src = "a/specific/src";
      wf.currentTarget = "";

      wf.generateWaveform();
      expect(wf.currentTarget).to.be.equal("a/specific/src");
    });

    it("sends a message with chrome.runtime.sendMessage", () => {
      audioSpy.src = "stream/src";
      wf.currentTarget = "";

      wf.generateWaveform();

      let expectedMessage = {
        contentScriptQuery: "renderBuffer",
        fs: 44100,
        length: 10,
        url: "src",
        datapoints: 100
      };
      expect(chrome.runtime.sendMessage).to.be.calledWith(expectedMessage);
    });
  });

  describe("applyConfig()", () => {
    const canvasFake = {
      style: { display: "inherit" }
    };
    const displayToggle = { checked: false };

    beforeEach(() => {
      wf.canvas = canvasFake;
      wf.canvasDisplayToggle = displayToggle;
    });

    it("sets the display value of the waveform from config object", () => {
      wf.boundApplyConfig({ config: { displayWaveform: false } });
      expect(canvasFake.style.display).to.be.equal("none");

      wf.boundApplyConfig({ config: { displayWaveform: true } });
      expect(canvasFake.style.display).to.be.equal("inherit");
    });

    it("sets the display of the onscreen toggle", () => {
      wf.boundApplyConfig({ config: { displayWaveform: false } });
      expect(canvasFake.style.display).to.be.equal("none");

      wf.boundApplyConfig({ config: { displayWaveform: true } });
      expect(canvasFake.style.display).to.be.equal("inherit");
    });
  });

  // "bound" functions are tested instead of the static version
  describe("boundToggleWaveformCanvas()", () => {
    it("should send command to backend to invert waveformDisplay", () => {
      const expectedMessage = { toggleWaveformDisplay: {} };
      wf.port = mockPort;

      wf.boundToggleWaveformCanvas();

      expect(mockPort.postMessage).to.be.calledWith(
        sinon.match(expectedMessage)
      );
    });
  });

  describe("boundMonitorAudioCanPlay()", () => {
    let audioSpy = { paused: true };
    let displayToggle = { checked: false };
    let generateWaveformSpy;

    beforeEach(() => {
      sandbox.stub(document, "querySelector").returns(audioSpy);
      wf.generateWaveform = sinon.spy();
      wf.canvasDisplayToggle = displayToggle;
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("should call generateWaveform() ", () => {
      audioSpy.paused = false;
      displayToggle.checked = true;
      wf.boundMonitorAudioCanPlay();

      expect(wf.generateWaveform).to.be.called;
    });

    it("should not call generateWaveform() ", () => {
      audioSpy.paused = true;
      displayToggle.checked = true;
      wf.boundMonitorAudioCanPlay();

      expect(wf.generateWaveform).to.not.be.called;

      audioSpy.paused = true;
      displayToggle.checked = false;
      wf.boundMonitorAudioCanPlay();

      expect(wf.generateWaveform).to.not.be.called;
    });
  });

  describe("boundMonitorAudioTimeupdate()", () => {
    it("should update waveform overlay by calling Waveform.drawOverlay", () => {
      sandbox.stub(Waveform, "drawOverlay");

      const event = {
        target: {
          currentTime: 1,
          duration: 10
        }
      };

      wf.boundMonitorAudioTimeupdate(event);
      const expectedProgress = 0.1;
      expect(Waveform.drawOverlay).to.be.calledWith(
        wf.canvas,
        expectedProgress,
        wf.waveformOverlayColour,
        wf.waveformColour
      );
    });
  });

  describe("createCanvas()", () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="progbar"></div>
      `);
    });
    afterEach(() => {
      cleanupTestNodes();
    });

    it("should call create a canvas in the DOM", () => {
      let canvas = Waveform.createCanvas();

      let progbarNodes = document.querySelector("div.waveform");
      let domDiv = progbarNodes.getElementsByTagName("div")[0];
      let domCanvas = domDiv.getElementsByTagName("canvas")[0];

      expect(domCanvas).to.be.equal(canvas);
    });
  });

  describe("createCanvasDisplayToggle()", () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="controls"></div>
      `);
    });
    afterEach(() => {
      cleanupTestNodes();
    });

    it("should call create a toggle in the DOM", () => {
      let toggle = Waveform.createCanvasDisplayToggle();

      let inlineplayerNodes = document.querySelector("div.controls");

      let domToggle = inlineplayerNodes.getElementsByTagName("input")[0];
      expect(domToggle.getAttribute("title")).to.be.equal(
        "toggle waveform display"
      );
      expect(domToggle.getAttribute("type")).to.be.equal("checkbox");
      expect(domToggle.getAttribute("class")).to.be.equal("waveform");
      expect(domToggle.getAttribute("id")).to.be.equal("switch");

      let domLabel = inlineplayerNodes.getElementsByTagName("label")[0];
      expect(domLabel.getAttribute("class")).to.be.equal("waveform");
      expect(domLabel.htmlFor).to.be.equal("switch");
      expect(domLabel.innerHTML).to.be.equal("Toggle");

      expect(toggle).to.be.equal(domToggle);
    });
  });

  describe("fillBar()", () => {
    it("should draw narrow rectangular bar on canvas", () => {
      Waveform.fillBar(canvas, 0.5, 10, 100);

      expect(ctx.globalCompositeOperation).to.equal("source-over");
      expect(ctx.fillStyle).to.be.equal("white");
      expect(ctx.fillRect).to.be.calledWith(10, 100, 1, -50);
    });
  });

  describe("drawOverlay()", () => {
    it("should draw progress bar on canvas", () => {
      Waveform.drawOverlay(canvas, 0.5);

      expect(ctx.globalCompositeOperation).to.equal("source-atop");
      expect(ctx.fillRect).to.be.calledWith(0, 0, 100, 100);
      expect(ctx.fillRect).to.be.calledWith(0, 0, 100 * 0.5, 100);
      expect(ctx.fillStyle).to.be.equal("red");
    });
  });

  describe("invertColour()", () => {
    let inverted = Waveform.invertColour("rgb(255,255,255");
    expect(inverted).to.be.equal("rgb(0,0,0)");

    inverted = Waveform.invertColour("rgb(0,0,0");
    expect(inverted).to.be.equal("rgb(255,255,255)");

    inverted = Waveform.invertColour("rgb(55,155,200");
    expect(inverted).to.be.equal("rgb(200,100,55)");
  });
});

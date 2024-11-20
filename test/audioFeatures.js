import { createPagedata, createDomNodes, cleanupTestNodes } from "./utils.js";

import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import chrome from "sinon-chrome";
chai.use(sinonChai);

import { mousedownCallback } from "../src/utilities.js";
import AudioFeatures from "../src/audioFeatures.js";

describe("AudioFeatures", () => {
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

    wf = new AudioFeatures(mockPort);

    wf.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };

    createDomNodes(`
      <audio></audio>
    `);
  });

  afterEach(() => {
    cleanupTestNodes();
    sandbox.restore();
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

    let bpmDivSpy = sinon.spy();

    let trackTitleElement;

    let audioSpy = {
      addEventListener: sinon.spy()
    };

    let getPropertyValueStub = sinon.stub().returns("rgb(255, 0, 0)");

    beforeEach(() => {
      sandbox.stub(AudioFeatures, "createCanvas").returns(canvasSpy);
      sandbox
        .stub(AudioFeatures, "createCanvasDisplayToggle")
        .returns(toggleSpy);
      sandbox.stub(AudioFeatures, "createBpmDisplay").returns(bpmDivSpy);
      sandbox.stub(AudioFeatures, "invertColour");
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
      expect(AudioFeatures.createCanvas).to.be.called;
      expect(canvasSpy.addEventListener).to.have.been.calledWith(
        "click",
        mousedownCallback
      );
    });

    it("creates toggle which acts as a display for toggle state", () => {
      wf.init();
      expect(AudioFeatures.createCanvasDisplayToggle).to.be.called;
    });

    it("creates div which can be clicked on to trigger state changes", () => {
      wf.init();
      expect(toggleDivSpy.addEventListener).to.have.been.calledWith(
        "click",
        wf.toggleWaveformCanvasCallback
      );
    });

    it("creates div to display audio bpm", () => {
      wf.init();
      expect(AudioFeatures.createBpmDisplay).to.be.called;
    });

    it("gets the background colour for specific element", () => {
      wf.init();

      const rgbResult = "rgb(255, 0, 0)";
      expect(wf.waveformColour).to.be.equal(rgbResult);
      expect(AudioFeatures.invertColour).to.be.calledWith(rgbResult);
    });

    it("adds eventListener for audio element 'canplay'", () => {
      wf.init();
      expect(audioSpy.addEventListener).to.have.been.calledWith(
        "canplay",
        wf.monitorAudioCanPlayCallback
      );
    });

    it("adds eventListener for audio element 'timeupdate'", () => {
      wf.init();
      expect(audioSpy.addEventListener).to.have.been.calledWith(
        "timeupdate",
        wf.monitorAudioTimeupdateCallback
      );
    });

    it("adds listener to port.onMessage", () => {
      wf.init();
      expect(mockPort.onMessage.addListener).to.have.been.calledWith(
        wf.applyConfig
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

  describe("generateAudioFeatures()", () => {
    before(() => {
      global.chrome = chrome;
    });

    let ctx;

    let audioSpy = {
      src: "stream/nothing",
      duration: 10
    };

    beforeEach(() => {
      chrome.runtime.sendMessage.flush();

      sandbox.stub(document, "querySelector");
      document.querySelector.withArgs("audio").returns(audioSpy);

      wf.bpmDisplay = { innerText: "" };

      ctx = sinon.mock(new AudioContext());

      wf.canvas = canvas;
    });

    afterEach(() => {
      sandbox.restore();
    });

    after(() => {
      chrome.flush();
    });

    it("does nothing if target matches audio.source", () => {
      wf.currentTarget = "stream/nothing";

      wf.generateAudioFeatures();
      expect(chrome.runtime.sendMessage).to.not.be.called;
    });

    it("updates target to audio.source if they do not match", () => {
      audioSpy.src = "a/specific/src";
      wf.currentTarget = "";

      wf.generateAudioFeatures();
      expect(wf.currentTarget).to.be.equal("a/specific/src");
    });

    it("clears bpmDisplay if audio.source does not match previous", () => {
      audioSpy.src = "a/specific/src";
      wf.bpmDisplay.innerText = "innerText";

      wf.generateAudioFeatures();
      expect(wf.bpmDisplay.innerText).to.be.equal("");
    });

    it("sends a message with chrome.runtime.sendMessage", () => {
      audioSpy.src = "stream/src";
      wf.currentTarget = "";

      wf.generateAudioFeatures();

      let expectedMessage = {
        contentScriptQuery: "renderBuffer",
        url: "src"
      };
      expect(chrome.runtime.sendMessage).to.be.calledWith(expectedMessage);
    });

    it("calls 'decodAudioData'", () => {
      audioSpy.src = "stream/src";
      wf.currentTarget = "";

      wf.generateAudioFeatures();

      let expectedMessage = {
        contentScriptQuery: "renderBuffer",
        url: "src"
      };
      ctx.expects("decodeAudioData").once();
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

    it("sets the display value of the audioFeatures from config object", () => {
      wf.applyConfig({ config: { displayWaveform: false } });
      expect(canvasFake.style.display).to.be.equal("none");

      wf.applyConfig({ config: { displayWaveform: true } });
      expect(canvasFake.style.display).to.be.equal("inherit");
    });

    it("sets the display of the onscreen toggle", () => {
      wf.applyConfig({ config: { displayWaveform: false } });
      expect(canvasFake.style.display).to.be.equal("none");

      wf.applyConfig({ config: { displayWaveform: true } });
      expect(canvasFake.style.display).to.be.equal("inherit");
    });
  });

  describe("wf.toggleWaveformCanvasCallback()", () => {
    it("should send command to backend to invert audioFeaturesDisplay", () => {
      const expectedMessage = { toggleWaveformDisplay: {} };
      wf.port = mockPort;

      wf.toggleWaveformCanvasCallback();

      expect(mockPort.postMessage).to.be.calledWith(
        sinon.match(expectedMessage)
      );
    });
  });

  describe("monitorAudioCanPlayCallback()", () => {
    let audioSpy = { paused: true };
    let displayToggle = { checked: false };
    let generateAudioFeaturesSpy;

    beforeEach(() => {
      sandbox.stub(document, "querySelector").returns(audioSpy);
      wf.generateAudioFeatures = sinon.spy();
      wf.canvasDisplayToggle = displayToggle;
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("should call generateAudioFeatures() ", () => {
      audioSpy.paused = false;
      displayToggle.checked = true;
      wf.monitorAudioCanPlayCallback();

      expect(wf.generateAudioFeatures).to.be.called;
    });

    it("should not call generateAudioFeatures() ", () => {
      audioSpy.paused = true;
      displayToggle.checked = true;
      wf.monitorAudioCanPlayCallback();

      expect(wf.generateAudioFeatures).to.not.be.called;

      audioSpy.paused = true;
      displayToggle.checked = false;
      wf.monitorAudioCanPlayCallback();

      expect(wf.generateAudioFeatures).to.not.be.called;
    });
  });

  describe("monitorAudioTimeupdateCallback()", () => {
    it("should update audioFeatures overlay by calling AudioFeatures.drawOverlay", () => {
      sandbox.stub(AudioFeatures, "drawOverlay");

      const event = {
        target: {
          currentTime: 1,
          duration: 10
        }
      };

      wf.monitorAudioTimeupdateCallback(event);
      const expectedProgress = 0.1;
      expect(AudioFeatures.drawOverlay).to.be.calledWith(
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
      let canvas = AudioFeatures.createCanvas();

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
      let toggle = AudioFeatures.createCanvasDisplayToggle();

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

  describe("createBpmDisplay()", () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="progbar"></div>
      `);
    });
    afterEach(() => {
      cleanupTestNodes();
    });

    it("should call create a div in the DOM", () => {
      let bpmDiv = AudioFeatures.createBpmDisplay();

      let inlineplayerNodes = document.querySelector("div.progbar");

      let domBpmDiv = inlineplayerNodes.getElementsByTagName("div")[0];
      expect(domBpmDiv.getAttribute("class")).to.be.equal("bpm");

      expect(bpmDiv).to.be.equal(domBpmDiv);
    });
  });

  describe("fillBar()", () => {
    it("should draw narrow rectangular bar on canvas", () => {
      AudioFeatures.fillBar(canvas, 0.5, 10, 100);

      expect(ctx.globalCompositeOperation).to.equal("source-over");
      expect(ctx.fillStyle).to.be.equal("white");
      expect(ctx.fillRect).to.be.calledWith(10, 100, 1, -50);
    });
  });

  describe("drawOverlay()", () => {
    it("should draw progress bar on canvas", () => {
      AudioFeatures.drawOverlay(canvas, 0.5);

      expect(ctx.globalCompositeOperation).to.equal("source-atop");
      expect(ctx.fillRect).to.be.calledWith(0, 0, 100, 100);
      expect(ctx.fillRect).to.be.calledWith(0, 0, 100 * 0.5, 100);
      expect(ctx.fillStyle).to.be.equal("red");
    });
  });

  describe("invertColour()", () => {
    let inverted = AudioFeatures.invertColour("rgb(255,255,255");
    expect(inverted).to.be.equal("rgb(0,0,0)");

    inverted = AudioFeatures.invertColour("rgb(0,0,0");
    expect(inverted).to.be.equal("rgb(255,255,255)");

    inverted = AudioFeatures.invertColour("rgb(55,155,200");
    expect(inverted).to.be.equal("rgb(200,100,55)");
  });
});

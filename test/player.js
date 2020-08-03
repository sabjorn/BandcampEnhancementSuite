import { createDomNodes, cleanupTestNodes } from "./utils.js";
import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import Player from "../src/player.js";

describe("Player", () => {
  let player;
  let sandbox;

  beforeEach(() => {
    // Reset state before each test run
    sandbox = sinon.createSandbox();
    player = new Player();

    // Prevent Logger output during tests
    sandbox.stub(player, "log");
  });

  afterEach(() => {
    // Preemptive removal of any test-nodes
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("init()", () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="testId" class="progbar"></div>
      `);

      player.addVolumeSlider = sinon.spy();
    });

    it("binds global keydown method", () => {
      sinon.spy(document, "addEventListener");

      player.init();

      expect(document.addEventListener).to.have.been.calledWith(
        "keydown",
        player.boundKeydown
      );
    });

    it("initializes and binds progressbar", () => {
      let progressbar = {
        style: { cursor: "none" },
        addEventListener: sinon.spy()
      };
      sinon
        .stub(document, "querySelector")
        .withArgs(".progbar")
        .returns(progressbar);

      player.init();

      expect(progressbar.style.cursor).to.be.equal("pointer");
      expect(progressbar.addEventListener).to.have.been.calledWith(
        "click",
        player.boundMousedown
      );

      document.querySelector.restore();
    });

    it("runs addVolumeSlider()", () => {
      player.init();

      expect(player.addVolumeSlider).to.have.been.called;
    });
  });

  describe("addVolumeSlider", () => {
    let input;
    let audio;
    let inlineplayer;

    beforeEach(() => {
      input = { addEventListener: sinon.spy() };

      audio = {};

      inlineplayer = {
        classList: { contains: sinon.stub() },
        append: sinon.spy()
      };

      sinon.stub(document, "querySelector");
      document.querySelector.withArgs("audio").returns(audio);
      document.querySelector
        .withArgs("div.inline_player")
        .returns(inlineplayer);

      sinon.stub(document, "createElement").returns(input);
    });
    afterEach(() => {
      document.querySelector.restore();
      document.createElement.restore();
    });

    it("creates an input element with specific attributes", () => {
      audio.volume = 123.45;

      player.addVolumeSlider();

      expect(input.type).is.equal("range");
      expect(input.min).is.equal(0.0);
      expect(input.max).is.equal(1.0);
      expect(input.step).is.equal(0.01);
      expect(input.value).is.equal(123.45);
    });

    it("binds boundVolume callback to input element", () => {
      player.addVolumeSlider();

      expect(input.addEventListener).to.have.been.calledWith(
        "input",
        player.boundVolume
      );
    });

    it("appends input to document element if that element is not hidden", () => {
      inlineplayer.classList.contains = sinon.stub().returns(false);

      player.addVolumeSlider();

      expect(inlineplayer.append).to.have.been.calledWith(input);
    });

    it("does not append input to document element if that element is hidden", () => {
      inlineplayer.classList.contains = sinon.stub().returns(true);

      player.addVolumeSlider();

      expect(inlineplayer.append).to.not.have.been.called;
    });
  });

  describe("boundKeydown", () => {
    let spyElement;
    let event;

    beforeEach(() => {
      event = { key: "", preventDefault: sinon.spy() };
      spyElement = { click: sinon.spy() };

      sinon.stub(document, "querySelector").returns(spyElement);
    });

    afterEach(() => {
      document.querySelector.restore();
    });

    it("click play button if space or 'p' pushed", () => {
      event.key = "p";
      player.boundKeydown(event);

      expect(document.querySelector).to.be.calledWith("div.playbutton");
      expect(spyElement.click).to.have.been.called;

      event.key = " ";
      player.boundKeydown(event);

      expect(document.querySelector).to.be.calledWith("div.playbutton");
      expect(spyElement.click).to.have.been.called;
      expect(event.preventDefault).to.have.been.called;
    });

    it("click prevbutton if 'ArrowUp'", () => {
      event.key = "ArrowUp";
      player.boundKeydown(event);

      expect(document.querySelector).to.be.calledWith("div.prevbutton");
      expect(spyElement.click).to.have.been.called;
      expect(event.preventDefault).to.have.been.called;
    });

    it("click nextbutton if 'ArrowDown'", () => {
      event.key = "ArrowDown";
      player.boundKeydown(event);

      expect(document.querySelector).to.be.calledWith("div.nextbutton");
      expect(spyElement.click).to.have.been.called;
      expect(event.preventDefault).to.have.been.called;
    });

    it("jump audio ahead 10s if 'ArrowRight'", () => {
      spyElement.currentTime = 100;

      event.key = "ArrowRight";
      player.boundKeydown(event);

      expect(document.querySelector).to.be.calledWith("audio");
      expect(spyElement.currentTime).to.be.equal(110);
      expect(event.preventDefault).to.have.been.called;
    });

    it("jump audio back 10s if 'ArrowLeft'", () => {
      spyElement.currentTime = 100;

      event.key = "ArrowLeft";
      player.boundKeydown(event);

      expect(document.querySelector).to.be.calledWith("audio");
      expect(spyElement.currentTime).to.be.equal(90);
      expect(event.preventDefault).to.have.been.called;
    });

    it("does not prevent other keys from being called", () => {
      event.key = "null";
      player.boundKeydown(event);

      expect(event.preventDefault).to.have.not.been.called;
    });
  });

  describe("boundMousedown", () => {
    const spyElement = { click: sinon.spy() };

    beforeEach(() => {
      sinon.stub(document, "querySelector").returns(spyElement);
    });

    afterEach(() => {
      document.querySelector.restore();
    });

    it("positions audio play position based on click", () => {
      spyElement.duration = 100;
      spyElement.currentTime = 0;

      let event = {
        offsetX: 1,
        path: [{ offsetWidth: 0 }, { offsetWidth: 2 }]
      };

      player.boundMousedown(event);

      expect(document.querySelector).to.be.calledWith("audio");
      expect(spyElement.currentTime).to.be.equal(50);
    });
  });
});

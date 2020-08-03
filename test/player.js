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

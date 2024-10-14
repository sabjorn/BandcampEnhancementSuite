import { createDomNodes, cleanupTestNodes } from "./utils.js";
import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import { mousedownCallback } from "../src/utilities.js";
import Player from "../src/player.js";

describe("Player", () => {
  let player;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    player = new Player();

    sandbox.stub(player, "log").value({
      error: sandbox.stub(),
      info: sandbox.stub()
    });
  });

  afterEach(() => {
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("init()", () => {
    const progressbar = {
      style: { cursor: "none" },
      addEventListener: sinon.spy()
    };
    const sidecarReveal = {
      append: sinon.spy()
    };
    const createShoppingCartResetButtonReturnValue = "test";
    const bandFollowInfoFake = {
      tralbum_id: 123,
      tralbumType: "p"
    };
    const mockTralbumDetails = {
      tracks: [
        {
          price: "1.00",
          currency: "USD",
          track_id: "123",
          title: "Test Track"
        }
      ]
    };
    const mockResponse = {
      ok: true,
      json: sinon.stub().resolves(mockTralbumDetails)
    };

    beforeEach(() => {
      sandbox.spy(document, "addEventListener");
      sandbox.spy(Player, "movePlaylist");

      player.updatePlayerControlInterface = sinon.spy();
      player.extractBandFollowInfo = sinon.stub().returns(bandFollowInfoFake);
      player.addOneClickBuyButtons = sinon.stub();
      player.createShoppingCartResetButton = sinon
        .stub()
        .returns(createShoppingCartResetButtonReturnValue);
      player.getTralbumDetails = sinon.stub().resolves(mockResponse);

      sandbox
        .stub(document, "querySelector")
        .withArgs(".progbar")
        .returns(progressbar)
        .withArgs("#sidecartReveal")
        .returns(sidecarReveal);
    });

    afterEach(() => {
      sandbox.restore();
      // player.updatePlayerControlInterface.restore();
    });

    it("binds global keydown method", () => {
      player.init();

      expect(document.addEventListener).to.have.been.calledWith(
        "keydown",
        player.keydownCallback
      );
    });

    it("initializes and binds progressbar", () => {
      player.init();

      expect(progressbar.style.cursor).to.be.equal("pointer");
      expect(progressbar.addEventListener).to.have.been.calledWith(
        "click",
        mousedownCallback
      );
    });

    it("calls movePlaylist()", () => {
      player.init();

      expect(Player.movePlaylist).to.have.been.called;
    });

    it("adds cartRefreshButton to sidecarReveal element", () => {
      player.init();

      expect(player.createShoppingCartResetButton).to.have.been.called;
      expect(sidecarReveal.append).to.have.been.calledWith(
        createShoppingCartResetButtonReturnValue
      );
    });

    it("should add one-click buy buttons when getTralbumDetails succeeds", async () => {
      await player.init();

      expect(player.getTralbumDetails).to.have.been.calledWith(
        bandFollowInfoFake.tralbum_id,
        bandFollowInfoFake.tralbum_type
      );
      expect(player.addOneClickBuyButtons).to.have.been.calledWith(
        mockTralbumDetails
      );
    });

    it("should handle errors when getTralbumDetails fails", async () => {
      const errorMessage = "HTTP error! status: 404";
      player.getTralbumDetails.rejects(new Error(errorMessage));

      await player.init();

      expect(player.log.error).to.be.calledWith(
        sinon.match
          .instanceOf(Error)
          .and(sinon.match.has("message", errorMessage))
      );
    });

    it("calls updatePlayerControlInterface()", () => {
      player.init();

      expect(player.updatePlayerControlInterface).to.have.been.called;
    });
  });

  describe("movePlaylist()", () => {
    let playerSpy;

    beforeEach(() => {
      sandbox.stub(document, "querySelector");

      playerSpy = { after: sinon.spy() };
      document.querySelector.withArgs("div.inline_player").returns(playerSpy);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("moves playlist below player if playlist exists", () => {
      let playlist = {};
      document.querySelector.withArgs("table#track_table").returns(playlist);

      Player.movePlaylist();

      expect(playerSpy.after).to.be.calledWith(playlist);
    });

    it("does not move playlist if it does not exists", () => {
      document.querySelector.withArgs("table#track_table").returns(null);

      Player.movePlaylist();

      expect(playerSpy.after).to.not.be.called;
    });
  });

  describe("updatePlayerControlInterface()", () => {
    let inlineplayer;
    let input;

    let controls = document.createElement("div");
    let volumeSlider = document.createElement("input");
    let playButton = document.createElement("div");
    let prevNext = document.createElement("div");

    beforeEach(() => {
      input = { addEventListener: sinon.spy() };
      inlineplayer = {
        classList: { contains: sinon.stub() },
        prepend: sinon.spy()
      };

      volumeSlider.addEventListener = sinon.spy();
      sandbox.stub(Player, "createVolumeSlider").returns(volumeSlider);
      sandbox.stub(Player, "transferPlayButton").returns(playButton);
      sandbox.stub(Player, "transferPreviousNextButtons").returns(prevNext);

      sandbox.stub(document, "querySelector");
      document.querySelector
        .withArgs("div.inline_player")
        .returns(inlineplayer);

      sandbox.stub(document, "createElement");
      document.createElement.withArgs("div").returns(controls);

      sandbox.spy(controls, "append");
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("runs createVolumeSlider() and adds to eventListener", () => {
      player.updatePlayerControlInterface();

      expect(Player.createVolumeSlider).to.have.been.called;
      expect(volumeSlider.addEventListener).to.have.been.calledWith(
        "input",
        player.volumeSliderCallback
      );
    });

    it("runs transferPlayButton()", () => {
      player.updatePlayerControlInterface();

      expect(Player.transferPlayButton).to.have.been.called;
    });

    it("runs transferPreviousNextButtons()", () => {
      player.updatePlayerControlInterface();

      expect(Player.transferPreviousNextButtons).to.have.been.called;
    });

    it("appends input to document element if that element is not hidden \
      and the returned item added to the DOM contains the added elements", () => {
      inlineplayer.classList.contains.returns(false);

      player.updatePlayerControlInterface();

      expect(inlineplayer.prepend).to.have.been.calledWith(controls);
      expect(controls.append).to.have.been.calledWith(volumeSlider);
      expect(controls.append).to.have.been.calledWith(playButton);
      expect(controls.append).to.have.been.calledWith(prevNext);
    });

    it("does not append input to document element if that element is hidden", () => {
      inlineplayer.classList.contains.returns(true);

      player.updatePlayerControlInterface();

      expect(inlineplayer.prepend).to.not.have.been.called;
    });
  });

  describe("createVolumeSlider", () => {
    const audio = { volume: 0.1 };

    beforeEach(() => {
      sandbox.stub(document, "querySelector");
      document.querySelector.withArgs("audio").returns(audio);
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("creates an input element with specific attributes", () => {
      let volumeSlider = Player.createVolumeSlider();

      expect(volumeSlider.type).is.equal("range");
      expect(volumeSlider.min).is.equal("0");
      expect(volumeSlider.max).is.equal("1");
      expect(volumeSlider.step).is.equal("0.01");
      expect(volumeSlider.title).is.equal("volume control");
      expect(volumeSlider.value).is.equal("0.1");
    });
  });

  describe("transferPlayButton", () => {
    let expected_a = document.createElement("a");
    let play_cell = {
      parentNode: { removeChild: sinon.spy() },
      querySelector: sinon.stub().returns(expected_a)
    };

    beforeEach(() => {
      sandbox.stub(document, "querySelector");
      document.querySelector.withArgs("td.play_cell").returns(play_cell);
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("removes the td.play_cell element from DOM", () => {
      let playdiv = Player.transferPlayButton();

      expect(play_cell.parentNode.removeChild).to.be.calledWith(play_cell);
    });

    it("creates a div with specific attributes", () => {
      let playdiv = Player.transferPlayButton();

      const playdiv_a = playdiv.querySelector("a");
      expect(playdiv_a).is.equal(expected_a);
      expect(playdiv.className).is.equal("play_cell");
    });
  });

  describe("transferPrevNexButton", () => {
    let expected_prev_a = document.createElement("a");
    let prev_cell = {
      parentNode: { removeChild: sinon.spy() },
      querySelector: sinon.stub().returns(expected_prev_a)
    };

    let expected_next_a = document.createElement("a");
    let next_cell = {
      parentNode: { removeChild: sinon.spy() },
      querySelector: sinon.stub().returns(expected_next_a)
    };

    beforeEach(() => {
      sandbox.stub(document, "querySelector");
      document.querySelector.withArgs("td.prev_cell").returns(prev_cell);
      document.querySelector.withArgs("td.next_cell").returns(next_cell);
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("removes the td.prev_cell and td.next_cell from DOM", () => {
      let prevNext = Player.transferPreviousNextButtons();

      expect(prev_cell.parentNode.removeChild).to.be.calledWith(prev_cell);
      expect(next_cell.parentNode.removeChild).to.be.calledWith(next_cell);
    });

    it("creates a div with specific attributes", () => {
      let prevNext = Player.transferPreviousNextButtons();

      const divs = prevNext.querySelectorAll("div");
      expect(divs[0].querySelector("a")).is.equal(expected_prev_a);
      expect(divs[0].className).is.equal("prev");

      expect(divs[1].querySelector("a")).is.equal(expected_next_a);
      expect(divs[1].className).is.equal("next");
    });
  });

  describe("keydownCallback", () => {
    let spyElement;
    let event;

    beforeEach(() => {
      event = { key: "", preventDefault: sinon.spy(), target: document.body };
      spyElement = { click: sinon.spy() };

      sandbox.stub(document, "querySelector").returns(spyElement);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("if Meta (CMD on Mac) is pressed, nothing happens", () => {
      event.key = "Meta";
      player.keydownCallback(event);

      expect(event.preventDefault).to.have.not.been.called;
      expect(document.querySelector).to.have.not.been.called;
      expect(spyElement.click).to.have.not.been.called;
    });

    it("click play button if space or 'p' pushed", () => {
      event.key = "p";
      player.keydownCallback(event);

      expect(document.querySelector).to.be.calledWith("div.playbutton");
      expect(spyElement.click).to.have.been.called;

      event.key = " ";
      player.keydownCallback(event);

      expect(document.querySelector).to.be.calledWith("div.playbutton");
      expect(spyElement.click).to.have.been.called;
      expect(event.preventDefault).to.have.been.called;
    });

    it("click prevbutton if 'ArrowUp'", () => {
      event.key = "ArrowUp";
      player.keydownCallback(event);

      expect(document.querySelector).to.be.calledWith("div.prevbutton");
      expect(spyElement.click).to.have.been.called;
      expect(event.preventDefault).to.have.been.called;
    });

    it("click nextbutton if 'ArrowDown'", () => {
      event.key = "ArrowDown";
      player.keydownCallback(event);

      expect(document.querySelector).to.be.calledWith("div.nextbutton");
      expect(spyElement.click).to.have.been.called;
      expect(event.preventDefault).to.have.been.called;
    });

    it("jump audio ahead 10s if 'ArrowRight'", () => {
      spyElement.currentTime = 100;

      event.key = "ArrowRight";
      player.keydownCallback(event);

      expect(document.querySelector).to.be.calledWith("audio");
      expect(spyElement.currentTime).to.be.equal(110);
      expect(event.preventDefault).to.have.been.called;
    });

    it("jump audio back 10s if 'ArrowLeft'", () => {
      spyElement.currentTime = 100;

      event.key = "ArrowLeft";
      player.keydownCallback(event);

      expect(document.querySelector).to.be.calledWith("audio");
      expect(spyElement.currentTime).to.be.equal(90);
      expect(event.preventDefault).to.have.been.called;
    });

    it("does not prevent other keys from being called", () => {
      event.key = "null";
      player.keydownCallback(event);

      expect(event.preventDefault).to.have.not.been.called;
    });
  });

  describe("addOneClickBuyButtons", () => {
    let mockTralbumDetails;

    beforeEach(() => {
      mockTralbumDetails = {
        tracks: [
          { price: "1.00", currency: "USD", track_id: "123", title: "Track 1" },
          { price: "2.00", currency: "EUR", track_id: "456", title: "Track 2" }
        ]
      };

      createDomNodes(`
        <table class="track_list track_table" id="track_table">
            <tbody>
                <tr class="track_row_view">
                    <td class="play-col"></td>
                    <td class="track-number-col"></td>
                    <td class="title-col"> </td>
                    <td class="download-col"> </td>
                </tr>
                <tr class="track_row_view">
                    <td class="play-col"></td>
                    <td class="track-number-col"></td>
                    <td class="title-col"></td>
                    <td class="download-col"> </td>
                </tr>
            </tbody>
        </table>
        <div id="sidecart" style="display: block;"></div>
        <div id="item_list"></div>
      `);

      sandbox.stub(player, "createInputButtonPair").callsFake(() => {
        return document.createElement("div");
      });
      sandbox.stub(player, "addAlbumToCart").resolves({ ok: true });
      sandbox.stub(player, "createShoppingCartItem").callsFake(() => {
        return document.createElement("div");
      });
    });

    it("should create input-button pair for each track", () => {
      player.addOneClickBuyButtons(mockTralbumDetails);

      expect(player.createInputButtonPair.callCount).to.equal(
        mockTralbumDetails.tracks.length
      );
      mockTralbumDetails.tracks.forEach((track, index) => {
        expect(
          player.createInputButtonPair.getCall(index).args[0]
        ).to.deep.include({
          inputPrefix: "$",
          inputSuffix: track.currency,
          inputPlaceholder: track.price
        });
      });
    });

    it("should modify DOM correctly", () => {
      player.addOneClickBuyButtons(mockTralbumDetails);

      const rows = document.querySelectorAll("tr.track_row_view");
      expect(rows).to.have.length(2);

      expect(player.createInputButtonPair).to.be.calledTwice;

      rows.forEach(row => {
        expect(row.querySelector(".info-col")).to.be.null;
        expect(row.querySelectorAll(".download-col")).to.have.length(1);
        expect(
          row.querySelectorAll(".one-click-button-container")
        ).to.have.length(1);
      });
    });

    describe("onButtonClick callback", () => {
      let onButtonClick;

      beforeEach(() => {
        player.addOneClickBuyButtons(mockTralbumDetails);
        onButtonClick =
          player.createInputButtonPair.firstCall.args[0].onButtonClick;
      });

      it("should show error if value is less than price", () => {
        onButtonClick("0.50");
        expect(player.log.error).to.be.calledWith("track price too low");
      });

      it("should call addAlbumToCart with correct parameters", async () => {
        await onButtonClick("1.50");
        expect(player.addAlbumToCart).to.be.calledWith("123", "1.50", "t");
      });

      it("should create and append shopping cart item on successful response", async () => {
        const appendSpy = sinon.spy(
          document.querySelector("#item_list"),
          "append"
        );
        await onButtonClick("1.50");
        expect(player.createShoppingCartItem).to.be.calledOnce;
        expect(player.createShoppingCartItem).to.be.calledWith({
          itemId: "123",
          itemName: "Track 1",
          itemPrice: "1.00",
          itemCurrency: "USD"
        });

        expect(appendSpy).to.be.calledOnce;
      });

      it("should throw error on unsuccessful response", async () => {
        player.addAlbumToCart.resolves({ ok: false, status: 400 });

        try {
          await onButtonClick("1.50");
        } catch (error) {
          expect(error).to.be.an("error");
          expect(error.message).to.equal("HTTP error! status: 400");
        }
      });
    });
  });
});

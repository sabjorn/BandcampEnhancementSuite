import { createPagedata, createDomNodes, cleanupTestNodes } from "./utils.js";

import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import Cart from "../src/pages/cart.js";

describe("Cart", () => {
  let cart;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    cart = new Cart();

    cart.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };

    cart.createButton = sinon
      .stub()
      .onCall(0)
      .returns(
        Object.assign(document.createElement("div"), {
          id: "import-cart-button"
        })
      )
      .onCall(1)
      .returns(
        Object.assign(document.createElement("div"), {
          id: "export-cart-button"
        })
      )
      .onCall(2)
      .returns(
        Object.assign(document.createElement("div"), {
          id: "cart-refresh-button"
        })
      );

    createDomNodes(`<div id="sidecartReveal">
                    <div id='sidecartBody'</div>
                    </div>`);
  });

  afterEach(() => {
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("init()", () => {
    it("adds all buttons in correct order and with correct properties", () => {
      cart.init();

      const divs = document
        .querySelector("#sidecartReveal")
        .querySelectorAll("div");

      expect(cart.createButton).to.have.been.calledThrice;
      expect(divs[0].id).to.be.eq("import-cart-button");
      expect(divs[1].id).to.be.eq("sidecartBody");
      expect(divs[2].id).to.be.eq("export-cart-button");
      expect(divs[3].id).to.be.eq("cart-refresh-button");

      expect(divs[3].style.display).to.be.eq("none");
    });

    describe("import cart button callback", () => {
      let cartButtonCallback;
      const sampleData = {
        tracks_export: [
          {
            item_id: 123,
            unit_price: 1.23,
            item_type: "a",
            item_title: "Test Album",
            currency: "USD"
          },
          {
            item_id: 321,
            unit_price: 3.21,
            item_type: "t",
            item_title: "Test Track",
            currency: "CAD"
          }
        ]
      };
      beforeEach(() => {
        cart.init();

        cart.loadJsonFile = sinon.stub();
        cart.createShoppingCartItem = sinon.stub();
        cart.addAlbumToCart = sinon.stub();
        cart.reloadWindow = sinon.stub();

        createDomNodes(`<div id=item_list></div>`);

        const importButtonCallArgs = cart.createButton.getCall(0).args[0];
        expect(importButtonCallArgs.className).to.be.eq("buttonLink");
        expect(importButtonCallArgs.innerText).to.be.eq("import");

        cartButtonCallback = importButtonCallArgs.buttonClicked;
      });

      it("when json items avaialable -- it calls addAlbumToCart and adds to the #item_list", async () => {
        cart.loadJsonFile.resolves(sampleData);
        cart.addAlbumToCart.resolves({ ok: true });
        cart.createShoppingCartItem
          .onCall(0)
          .returns(
            Object.assign(document.createElement("div"), {
              id: "album"
            })
          )
          .onCall(1)
          .returns(
            Object.assign(document.createElement("div"), {
              id: "track"
            })
          );

        await cartButtonCallback();

        expect(cart.loadJsonFile).to.be.calledOnce;
        expect(cart.addAlbumToCart).to.be.calledTwice;
        expect(cart.addAlbumToCart.getCall(0)).to.have.been.calledWith(
          123,
          1.23,
          "a"
        );
        expect(cart.addAlbumToCart.getCall(1)).to.have.been.calledWith(
          321,
          3.21,
          "t"
        );

        expect(cart.createShoppingCartItem).to.be.calledTwice;
        expect(cart.createShoppingCartItem.getCall(0)).to.have.been.calledWith({
          itemId: 123,
          itemName: "Test Album",
          itemPrice: 1.23,
          itemCurrency: "USD"
        });
        expect(cart.createShoppingCartItem.getCall(1)).to.have.been.calledWith({
          itemId: 321,
          itemName: "Test Track",
          itemPrice: 3.21,
          itemCurrency: "CAD"
        });
        expect(cart.reloadWindow).to.be.calledOnce;
        const item_list_children = document.querySelector("#item_list")
          .children;
        expect(item_list_children[0].id).to.be.equal("album");
        expect(item_list_children[1].id).to.be.equal("track");
      });

      it("when no json items avaialable -- it does not call addAlbumToCart and does not add to the #item_list", async () => {
        cart.addAlbumToCart.resolves({ ok: true });
        cart.loadJsonFile.resolves({ tracks_export: [] });

        await cartButtonCallback();

        expect(cart.loadJsonFile).to.be.calledOnce;
        expect(cart.addAlbumToCart).to.be.not.called;
        expect(cart.createShoppingCartItem).to.be.not.called;
        expect(cart.reloadWindow).to.not.be.called;
        expect(document.querySelector("#item_list").children).to.have.length(0);
      });

      it("should throw error if unsuccful json load", async () => {
        cart.loadJsonFile.rejects(new Error("some_error"));

        try {
          await cartButtonCallback();
        } catch (error) {
          expect(error).to.be.an("error");
          expect(error.message).to.equal("Error loading JSON: some_error");
        }
      });

      it("should throw error on unsuccessful response", async () => {
        cart.addAlbumToCart.resolves({ ok: false, status: 400 });

        try {
          await cartButtonCallback();
        } catch (error) {
          expect(error).to.be.an("error");
          expect(error.message).to.equal(
            "Error loading JSON: HTTP error! status: 400"
          );
        }
      });
    });

    describe("export cart button callback", () => {
      let cartButtonCallback;

      beforeEach(() => {
        cart.downloadFile = sinon.stub();

        cart.init();

        const exportButtonCallArgs = cart.createButton.getCall(1).args[0];
        expect(exportButtonCallArgs.className).to.be.eq("buttonLink");
        expect(exportButtonCallArgs.innerText).to.be.eq("export");

        cartButtonCallback = exportButtonCallArgs.buttonClicked;
      });

      it("does not call downloadFile if no items in data-cart", () => {
        createDomNodes(
          `<script type="text/javascript" data-cart="{&quot;items&quot;:[]}"></script>`
        );

        cartButtonCallback();

        expect(cart.downloadFile).to.be.not.called;
      });

      it("calls downloadFile with items from data-cart", () => {
        const cart_id = 12345;
        const item1 = {
          band_name: "band_name_1",
          item_id: 111,
          item_title: "item_title_1",
          unit_price: 1.23,
          url: "url_1",
          currency: "currency_1",
          item_type: "t"
        };
        const item2 = {
          band_name: "band_name_2",
          item_id: 222,
          item_title: "item_title_2",
          unit_price: 4.56,
          url: "url_2",
          currency: "currency_2",
          item_type: "a"
        };
        createDomNodes(
          `<script type="text/javascript" data-cart="
            {
                &quot;items&quot;:[{
                    &quot;item_type&quot;:&quot;${item1.item_type}&quot;,
                    &quot;item_id&quot;:${item1.item_id},
                    &quot;unit_price&quot;:${item1.unit_price},
					&quot;currency&quot;:&quot;${item1.currency}&quot;,
					&quot;cart_id&quot;:${cart_id},
					&quot;item_title&quot;:&quot;${item1.item_title}&quot;,
					&quot;band_name&quot;:&quot;${item1.band_name}&quot;,
					&quot;url&quot;:&quot;${item1.url}&quot;
                },{
                    &quot;item_type&quot;:&quot;${item2.item_type}&quot;,
                    &quot;item_id&quot;:${item2.item_id},
                    &quot;unit_price&quot;:${item2.unit_price},
					&quot;currency&quot;:&quot;${item2.currency}&quot;,
					&quot;cart_id&quot;:${cart_id},
					&quot;item_title&quot;:&quot;${item2.item_title}&quot;,
					&quot;band_name&quot;:&quot;${item2.band_name}&quot;,
					&quot;url&quot;:&quot;${item2.url}&quot;
                }]}
            "></script>`
        );

        cartButtonCallback();

        expect(cart.downloadFile).to.be.calledOnce;
        const downloadFileCallArgs = JSON.parse(
          cart.downloadFile.getCall(0).args[1]
        );
        expect(downloadFileCallArgs.cart_id).to.be.eq(cart_id);
        expect(downloadFileCallArgs.tracks_export[0]).to.be.deep.eq(item1);
        expect(downloadFileCallArgs.tracks_export[1]).to.be.deep.eq(item2);
      });

      it("does not call downloadFile when item_type not 't' or 'a'", () => {
        const incorrect_item_type = "p";
        createDomNodes(
          `<script type="text/javascript" data-cart="
            {
                &quot;items&quot;:[{
                    &quot;item_type&quot;:&quot;${incorrect_item_type}&quot;,
                    &quot;item_id&quot;:123,
                    &quot;unit_price&quot;:1.3,
					&quot;currency&quot;:&quot;CAD&quot;,
					&quot;cart_id&quot;:999,
					&quot;item_title&quot;:&quot;item_title&quot;,
					&quot;band_name&quot;:&quot;band_name&quot;,
					&quot;url&quot;:&quot;url&quot;
                }]}
            "></script>`
        );

        cartButtonCallback();

        expect(cart.downloadFile).to.be.not.called;
      });
    });

    describe("refresh button callback", () => {
      let cartButtonCallback;

      beforeEach(() => {
        cart.init();

        cart.reloadWindow = sinon.stub();

        const exportButtonCallArgs = cart.createButton.getCall(2).args[0];

        expect(exportButtonCallArgs.className).to.be.eq("buttonLink");
        expect(exportButtonCallArgs.innerText).to.be.eq("⟳");

        cartButtonCallback = exportButtonCallArgs.buttonClicked;
      });

      it("reloads window", () => {
        cartButtonCallback();

        expect(cart.reloadWindow).to.be.calledOnce;
      });
    });

    describe("item list mutation", () => {
      beforeEach(() => {
        createDomNodes(
          `<script type="text/javascript" data-cart="{
                &quot;items&quot;:[{&quot;item_title&quot;:&quot;single item&quot;}]
            }"></script>
            <div id="item_list">
                <li class="item">item1</li>
            </div> `
        );
      });

      it("sets display of refresh and export buttons when number of items mateches", async () => {
        await cart.init();
        const refreshButton = document.querySelector("#cart-refresh-button");
        const exportButton = document.querySelector("#export-cart-button");

        const item = document.createElement("li");
        item.className = "item"; // Add the 'item' class
        document.querySelector("#item_list").append(item);

        // wait for Mutation observer to resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(refreshButton.style.display).to.be.eq("block");
        expect(exportButton.style.display).to.be.eq("none");

        item.remove();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(refreshButton.style.display).to.be.eq("none");
        expect(exportButton.style.display).to.be.eq("block");
      });
    });
  });
});

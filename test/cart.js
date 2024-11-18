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

  const createButtonReturnValue = Object.assign(document.createElement("div"), {
    id: "button"
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    cart = new Cart();

    sandbox.stub(cart, "log");

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

    describe("export cart button callback", () => {
      let cartButtonCallback;

      beforeEach(() => {
        cart.downloadFile = sinon.stub();

        cart.init();

        const importButtonCallArgs = cart.createButton.getCall(1).args[0];
        expect(importButtonCallArgs.className).to.be.eq("buttonLink");
        expect(importButtonCallArgs.innerText).to.be.eq("export");

        cartButtonCallback = importButtonCallArgs.buttonClicked;
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
  });
});

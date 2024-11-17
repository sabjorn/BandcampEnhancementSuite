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
  });
});

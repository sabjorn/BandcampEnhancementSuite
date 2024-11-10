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
    cart.createButton = sinon.stub().returns(createButtonReturnValue);

    createDomNodes(`<div id="sidecartReveal"></div>`);
  });

  afterEach(() => {
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("init()", () => {
    it("adds cartRefreshButton to sidecartReveal element", () => {
      cart.init();

      expect(cart.createButton).to.have.been.called;
      expect(document.querySelectorAll("#button")).to.have.length(1);
    });
  });
});

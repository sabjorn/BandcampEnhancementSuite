import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
chai.use(sinonChai);

chai.use(sinonChai);

import Checkout from "../src/checkout.js";

describe("Checkout", () => {
  let c;
  let sandbox;

  let mockPort;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockPort = {
      onMessage: { addListener: sinon.stub() },
      postMessage: sinon.spy()
    };

    c = new Checkout(mockPort);

    c.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("init()", () => {
    let checkoutButtonSubSpy = {
      addEventListener: sinon.spy()
    };

    let yesButtonSpy = {
      addEventListener: sinon.spy()
    };

    let notNowButtonSpy = {
      addEventListener: sinon.spy()
    };

    let noButtonSpy = {
      addEventListener: sinon.spy()
    };

    let closeButtonSpy = {
      addEventListener: sinon.spy()
    };

    let dialogSpy = {
      querySelector: sinon.stub()
    };

    beforeEach(() => {
      sandbox
        .stub(Checkout, "replaceCheckoutButton")
        .returns(checkoutButtonSubSpy);
      sandbox.stub(Checkout, "createDialog").returns(dialogSpy);

      dialogSpy.querySelector
        .withArgs("#yes")
        .returns(yesButtonSpy)
        .withArgs("#not_now")
        .returns(notNowButtonSpy)
        .withArgs("#no")
        .returns(noButtonSpy)
        .withArgs("#bes_close")
        .returns(closeButtonSpy);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("creates checkout_button_sub with clickable interface", () => {
      c.init();

      expect(Checkout.replaceCheckoutButton).to.have.been.called;
      expect(checkoutButtonSubSpy.addEventListener).to.have.been.calledWith(
        "click",
        c.checkoutButtonClicked
      );
    });

    it("creates dialog and attach clickable interface to buttons", () => {
      c.init();

      expect(Checkout.createDialog).to.have.been.called;
      expect(yesButtonSpy.addEventListener).to.have.been.calledWith(
        "click",
        c.yesButtonClicked
      );
      expect(notNowButtonSpy.addEventListener).to.have.been.calledWith(
        "click",
        c.closeDialogAndGoToCart
      );
      expect(noButtonSpy.addEventListener).to.have.been.calledWith(
        "click",
        c.noButtonClicked
      );
    });
  });

  describe("checkoutButtonClicked()", () => {
    let clock;
    beforeEach(() => {
      c.closeDialogAndGoToCart = sinon.spy();
      c.dialog = { style: { display: "none" } };

      clock = sinon.useFakeTimers(10);
    });
    afterEach(() => {
      clock.restore();
    });

    it("makes dialog appear when checkout button pressed from default configuration", () => {
      c.config = {
        albumPurchasedDuringCheckout: false,
        albumOnCheckoutDisabled: false,
        albumPurchaseTimeDelaySeconds: 0,
        installDateUnixSeconds: 0
      };

      c.checkoutButtonClicked();

      expect(c.dialog.style.display).to.equal("block");
      expect(c.closeDialogAndGoToCart).to.have.not.been.called;
    });

    it("does not display dialog and calls closeDialogAndGoToCart() if 'albumPurchaseTimeDelaySeconds' not greater than current time minus 'installDateUnixSeconds'", () => {
      c.config = {
        albumPurchasedDuringCheckout: false,
        albumOnCheckoutDisabled: false,
        albumPurchaseTimeDelaySeconds: 11,
        installDateUnixSeconds: 0
      };

      c.checkoutButtonClicked();

      expect(c.dialog.style.display).to.equal("none");
      expect(c.closeDialogAndGoToCart).to.have.been.called;
    });

    it("does not display dialog and calls closeDialogAndGoToCart() if 'albumOnCheckoutDisabled' in config is true", () => {
      c.config = {
        albumPurchasedDuringCheckout: false,
        albumOnCheckoutDisabled: true,
        albumPurchaseTimeDelaySeconds: 0,
        installDateUnixSeconds: 0
      };

      c.checkoutButtonClicked();

      expect(c.dialog.style.display).to.equal("none");
      expect(c.closeDialogAndGoToCart).to.have.been.called;
    });

    it("does not display dialog and calls closeDialogAndGoToCart() if 'albumPurchasedDuringCheckout[status]' in config is true", () => {
      c.config = {
        albumPurchasedDuringCheckout: true,
        albumOnCheckoutDisabled: false,
        albumPurchaseTimeDelaySeconds: 0,
        installDateUnixSeconds: 0
      };

      c.checkoutButtonClicked();

      expect(c.dialog.style.display).to.equal("none");
      expect(c.closeDialogAndGoToCart).to.have.been.called;
    });
  });

  describe("closeDialogAndGoToCart()", () => {
    const checkout_button_spy = {
      dispatchEvent: sinon.spy()
    };

    beforeEach(() => {
      c.dialog = { style: { display: "none" } };

      sandbox
        .stub(document, "querySelector")
        .withArgs("#sidecartCheckout")
        .returns(checkout_button_spy);
    });

    it("it closes the dialog box and clicks cart button", () => {
      c.closeDialogAndGoToCart();

      expect(c.dialog.style.display).to.equal("none");
      expect(checkout_button_spy.dispatchEvent).to.have.been.called;
    });
  });

  describe("yesButtonClicked()", () => {
    const fake_input = {
      value: ""
    };

    const fake_error = {
      innerHTML: ""
    };

    beforeEach(() => {
      c.addAlbumToCart = sinon.stub();
      c.closeDialogAndGoToCart = sinon.spy();

      c.dialog = { querySelector: sinon.stub() };
      c.dialog.querySelector
        .withArgs("input")
        .returns(fake_input)
        .withArgs("#bes_checkout_error")
        .returns(fake_error);
    });

    it("displays error and does nothing if minimum amount is not met", () => {
      fake_input.value = "4.99";

      c.yesButtonClicked();

      expect(fake_error.innerHTML).to.equal("value entered is under $5.00 CAD");
      expect(c.addAlbumToCart).to.not.have.been.called;
      expect(c.closeDialogAndGoToCart).to.not.have.been.called;
    });

    it("sets 'albumPurchasedDuringCheckout' to 'true' in config and calls 'closeDialogAndGoToCart()'", () => {
      const fake_promise_success = Promise.resolve();
      c.addAlbumToCart.returns(fake_promise_success);
      fake_input.value = "5.00";

      c.yesButtonClicked();

      expect(mockPort.postMessage).to.have.been.calledWith({
        config: { albumPurchasedDuringCheckout: true }
      });
      expect(c.closeDialogAndGoToCart).to.be.called;
    });

    it("skips setting config if fetch fails", () => {
      const fake_promise_fail = Promise.reject();
      c.addAlbumToCart.returns(fake_promise_fail);
      fake_input.value = "5.00";

      c.yesButtonClicked();
      expect(mockPort.postMessage).to.not.be.called;
      expect(c.closeDialogAndGoToCart).to.be.called;
    });
  });

  describe("noButtonClicked()", () => {
    beforeEach(() => {
      c.closeDialogAndGoToCart = sinon.spy();
    });

    it("it set 'albumOnCheckoutDisabled = false' and calls 'closeDialogAndGoToCart()'", () => {
      c.noButtonClicked();

      expect(mockPort.postMessage).to.have.been.calledWith({
        config: { albumOnCheckoutDisabled: true }
      });
      expect(c.closeDialogAndGoToCart).to.be.called;
    });
  });
});

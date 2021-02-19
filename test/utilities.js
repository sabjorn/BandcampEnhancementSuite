import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import { mousedownCallback } from "../src/utilities.js";
import DBUtils from "../src/utilities.js";

describe("mousedownCallback", () => {
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

    mousedownCallback(event);

    expect(document.querySelector).to.be.calledWith("audio");
    expect(spyElement.currentTime).to.be.equal(50);
  });
});

describe("DBUtils", () => {
  const dbu = new DBUtils();
  let openDBStub;

  beforeEach(function() {
    openDBStub = sinon.stub(dbu, "openDB");
  });

  afterEach(function() {
    openDBStub.restore();
  });
  describe("getDB", () => {
    it("should call idb openDB with specific args", async () => {
      const db = await dbu.getDB("somename"); //, openDBStub);

      expect(openDBStub).to.be.calledWith(
        "BandcampEnhancementSuite",
        1,
        sinon.match.any
      );
    });
  });
});

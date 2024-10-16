import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
import { createDomNodes, cleanupTestNodes } from "./utils.js";
chai.use(sinonChai);

import { mousedownCallback } from "../src/utilities.js";
import DBUtils from "../src/utilities.js";
import { extractBandFollowInfo } from "../src/utilities.js";

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
      target: { offsetWidth: 2 }
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
      const db = await dbu.getDB("somename");

      expect(openDBStub).to.be.calledWith(
        "BandcampEnhancementSuite",
        2,
        sinon.match.any
      );
    });
  });
});

describe("extractBandFollowInfo", () => {
  beforeEach(() => {
    createDomNodes(`
            <script type="text/javascript" data-band-follow-info="{&quot;tralbum_id&quot;:2105824806,&quot;tralbum_type&quot;:&quot;a&quot;}"></script>
          `);
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it("should return a specific set of data", () => {
    const bandInfo = extractBandFollowInfo();
    expect(bandInfo).to.deep.equal({
      tralbum_id: 2105824806,
      tralbum_type: "a"
    });
  });
});

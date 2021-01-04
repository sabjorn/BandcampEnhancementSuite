import { createDomNodes, cleanupTestNodes } from "./utils.js";
import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
import chrome from "sinon-chrome";
chai.use(sinonChai);

import LabelViewBackend from "../src/background/label_view_backend.js";

// Sinon-chrome doesn't handle ports, so let's make our own
const mockPort = { postMessage: sinon.spy() };

describe("LabelViewBackend", () => {
  let lvb;
  let sandbox;

  // Global db setup for use in all tests
  let db;
  before(async () => {
    db = await LabelViewBackend.getDB("testStore");
  });

  beforeEach(() => {
    // Reset state before each test run
    sandbox = sinon.createSandbox();
    lvb = new LabelViewBackend();

    // Prevent Logger output during tests
    sandbox.stub(lvb, "log");
  });

  afterEach(() => {
    // Preemptive removal of any test-nodes
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("init()", () => {
    beforeEach(() => {
      global.chrome = chrome;
    });

    it("should call chrome.runtime.onConnect", () => {
      lvb.init();
      expect(chrome.runtime.onConnect.addListener).to.be.called;
    });

    it("should call chrome.runtime.onInstalled", () => {
      lvb.init();
      expect(chrome.runtime.onInstalled.addListener).to.be.called;
    });
  });

  describe("getDB()", () => {
    it("should return an IDBDatabase", async () => {
      expect(db instanceof IDBDatabase).to.be.true;
    });

    it('should name the database "BandcampEnhancementSuite"', async () => {
      expect(db.name).to.equal("BandcampEnhancementSuite");
    });
  });

  describe("setVal()", () => {
    it("should set a db value", async () => {
      await LabelViewBackend.setVal("testStore", "testKey", "testVal");
      const fetched = await db.get("testStore", "testVal");
      expect(fetched).to.equal("testKey");
    });
  });

  describe("getVal()", () => {
    it("should get a db value", async () => {
      await db.put("testStore", "testVal2", "testKey2");
      const fetched = await LabelViewBackend.getVal("testStore", "testKey2");
      expect(fetched).to.equal("testVal2");
    });
  });

  describe("query()", () => {
    describe("when key does not have a value", () => {
      beforeEach(async () => {
        await db.delete("testStore", "testKey");
      });

      it("should set the DB key to false", async () => {
        // Initial check: confirm key is unset
        const initialVal = await db.get("testStore", "testKey");
        expect(initialVal).to.be.undefined;

        // Confirm it gets set to false
        await LabelViewBackend.query("testStore", "testKey", mockPort);
        const finalVal = await db.get("testStore", "testKey");
        expect(finalVal).to.be.false;
      });

      it("should postMessage with value=false", async () => {
        await LabelViewBackend.query("testStore", "testKey", mockPort);
        expect(mockPort.postMessage).to.be.calledWith({
          id: { key: "testKey", value: false }
        });
      });
    });

    describe("when key has a value", () => {
      it("should call portMessage with fetched value", async () => {
        // Load expected value into key
        await db.put("testStore", "testVal", "testKey");

        await LabelViewBackend.query("testStore", "testKey", mockPort);
        expect(mockPort.postMessage).to.be.calledWith({
          id: { key: "testKey", value: "testVal" }
        });
      });
    });
  });

  describe("toggle()", () => {
    describe("when the value is true", () => {
      it("should set it to false", async () => {
        // Load expected value into key
        await db.put("testStore", true, "testKey");
        await LabelViewBackend.toggle("testStore", "testKey", mockPort);
        const finalVal = await db.get("testStore", "testKey");
        expect(finalVal).to.be.false;
      });

      it("should postMessage with value=false", async () => {
        await db.put("testStore", true, "testKey");
        await LabelViewBackend.toggle("testStore", "testKey", mockPort);
        expect(mockPort.postMessage).to.be.calledWith({
          id: { key: "testKey", value: false }
        });
      });
    });

    describe("when the value is false", () => {
      it("should set it to true", async () => {
        // Load expected value into key
        await db.put("testStore", false, "testKey");
        await LabelViewBackend.toggle("testStore", "testKey", mockPort);
        const finalVal = await db.get("testStore", "testKey");
        expect(finalVal).to.be.true;
      });

      it("should postMessage with value=true", async () => {
        await db.put("testStore", false, "testKey");
        await LabelViewBackend.toggle("testStore", "testKey", mockPort);
        expect(mockPort.postMessage).to.be.calledWith({
          id: { key: "testKey", value: true }
        });
      });
    });
  });

  describe("setTrue()", () => {
    it("should set the key to true", async () => {
      // Pre-populate non-true value to ensure update
      await db.put("testStore", false, "testKey");

      await LabelViewBackend.setTrue("testStore", "testKey", mockPort);
      const finalVal = await db.get("testStore", "testKey");
      expect(finalVal).to.be.true;
    });

    it("should postMessage with value=true", async () => {
      await LabelViewBackend.setTrue("testStore", "testKey", mockPort);
      expect(mockPort.postMessage).to.be.calledWith({
        id: { key: "testKey", value: true }
      });
    });
  });
});

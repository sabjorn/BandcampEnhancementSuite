import { createDomNodes, cleanupTestNodes } from "./utils.js";
import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
import chrome from "sinon-chrome";
chai.use(sinonChai);

import DBUtils from "../src/utilities.js";
import LabelViewBackend from "../src/background/label_view_backend.js";

const mockPort = { postMessage: sinon.stub() };

describe("LabelViewBackend", () => {
  let lvb;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    lvb = new LabelViewBackend();

    sandbox.stub(lvb, "log");
  });

  afterEach(() => {
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

  describe("static methods", () => {
    let dbStub;
    let dbUtilsStub;

    beforeEach(() => {
      dbStub = { get: sinon.stub(), put: sinon.spy() };

      dbUtilsStub = new DBUtils();
      sinon.stub(dbUtilsStub, "getDB").resolves(dbStub);
    });

    describe("query()", () => {
      describe("when key does not have a value", () => {
        it("should set the DB key to false", () => {
          dbStub.get.resolves();

          return LabelViewBackend.query(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(dbStub.get).to.be.calledWith("testStore", "testKey");
            expect(dbStub.put).to.be.calledWith("testStore", false, "testKey");
          });
        });

        it("should postMessage with value=false", () => {
          dbStub.get.resolves();

          return LabelViewBackend.query(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(mockPort.postMessage).to.be.calledWith({
              id: { key: "testKey", value: false }
            });
          });
        });
      });

      describe("when key has a value", () => {
        it("should call portMessage with fetched value", async () => {
          dbStub.get.resolves("testValue");

          return LabelViewBackend.query(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(mockPort.postMessage).to.be.calledWith({
              id: { key: "testKey", value: "testValue" }
            });
          });
        });
      });
    });

    describe("toggle()", () => {
      describe("when the value is true", () => {
        beforeEach(() => {
          dbStub.get.resolves(true);
        });

        it("should set it to false", () => {
          return LabelViewBackend.toggle(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(dbStub.get).to.be.calledWith("testStore", "testKey");
            expect(dbStub.put).to.be.calledWith("testStore", false, "testKey");
          });
        });

        it("should postMessage with value=false", () => {
          return LabelViewBackend.toggle(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(mockPort.postMessage).to.be.calledWith({
              id: { key: "testKey", value: false }
            });
          });
        });
      });

      describe("when the value is false", () => {
        beforeEach(() => {
          dbStub.get.resolves(false);
        });

        it("should set it to true", () => {
          return LabelViewBackend.toggle(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(dbStub.get).to.be.calledWith("testStore", "testKey");
            expect(dbStub.put).to.be.calledWith("testStore", true, "testKey");
          });
        });

        it("should postMessage with value=true", () => {
          return LabelViewBackend.toggle(
            "testStore",
            "testKey",
            mockPort,
            dbUtilsStub
          ).then(() => {
            expect(mockPort.postMessage).to.be.calledWith({
              id: { key: "testKey", value: true }
            });
          });
        });
      });
    });

    describe("setTrue()", () => {
      it("should set the key to true", () => {
        return LabelViewBackend.setTrue(
          "testStore",
          "testKey",
          mockPort,
          dbUtilsStub
        ).then(() => {
          expect(dbStub.put).to.be.calledWith("testStore", true, "testKey");
        });
      });

      it("should postMessage with value=true", () => {
        return LabelViewBackend.setTrue(
          "testStore",
          "testKey",
          mockPort,
          dbUtilsStub
        ).then(() => {
          expect(mockPort.postMessage).to.be.calledWith({
            id: { key: "testKey", value: true }
          });
        });
      });
    });
  });
});

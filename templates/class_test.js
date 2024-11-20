// A Template for quickly creating tests for a new class

import { createPagedata, createDomNodes, cleanupTestNodes } from "./utils.js";

import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
chai.use(sinonChai);

import Class from "../src/class.js";

describe("Class", () => {
  let c;
  let sandbox;

  beforeEach(() => {
    // Reset state before each test run
    sandbox = sinon.createSandbox();
    c = new Class();

    // Prevent Logger output during tests
    c.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };
  });

  afterEach(() => {
    // Preemptive removal of any test-nodes
    cleanupTestNodes();
    sandbox.restore();
  });

  describe("init()", () => {
    describe("some state branch", () => {
      it("should ..", () => {
        createDomNodes(`
          <div id="testId" class="preview">
            <button class="historybox"></button>
          </div>
        `);
        c.init();
        expect(true).to.be.false;
      });
    });

    describe("other state branch", () => {
      it("should ...", () => {
        createDomNodes(`
          <div id="testId" class="preview">
            <button class="historybox"></button>
          </div>
        `);

        c.init();
        expect(false).to.be.true;
      });
    });
  });
});

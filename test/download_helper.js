"use strict";

// Import/require doesn't work here because this is not in NodeJS or Webpack
// Assertions: https://www.chaijs.com/api/bdd/
import chai from 'chai';
import { assert, expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai'
chai.use(sinonChai);

import * as helper from '../src/download_helper';

// Mock anchor base URL, used in generator and tests
const mockAnchorHref = "https://p4.bcbits.com/download";

// Mock anchor generator
const createAnchor = id => {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", `${mockAnchorHref}/${id}`);
  return anchor;
};

describe("Download Helper", () => {
  describe("generateDownloadList()", () => {
    beforeEach(() => {
      // Clean up added anchors before each test
      document
        .querySelectorAll(`a[href^="${mockAnchorHref}/"]`)
        .forEach(anchor => {
          anchor.remove();
        });
    });

    describe("when there are no valid anchors", () => {
      it("should return an empty string", () => {
        const list = helper.generateDownloadList();
        expect(list).to.equal("");
      });
    });

    describe("when there is one valid anchor", () => {
      it("should return a single line", () => {
        // Append a single fake link to the page
        document.body.appendChild(createAnchor(1));

        const list = helper.generateDownloadList();
        let lines = list.split(/\r\n|\r|\n/);

        // Remove empty strings from lines array (trailing newline)
        lines = lines.filter(Boolean);

        expect(lines.length).to.equal(1);
      });
    });

    describe("when there are duplicate anchors", () => {
      it("should not return duplicates", () => {
        // Append multiple identical links to the page
        document.body.appendChild(createAnchor(1));
        document.body.appendChild(createAnchor(1));

        const list = helper.generateDownloadList();
        let lines = list.split(/\r\n|\r|\n/);

        // Remove empty strings from lines array (trailing newline)
        lines = lines.filter(Boolean);
        expect(lines.length).to.equal(1);
      });
    });

    describe("when there are multiple anchors", () => {
      it("should return all anchors", () => {
        // Append multiple identical links to the page
        document.body.appendChild(createAnchor(1));
        document.body.appendChild(createAnchor(2));

        const list = helper.generateDownloadList();
        let lines = list.split(/\r\n|\r|\n/);

        // Remove empty strings from lines array (trailing newline)
        lines = lines.filter(Boolean);
        expect(lines.length).to.equal(2);
      });
    });
  });

  describe("download()", () => {
    let assignStub;

    beforeEach(() => {
      assignStub = sinon.stub(helper, 'assignLocation').returns(null);
    });

    afterEach(() => {
        helper.assignLocation.restore(); // Unwraps the spy
    });

    it("should trigger a window download", () => {
      helper.download("test", "test");
      expect(assignStub).to.have.been.called;
    });

    it("should URI Encode the input text", () => {
      const plaintext = "text with spaces"
      const encoded = encodeURIComponent(plaintext)

      helper.download("test", plaintext);
      const url = assignStub.getCall(0).firstArg
      expect(url.endsWith(encoded)).to.be.true;
    });

    it("should start href with data properties", () => {
      helper.download("test", "test");
      const url = assignStub.getCall(0).firstArg
      expect(url.startsWith('data:text/plain;charset=utf-8,')).to.be.true;
    });
  });
});

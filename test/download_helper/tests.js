"use strict";

// Import/require doesn't work here because this is not in NodeJS or Webpack
// Assertions: https://www.chaijs.com/api/bdd/
const expect = this.chai.expect;

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
        const list = generateDownloadList();
        expect(list).to.equal("");
      });
    });

    describe("when there is one valid anchor", () => {
      it("should return a single line", () => {
        // Append a single fake link to the page
        document.body.appendChild(createAnchor(1));

        const list = generateDownloadList();
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

        const list = generateDownloadList();
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

        const list = generateDownloadList();
        let lines = list.split(/\r\n|\r|\n/);

        // Remove empty strings from lines array (trailing newline)
        lines = lines.filter(Boolean);
        expect(lines.length).to.equal(2);
      });
    });
  });

  describe("download()", () => {
    // These tests use `done()` so as to ensure the event listeners are
    // triggered and processed before the test can be marked as complete.
    it("should trigger a click event on #bes-hidden-download", done => {
      const listener = event => {
        const id = event.target.getAttribute("id");
        expect(id).to.equal("bes-hidden-download");
        done();
      };

      window.addEventListener("click", listener);
      download("test", "test");
      window.removeEventListener("click", listener);
    });

    it("should set the download attribute to the input filename", done => {
      const listener = event => {
        const downloadAttr = event.target.getAttribute("download");
        expect(downloadAttr).to.equal("testDownloadAttr");
        done();
      };

      window.addEventListener("click", listener);
      download("testDownloadAttr", "test");
      window.removeEventListener("click", listener);
    });

    it("should URI Encode the input text to the href", done => {
      const listener = event => {
        const href = event.target.getAttribute("href");
        expect(href.indexOf("%20")).to.not.equal(-1);
        done();
      };

      window.addEventListener("click", listener);
      download("test", "text with spaces to test uriencode");
      window.removeEventListener("click", listener);
    });

    it("should start href with data properties", done => {
      const listener = event => {
        const href = event.target.getAttribute("href");
        expect(href.indexOf("data:text/plain;charset=utf-8,")).to.equal(0);
        done();
      };

      window.addEventListener("click", listener);
      download("test", "test");
      window.removeEventListener("click", listener);
    });

    it("should CSS-hide the element", done => {
      const listener = event => {
        expect(event.target.style.display).to.equal("none");
        done();
      };

      window.addEventListener("click", listener);
      download("test", "test");
      window.removeEventListener("click", listener);
    });

    it("should not leave an anchor behind", () => {
      download("test", "test");
      const anchor = document.querySelector(`#bes-hidden-download`);
      expect(anchor).to.be.null;
    });
  });
});

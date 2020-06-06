import Logger from "./logger";

export class DownloadHelper {
  constructor() {
    this.log = new Logger();

    this.mutationCallback = DownloadHelper.callback.bind(this); // necessary for class callback
    this.observer = new MutationObserver(this.mutationCallback);

    this.linksReady;
    this.button;
  }

  init() {
    this.log.info("Initiating BES Download Helper");

    this.createButton();

    this.mutationCallback();

    const config = { attributes: true, attributeFilter: ["href"] }; // observe if download links change
    const targetNodes = document.querySelectorAll(
      ".download-title .item-button"
    );

    for (let node of targetNodes) {
      this.observer.observe(node, config);
    }
  }

  createButton() {
    if (this.button) return;

    let location = document.querySelector("div.download-titles");

    this.button = document.createElement("button");
    this.button.title =
      "Generates a file for automating downloads using 'curl'";
    this.button.className = "downloadall";
    this.button.disabled = true;
    this.button.textContent = "preparing download";

    location.append(this.button);
  }

  enableButton() {
    this.log.info("enableButton()");

    this.button.disabled = false;
    this.button.textContent = "Download curl File";

    this.button.addEventListener("click", function() {
      const date = DownloadHelper.dateString();
      const downloadList = DownloadHelper.generateDownloadList();
      const downloadDocument = preamble + downloadList;

      DownloadHelper.download(`bandcamp_${date}.txt`, downloadDocument);
    });
  }

  disableButton() {
    this.log.info("disableButton()");

    this.button.disabled = true;
    this.button.removeEventListener("click", function() {});
    this.button.textContent = "preparing download";
  }

  static generateDownloadList() {
    let filelist = "";
    document.querySelectorAll("a.item-button").forEach((item, index, list) => {
      const url = item.getAttribute("href");
      // Prevent duplicate URLs
      if (filelist.indexOf(url) === -1) {
        filelist += "curl -OJ " + url + " \\ &\n";
      }
    });
    filelist = filelist.substring(0, filelist.length - 5);
    return filelist;
  }

  static download(filename, text) {
    var element = document.createElement("a");

    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  static dateString() {
    const currentdate = new Date();
    const ye = new Intl.DateTimeFormat("en", { year: "2-digit" }).format(
      currentdate
    );
    const mo = new Intl.DateTimeFormat("en", { month: "2-digit" }).format(
      currentdate
    );
    const da = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(
      currentdate
    );

    return `${da}-${mo}-${ye}`;
  }

  static callback() {
    let allDownloadLinks = document.querySelectorAll(
      ".download-title .item-button"
    );

    let linksReady = true;
    allDownloadLinks.forEach(function(element, index) {
      if (element.style.display === "none") {
        linksReady = false;
        return;
      }
    });

    this.log.info("linksReady", linksReady);
    if (linksReady) {
      this.enableButton();
      return;
    }

    this.disableButton();
  }
}

export const preamble = `# Generated by Bandcamp Enhancement Suite (https://github.com/sabjorn/BandcampEnhancementSuite)
#
# The following can be used to batch download your recent purchase.
#
# Usage (Mac/Linux):
# 1) open Terminal
# 2) move to desired download directory (e.g. \`cd ~/Downloads/bandcamp\`)
# 3) paste the text of this file into Terminal\n\n`;

window.onload = () => {
  let checkIsDownloadPage = document.querySelector(".download-item-container");
  if (checkIsDownloadPage) {
    const dh = new DownloadHelper();
    dh.init();
  }
};

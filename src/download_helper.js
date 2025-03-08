import Logger from "./logger";

import { downloadFile, dateString } from "./utilities";

const preamble = `#!/usr/bin/env bash
# Generated by Bandcamp Enhancement Suite (https://github.com/sabjorn/BandcampEnhancementSuite)
#
# The following can be used to batch download your recent purchase.
#
# Usage (Mac/Linux):
# 1) open Terminal
# 2) move to desired download directory (e.g. \`cd ~/Downloads/bandcamp\`)
# 3) paste the text of this file into Terminal\n\n`;

export default class DownloadHelper {
  constructor() {
    this.log = new Logger();

    this.mutationCallback = DownloadHelper.callback.bind(this); // necessary for class callback
    this.observer = new MutationObserver(this.mutationCallback);

    // re-import
    DownloadHelper.dateString = dateString;
    DownloadHelper.downloadFile = downloadFile;

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
      "Generates a file for automating downloads using 'cURL'";
    this.button.className = "bes-downloadall";
    this.button.disabled = true;
    this.button.textContent = "preparing download";

    location.append(this.button);
  }

  enableButton() {
    this.log.info("enableButton()");

    this.button.disabled = false;
    this.button.textContent = "Download cURL File";

    this.button.addEventListener("click", function() {
      const date = DownloadHelper.dateString();
      const downloadList = DownloadHelper.generateDownloadList();
      const preamble = DownloadHelper.getDownloadPreamble();
      const downloadDocument = preamble + downloadList;

      DownloadHelper.downloadFile(`bandcamp_${date}.txt`, downloadDocument);
    });
  }

  disableButton() {
    this.log.info("disableButton()");

    this.button.disabled = true;
    this.button.removeEventListener("click", function() {});
    this.button.textContent = "preparing download";
  }

  static generateDownloadList() {
    const urlSet = new Set(
      [...document.querySelectorAll("a.item-button")]
        .map(item => item.getAttribute("href"))
        .filter(url => url)
    );

    if (urlSet.size === 0) return "";

    const urls = [...urlSet];
    const lastUrl = urls.pop();

    const fileList =
      urls.length > 0
        ? urls.map(url => `curl -OJ "${url}" &&`).join(" \\\n") +
          " \\\n" +
          `curl -OJ "${lastUrl}"`
        : `curl -OJ "${lastUrl}"`;

    return fileList + "\n";
  }

  static callback() {
    const allDownloadLinks = document.querySelectorAll(
      ".download-title .item-button"
    );

    const linksReady = [...allDownloadLinks].every(
      element => element.style.display !== "none"
    );

    this.log.info("linksReady", linksReady);
    if (linksReady) {
      this.enableButton();
      return;
    }

    this.disableButton();
  }

  static getDownloadPreamble() {
    return preamble;
  }
}

function generateDownloadList() {
  let filelist = "";
  document
    .querySelectorAll('a[href^="https://p4.bcbits.com/download/"]')
    .forEach((item, index, list) => {
      const url = item.getAttribute("href");
      // Prevent duplicate URLs
      if (filelist.indexOf(url) === -1) {
        filelist += "curl -OJ " + url + " \\ &\n";
      }
    });
  return filelist;
}

function assignLocation(url){
  window.location.assign(url);
}

function download(filename, text) {
  const url = "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  helper.assignLocation(url);
}

const init = () => {
  const list = helper.generateDownloadList();
  download("files.txt", list);
}

// Factory pattern:
// Allows for in-module unit test stubs.
const helper = {
  generateDownloadList,
  assignLocation,
  download,
  init
}

module.exports = helper

window.onload = init;

export function generateDownloadList() {
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

export function download(filename, text) {
  const url = "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  window.location.assign(url);
}

export const init = () => {
  const list = generateDownloadList();
  download("files.txt", list);
}

window.onload = init;

function generateDownloadList() {
  filelist = "";
  $('a[href^="https://p4.bcbits.com/download/"]').each(function(index, item) {
    url = $(item).attr("href");
    filelist += "curl -OJ " + url + " \\ &\n";
  });
  return filelist;
}

function download(filename, text) {
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

var list = generateDownloadList();
download("files.txt", list);

import LabelView from "./label_view.js";
import DownloadHelper from "./download_helper.js";

window.onload = () => {
  const lv = new LabelView();
  lv.init();

  let checkIsDownloadPage = document.querySelector(".download-item-container");
  if (checkIsDownloadPage) {
    const dh = new DownloadHelper();
    dh.init();
  }
};

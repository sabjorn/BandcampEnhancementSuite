import Logger from "../logger";
import { createButton } from "../components/buttons.js";

export async function initHideUnhide(): Promise<void> {
  const log = new Logger();
  log.info("hideUnhide init");

  const hideButton = createButton({
    className: "follow-unfollow",
    innerText: "hide",
    buttonClicked: () => {
      console.log("hide button clicked");
    }
  });

  const unhideButton = createButton({
    className: "follow-unfollow",
    innerText: "unhide",
    buttonClicked: () => {
      console.log("unhide button clicked");
    }
  });

  const collectionItemsDiv = document.querySelector("div.collection-items");
  if (collectionItemsDiv) {
    collectionItemsDiv.insertBefore(hideButton, collectionItemsDiv.firstChild);
    collectionItemsDiv.insertBefore(unhideButton, collectionItemsDiv.firstChild);
  }
}

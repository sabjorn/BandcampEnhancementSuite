import { addTrackWishlist, removeTrackWishlist } from "../utilities";

export function wishlistCallback(target, fan_id, log) {
  const element = target.parentElement;
  const track_id = element.getAttribute("track_id");
  const band_id = element.getAttribute("band_id");

  if (target.classList.contains("wishlist")) {
    const meta = JSON.parse(
      document.querySelector("#js-crumbs-data").getAttribute("data-crumbs")
    );
    const crumb = encodeURI(meta.collect_item_cb).replaceAll("+", "%2b");

    addTrackWishlist(track_id, band_id, fan_id, crumb)
      .then(response => {
        if (response.status !== 200)
          throw new Error(
            `Could not add to wishlist, response.status ${response.status}`
          );
        return response.json();
      })
      .then(response => {
        if (!response.ok)
          throw new Error(`Could not add to wishlist, response.ok === false`);
      })
      .then(() => {
        log.debug("added track to wishlist");
        target.classList.remove("wishlist");
        target.classList.add("wishlisted");
      })
      .catch(e => log.error(e));
    return;
  }

  const meta = JSON.parse(
    document.querySelector("#js-crumbs-data").getAttribute("data-crumbs")
  );
  const crumb = encodeURI(meta.uncollect_item_cb).replaceAll("+", "%2b");

  removeTrackWishlist(track_id, band_id, fan_id, crumb)
    .then(response => {
      if (response.status !== 200)
        throw new Error(
          `Could not remove from wishlist, response.status ${response.status}`
        );
      return response.json();
    })
    .then(response => {
      if (!response.ok)
        throw new Error(
          `Could not remove from wishlist, response.ok === false`
        );
    })
    .then(() => {
      log.debug("removed track from wishlist");
      target.classList.remove("wishlisted");
      target.classList.add("wishlist");
    })
    .catch(e => log.error(e));
}

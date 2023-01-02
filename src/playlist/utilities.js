import { addTrackWishlist, removeTrackWishlist } from "../utilities";

export function wishlistCallback(target, fan_id, log) {
  const element = target.parentElement;
  const track_id = element.getAttribute("track_id");
  const band_id = element.getAttribute("band_id");

  if (target.classList.contains("wishlist")) {
    addTrackWishlist(track_id, band_id, fan_id).then(() => {
      log.debug("added track to wishlist");
      target.classList.remove("wishlist");
      target.classList.add("wishlisted");
    });
    return;
  }

  removeTrackWishlist(track_id, band_id, fan_id).then(() => {
    log.debug("added removed from wishlist");
    target.classList.remove("wishlisted");
    target.classList.add("wishlist");
  });
}

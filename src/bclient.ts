export function addAlbumToCart(
  item_id: string | number,
  unit_price: string | number,
  item_type: string = "a",
): Promise<Response> {
  return fetch(`/cart/cb`, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest"
    },
    referrer: "https://halfpastvibe.bandcamp.com/album/vielen-dank",
    referrerPolicy: "no-referrer-when-downgrade",
    body: `req=add&item_type=${item_type}&item_id=${item_id}&unit_price=${unit_price}&quantity=1&sync_num=1`,
    method: "POST",
    mode: "cors"
  });
}

export function getTralbumDetails(item_id: string | number, item_type: string = "a"): Promise<Response> {
  const raw: string = JSON.stringify({
    tralbum_type: item_type,
    band_id: 12345,
    tralbum_id: item_id
  });

  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      accept: "application/json",
      host: "bandcamp.com",
      connection: "keep-alive",
      "content-type": "application/json",
      "user-agent": "Bandcamp/218977 CFNetwork/1399 Darwin/22.1.0",
      "accept-language": "en-CA:en-US;q=0.9:en;q=0.8",
      "accept-encoding": "gzip: deflate: br",
      "sec-fetch-mode": "cors"
    },
    body: raw
  };

  return fetch(`/api/mobile/25/tralbum_details`, requestOptions);
}

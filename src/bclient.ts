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

export interface TrackItem {
  item_type: string;
  item_id: number;
  band_id: number;
  purchased: string;
}

export interface CollectionSummary {
  fan_id: number;
  username: string;
  url: string;
  tralbum_lookup: Record<string, TrackItem>;
  follows: {
    following: Record<string, boolean>;
  };
}

export async function getCollectionSummary(): Promise<CollectionSummary> {
  const response = await fetch(`/api/fan/2/collection_summary`,  {
    method: "GET",
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
    mode: "cors"
  });
  
  const data = await response.json();
  return data.collection_summary;
}

export async function hideUnhide(action: "hide" | "unhide", fan_id: string, item_type: "track" | "album", item_id: number, crumb: string | null = null): Promise<boolean> {
  const makeRequest = async (crumbValue: string | null) => {
    const body = JSON.stringify({
      fan_id,
      item_type,
      item_id,
      action,
      crumb: crumbValue,
      collection_index: null,
    });

    const response = await fetch("/api/collectionowner/1/hide_unhide_item", {
      method: "POST",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/json",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest"
      },
      referrer: "https://halfpastvibe.bandcamp.com/album/vielen-dank",
      referrerPolicy: "no-referrer-when-downgrade",
      body: body,
      mode: "cors"
    });

    return response;
  };

  let response = await makeRequest(crumb);
  let data = await response.json();

  if (data.error === 'invalid_crumb' && data.crumb) {
    response = await makeRequest(data.crumb);
    data = await response.json();
  }

  return data.ok === true;
}

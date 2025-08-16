interface AddAlbumToCartBody {
  req: string;
  item_type: string;
  item_id: string | number;
  unit_price: string | number;
  quantity: number;
  sync_num: number;
}

export function addAlbumToCart(
  item_id: string | number,
  unit_price: string | number,
  item_type: string = "a",
  baseUrl: string | null = null
): Promise<Response> {
  const bodyData: AddAlbumToCartBody = {
    req: "add",
    item_type,
    item_id,
    unit_price,
    quantity: 1,
    sync_num: 1
  };

  const body = new URLSearchParams(bodyData as any).toString();

  const url = baseUrl ? `${baseUrl}/cart/cb` : `/cart/cb`;

  return fetch(url, {
    method: "POST",
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
    body: body,
    mode: "cors"
  });
}

interface TralbumDetailsBody {
  tralbum_type: string;
  band_id: number;
  tralbum_id: string | number;
}

export function getTralbumDetails(item_id: string | number, item_type: string = "a", baseUrl: string | null = null): Promise<Response> {
  const bodyData: TralbumDetailsBody = {
    tralbum_type: item_type,
    band_id: 12345,
    tralbum_id: item_id
  };

  const url = baseUrl ? `${baseUrl}/api/mobile/25/tralbum_details` : `/api/mobile/25/tralbum_details`;

  return fetch(url, {
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
    body: JSON.stringify(bodyData)
  });
}

interface TrackItem {
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

export async function getCollectionSummary(baseUrl: string | null = null): Promise<CollectionSummary> {
  const url = baseUrl ? `${baseUrl}/api/fan/2/collection_summary` : `/api/fan/2/collection_summary`;

  const response = await fetch(url, {
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

interface HideUnhideBody {
  fan_id: number;
  item_type: "track" | "album";
  item_id: number;
  action: "hide" | "unhide";
  crumb: string | null;
  collection_index: null;
}

interface HideUnhideResponse {
  ok?: boolean;
  error?: string;
  crumb?: string;
}

export async function hideUnhide(action: "hide" | "unhide", fan_id: number, item_type: "track" | "album", item_id: number, crumb: string | null = null, baseUrl: string | null = null): Promise<boolean> {
  const makeRequest = async (crumbValue: string | null) => {
    const bodyData: HideUnhideBody = {
      fan_id,
      item_type,
      item_id,
      action,
      crumb: crumbValue,
      collection_index: null,
    };

    const url = baseUrl ? `${baseUrl}/api/collectionowner/1/hide_unhide_item` : `/api/collectionowner/1/hide_unhide_item`;

    const response = await fetch(url, {
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
      body: JSON.stringify(bodyData),
      mode: "cors"
    });

    return response;
  };

  let response = await makeRequest(crumb);
  let data: HideUnhideResponse = await response.json();

  if (data.error === 'invalid_crumb' && data.crumb) {
    response = await makeRequest(data.crumb);
    data = await response.json();
  }

  return data.ok === true;
}

interface GetHiddenItemsBody {
  fan_id: number;
  older_than_token: string;
  dupe_gift_ids: any[];
  count: number;
}

interface HiddenItemArt {
  url: string;
  thumb_url: string;
  art_id: number;
}

interface HiddenItemUrlHints {
  subdomain: string;
  custom_domain: string | null;
  custom_domain_verified: boolean | null;
  slug: string;
  item_type: string;
}

export interface HiddenItem {
  fan_id: number;
  item_id: number;
  item_type: string;
  band_id: number;
  added: string;
  updated: string;
  purchased: string;
  sale_item_id: number;
  sale_item_type: string;
  tralbum_id: number;
  tralbum_type: string;
  featured_track: number;
  why: string | null;
  hidden: number;
  index: number | null;
  also_collected_count: number | null;
  url_hints: HiddenItemUrlHints;
  item_title: string;
  item_url: string;
  item_art_id: number;
  item_art_url: string;
  item_art: HiddenItemArt;
  band_name: string;
  band_url: string;
  genre_id: number;
  featured_track_title: string;
  featured_track_number: number | null;
  featured_track_is_custom: boolean;
  featured_track_duration: number;
  featured_track_url: string | null;
  featured_track_encodings_id: number;
  package_details: any | null;
  num_streamable_tracks: number;
  is_purchasable: boolean;
  is_private: boolean;
  is_preorder: boolean;
  is_giftable: boolean;
  is_subscriber_only: boolean;
  is_subscription_item: boolean;
  service_name: string | null;
  service_url_fragment: string | null;
  gift_sender_name: string | null;
  gift_sender_note: string | null;
  gift_id: string | null;
  gift_recipient_name: string | null;
  album_id: number | null;
  album_title: string | null;
  listen_in_app_url: string;
  band_location: string | null;
  band_image_id: number | null;
  release_count: number | null;
  message_count: number | null;
  is_set_price: boolean;
  price: number;
  has_digital_download: boolean | null;
  merch_ids: any[] | null;
  merch_sold_out: boolean | null;
  currency: string;
  label: string | null;
  label_id: number | null;
  require_email: boolean | null;
  item_art_ids: any[] | null;
}

export interface GetHiddenItemsResponse {
  items: HiddenItem[];
  redownload_urls: Record<string, string>;
  item_lookup: Record<string, any>;
  last_token: string;
  similar_gift_ids: Record<string, any>;
  last_token_is_gift: boolean;
}

export async function getHiddenItems(fan_id: number, older_than_token: string, count: number = 20, baseUrl: string | null = null): Promise<GetHiddenItemsResponse> {
  const bodyData: GetHiddenItemsBody = {
    fan_id,
    older_than_token,
    dupe_gift_ids: [],
    count
  };

  const url = baseUrl ? `${baseUrl}/api/fancollection/1/hidden_items` : `/api/fancollection/1/hidden_items`;

  const response = await fetch(url, {
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
    body: JSON.stringify(bodyData),
    mode: "cors"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

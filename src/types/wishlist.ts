export type WishlistAction = 'collect' | 'uncollect';

export type CrumbPath = 'collect_item_cb' | 'uncollect_item_cb';

export const CRUMB_PATHS: Record<WishlistAction, CrumbPath> = {
  collect: 'collect_item_cb',
  uncollect: 'uncollect_item_cb'
};

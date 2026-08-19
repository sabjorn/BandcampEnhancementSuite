import { TrackState } from '../../clients/findmusic';
import { allInDrawer } from './query';

const LIKED_CLASS = 'bes-is-liked';
const PLAYED_CLASS = 'bes-is-played';

function rowFor(trackId: number): HTMLElement | undefined {
  return allInDrawer('.bes-track-row').find(row => row.dataset.trackId === String(trackId));
}

export function applyTrackState(state: TrackState): void {
  const liked = new Set(state.liked.map(String));
  const played = new Set(state.played.map(String));

  allInDrawer('.bes-track-row').forEach(row => {
    const trackId = row.dataset.trackId;

    row.classList.toggle(LIKED_CLASS, Boolean(trackId) && liked.has(trackId as string));
    row.classList.toggle(PLAYED_CLASS, Boolean(trackId) && played.has(trackId as string));
  });
}

export function markRowPlayed(trackId: number): void {
  rowFor(trackId)?.classList.add(PLAYED_CLASS);
}

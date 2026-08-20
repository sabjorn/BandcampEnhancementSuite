import { TrackState } from '../../clients/findmusic';
import { inPlayer, allInPlayer } from './query';

const LIKED_CLASS = 'bes-is-liked';
const PLAYED_CLASS = 'bes-is-played';

export function applyTrackState(state: TrackState): void {
  const liked = new Set(state.liked.map(String));
  const played = new Set(state.played.map(String));

  allInPlayer('.bes-track-row').forEach(row => {
    const { trackId } = row.dataset;
    if (!trackId) return;

    row.classList.toggle(LIKED_CLASS, liked.has(trackId));
    row.classList.toggle(PLAYED_CLASS, played.has(trackId));
  });
}

export function markRowPlayed(trackId: number): void {
  inPlayer(`.bes-track-row[data-track-id="${trackId}"]`)?.classList.add(PLAYED_CLASS);
}

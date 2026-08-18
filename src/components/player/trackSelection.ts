import { TralbumTrack } from '../../bclient';

export function streamUrlOf(track: TralbumTrack | undefined): string | undefined {
  return track?.streaming_url?.['mp3-128'];
}

export function isTrackPlayable(track: TralbumTrack | undefined): boolean {
  return Boolean(streamUrlOf(track));
}

export function findPlayableTrackAfter(tracks: TralbumTrack[] | undefined, startIndex: number): number {
  if (!tracks) return -1;

  for (let i = startIndex + 1; i < tracks.length; i++) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  return -1;
}

export function findPlayableTrackBefore(tracks: TralbumTrack[] | undefined, startIndex: number): number {
  if (!tracks) return -1;

  for (let i = Math.min(startIndex, tracks.length) - 1; i >= 0; i--) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  return -1;
}

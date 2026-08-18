import { describe, it, expect } from 'vitest';
import { findPlayableTrackAfter, findPlayableTrackBefore, isTrackPlayable, streamUrlOf } from '../src/trackSelection';
import type { TralbumTrack } from '../src/bclient';

describe('trackSelection', () => {
  const track = (title: string): TralbumTrack => ({
    track_id: Number(title),
    title,
    price: 1,
    currency: 'USD',
    is_purchasable: true
  });
  const playable = (title: string): TralbumTrack => ({
    ...track(title),
    streaming_url: { 'mp3-128': 'https://example.com/a.mp3' }
  });
  const unplayable = (title: string): TralbumTrack => track(title);

  describe('only the first track is playable', () => {
    const tracks = [playable('1'), unplayable('2'), unplayable('3'), unplayable('4')];

    it('should report no playable track after the first', () => {
      expect(findPlayableTrackAfter(tracks, 0)).toBe(-1);
    });

    it('should not fall back to an earlier track when searching forward', () => {
      expect(findPlayableTrackAfter(tracks, 3)).toBe(-1);
    });
  });

  describe('only the last track is playable', () => {
    const tracks = [unplayable('1'), unplayable('2'), playable('3')];

    it('should report no playable track before the last', () => {
      expect(findPlayableTrackBefore(tracks, 2)).toBe(-1);
    });

    it('should find the last track when searching forward from the start', () => {
      expect(findPlayableTrackAfter(tracks, -1)).toBe(2);
    });
  });

  describe('playable tracks on both sides', () => {
    const tracks = [playable('1'), unplayable('2'), playable('3'), unplayable('4'), playable('5')];

    it('should skip over unplayable tracks going forward', () => {
      expect(findPlayableTrackAfter(tracks, 0)).toBe(2);
      expect(findPlayableTrackAfter(tracks, 2)).toBe(4);
    });

    it('should skip over unplayable tracks going backward', () => {
      expect(findPlayableTrackBefore(tracks, 4)).toBe(2);
      expect(findPlayableTrackBefore(tracks, 2)).toBe(0);
    });

    it('should never search backward when asked for a later track', () => {
      expect(findPlayableTrackAfter(tracks, 4)).toBe(-1);
    });

    it('should never search forward when asked for an earlier track', () => {
      expect(findPlayableTrackBefore(tracks, 0)).toBe(-1);
    });

    it('should find the last playable track when starting past the end', () => {
      expect(findPlayableTrackBefore(tracks, tracks.length)).toBe(4);
    });
  });

  describe('no playable tracks at all', () => {
    const tracks = [unplayable('1'), unplayable('2')];

    it('should report none in either direction', () => {
      expect(findPlayableTrackAfter(tracks, -1)).toBe(-1);
      expect(findPlayableTrackBefore(tracks, tracks.length)).toBe(-1);
    });
  });

  it('should handle missing track data', () => {
    expect(findPlayableTrackAfter(undefined, 0)).toBe(-1);
    expect(findPlayableTrackBefore(undefined, 0)).toBe(-1);
  });
});

describe('reading the stream for a track', () => {
  const track = (streaming_url?: { 'mp3-128': string }): TralbumTrack => ({
    track_id: 1,
    title: 'Track',
    price: 1,
    currency: 'USD',
    is_purchasable: true,
    ...(streaming_url ? { streaming_url } : {})
  });

  it('should read the mp3 stream when present', () => {
    expect(streamUrlOf(track({ 'mp3-128': 'https://example.com/a.mp3' }))).toBe('https://example.com/a.mp3');
  });

  it('should report no stream for a track that cannot be played', () => {
    expect(streamUrlOf(track())).toBeUndefined();
  });

  it('should treat a track with a stream as playable', () => {
    expect(isTrackPlayable(track({ 'mp3-128': 'https://example.com/a.mp3' }))).toBe(true);
  });

  it('should treat a track without a stream as unplayable', () => {
    expect(isTrackPlayable(track())).toBe(false);
  });

  it('should treat a missing track as unplayable', () => {
    expect(isTrackPlayable(undefined)).toBe(false);
  });
});

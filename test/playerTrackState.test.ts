import { describe, it, expect, afterEach } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { applyTrackState, markRowPlayed } from '../src/components/player/trackState';
import { setPlayerRoot } from '../src/components/player/query';

const buildTracklist = (trackIds: number[]) =>
  createDomNodes(`
    <div class="bes-player-drawer">
      <table>
        ${trackIds.map(id => `<tr class="bes-track-row" data-track-id="${id}"></tr>`).join('')}
      </table>
    </div>
  `);

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.bes-track-row'));

describe('Player track state', () => {
  afterEach(() => {
    setPlayerRoot(document);
    cleanupTestNodes();
  });

  it('should mark the liked and played rows by track id', () => {
    buildTracklist([1001, 1002, 1003]);

    applyTrackState({ liked: [1002], played: [1001, 1002] });

    expect(rows().map(row => row.classList.contains('bes-is-liked'))).toEqual([false, true, false]);
    expect(rows().map(row => row.classList.contains('bes-is-played'))).toEqual([true, true, false]);
  });

  it('should clear markers for rows no longer in the state', () => {
    buildTracklist([1001, 1002]);
    applyTrackState({ liked: [1001], played: [1001] });

    applyTrackState({ liked: [], played: [1002] });

    expect(rows()[0].classList.contains('bes-is-liked')).toBe(false);
    expect(rows()[0].classList.contains('bes-is-played')).toBe(false);
    expect(rows()[1].classList.contains('bes-is-played')).toBe(true);
  });

  it('should ignore track ids that are not in the tracklist', () => {
    buildTracklist([1001]);

    expect(() => applyTrackState({ liked: [9999], played: [9999] })).not.toThrow();
    expect(rows()[0].classList.contains('bes-is-played')).toBe(false);
  });

  it('should mark a single row played', () => {
    buildTracklist([1001, 1002]);

    markRowPlayed(1002);

    expect(rows().map(row => row.classList.contains('bes-is-played'))).toEqual([false, true]);
  });

  it('should ignore a played track that has no row', () => {
    buildTracklist([1001]);

    expect(() => markRowPlayed(9999)).not.toThrow();
  });

  it('should only touch rows inside the player root', () => {
    createDomNodes(`
      <table><tr class="bes-track-row" data-track-id="1001"></tr></table>
      <div class="bes-player-host">
        <table><tr class="bes-track-row" data-track-id="1002"></tr></table>
      </div>
    `);
    setPlayerRoot(document.querySelector('.bes-player-host') as HTMLElement);

    applyTrackState({ liked: [1001, 1002], played: [1001, 1002] });

    expect(rows()[0].classList.contains('bes-is-liked')).toBe(false);
    expect(rows()[1].classList.contains('bes-is-liked')).toBe(true);
  });
});

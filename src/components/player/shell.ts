import { element } from '../dom';
import { inPlayer } from './query';

export function buildPlayerShell(): HTMLElement {
  return element('div', {
    className: 'bes-player',
    children: [
      element('div', {
        className: 'bes-player-top',
        children: [
          element('div', {
            className: 'bes-player-left',
            children: [
              element('img', { className: 'bes-player-art', attributes: { alt: 'Album artwork' } }),
              element('div', { className: 'bes-player-transport' })
            ]
          }),
          element('div', { className: 'bes-player-container' }),
          element('div', { className: 'bes-player-right' })
        ]
      }),
      element('div', { className: 'bes-player-tracklist' })
    ]
  });
}

export function setAlbumArt(albumArtUrl: string): void {
  if (!albumArtUrl) return;

  const art = inPlayer<HTMLImageElement>('.bes-player-art');
  if (art) art.src = albumArtUrl;
}

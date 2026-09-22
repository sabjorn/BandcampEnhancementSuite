import { element } from '../dom';
import { labelIcon, artistIcon } from './icons';

const CONTAINER_CLASS = 'bes-findmusic-links';

export type FindMusicLinkKind = 'label' | 'artist';

export interface FindMusicLink {
  kind: FindMusicLinkKind;
  bandId: number;
  name?: string;
}

function linkElement({ kind, bandId, name }: FindMusicLink): HTMLAnchorElement {
  const description = `Open ${name ?? `this ${kind}`} on FindMusic.club`;

  return element('a', {
    className: `bes-findmusic-link bes-findmusic-link-${kind}`,
    html: kind === 'label' ? labelIcon(16) : artistIcon(16),
    attributes: {
      href: `${process.env.FINDMUSIC_BASE_URL}/artist/${bandId}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: description,
      'aria-label': description
    }
  });
}

export function setFindMusicLinks(links: FindMusicLink[]): void {
  document.querySelectorAll(`.${CONTAINER_CLASS}`).forEach(container => container.remove());
  if (links.length === 0) return;

  const container = element('div', { className: CONTAINER_CLASS, children: links.map(linkElement) });

  const buyRow = document.querySelector<HTMLElement>('.bes-player-drawer .bes-album-buy');
  if (buyRow) {
    buyRow.prepend(container);
    return;
  }

  const tracklist = document.querySelector<HTMLElement>('.bes-player-drawer-tracklist');
  if (!tracklist) return;

  container.classList.add('bes-findmusic-links-standalone');
  tracklist.prepend(container);
}

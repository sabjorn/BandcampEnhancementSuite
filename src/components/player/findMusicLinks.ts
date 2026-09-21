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
  const headerActions = document.querySelector<HTMLElement>('.bes-player-drawer-header-actions');
  if (!headerActions) return;

  headerActions.querySelector(`.${CONTAINER_CLASS}`)?.remove();
  if (links.length === 0) return;

  headerActions.prepend(element('div', { className: CONTAINER_CLASS, children: links.map(linkElement) }));
}

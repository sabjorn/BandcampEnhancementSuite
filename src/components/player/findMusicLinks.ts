import { element } from '../dom';
import { labelIcon, artistIcon } from './icons';

const CONTAINER_CLASS = 'bes-findmusic-links';
const TOOLTIP_CLASS = 'bes-findmusic-tooltip';

export type FindMusicLinkKind = 'label' | 'artist';

export interface FindMusicLink {
  kind: FindMusicLinkKind;
  bandId: number;
  name?: string;
}

function attachTooltip(link: HTMLAnchorElement, text: string): void {
  const tooltip = element('div', { className: TOOLTIP_CLASS });
  tooltip.textContent = text;
  document.body.appendChild(tooltip);

  link.addEventListener('mouseenter', () => {
    const { left, top, width } = link.getBoundingClientRect();

    tooltip.style.left = `${left + width / 2}px`;
    tooltip.style.top = `${top - tooltip.offsetHeight - 8}px`;
    tooltip.classList.add('visible');
  });

  link.addEventListener('mouseleave', () => {
    tooltip.classList.remove('visible');
  });
}

function linkElement({ kind, bandId, name }: FindMusicLink): HTMLAnchorElement {
  const description = `Open ${name ?? `this ${kind}`} on FindMusic.club`;

  const link = element('a', {
    className: `bes-findmusic-link bes-findmusic-link-${kind}`,
    html: kind === 'label' ? labelIcon(16) : artistIcon(16),
    attributes: {
      href: `${process.env.FINDMUSIC_BASE_URL}/artist/${bandId}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': description
    }
  });

  attachTooltip(link, description);

  return link;
}

export function setFindMusicLinks(links: FindMusicLink[]): void {
  document.querySelectorAll(`.${CONTAINER_CLASS}, .${TOOLTIP_CLASS}`).forEach(stale => stale.remove());
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

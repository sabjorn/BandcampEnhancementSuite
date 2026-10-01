import { element } from '../dom';

export interface AlbumNavState {
  hasPrevious: boolean;
  hasNext: boolean;
  loading: boolean;
}

const chevron = (points: string): string =>
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;

export function buildAlbumNav(onPrevious: () => void, onNext: () => void): HTMLElement {
  const previous = element('button', {
    className: 'bes-album-nav-prev',
    html: `${chevron('15 18 9 12 15 6')}<span>Previous album</span>`,
    attributes: { type: 'button', title: 'Previous album in feed' }
  });
  const next = element('button', {
    className: 'bes-album-nav-next',
    html: `<span>Next album</span>${chevron('9 18 15 12 9 6')}`,
    attributes: { type: 'button', title: 'Next album in feed' }
  });

  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);

  return element('div', { className: 'bes-album-nav', children: [previous, next] });
}

export function updateAlbumNav(nav: HTMLElement | null, { hasPrevious, hasNext, loading }: AlbumNavState): void {
  if (!nav) return;

  const previous = nav.querySelector<HTMLButtonElement>('.bes-album-nav-prev');
  const next = nav.querySelector<HTMLButtonElement>('.bes-album-nav-next');

  if (previous) previous.disabled = loading || !hasPrevious;
  if (next) next.disabled = loading || !hasNext;
  nav.classList.toggle('bes-loading', loading);
}

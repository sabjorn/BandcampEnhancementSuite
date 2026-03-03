import plusSvg from '../../svg/plus.svg';
import findmusicSvg from '../../svg/findmusic.svg';

export const createSvgIcon = (svgString: string, classes: string = ''): Element => {
  const svg = new DOMParser().parseFromString(svgString, 'application/xml').documentElement;
  `icon ${classes}`.split(' ').forEach(cls => svg.classList.add(cls));
  return svg;
};

export const createPlusSvgIcon = (): Element => createSvgIcon(plusSvg, 'icon-plus');

export const createFindMusicSvgIcon = (): Element => createSvgIcon(findmusicSvg, 'icon-findmusic');

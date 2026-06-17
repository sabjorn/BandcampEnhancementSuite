import plusSvg from '../../svg/plus.svg';
import checkSvg from '../../svg/check.svg';
import xSvg from '../../svg/x.svg';

export const createSvgIcon = (svgString: string, classes: string = ''): Element => {
  const svg = new DOMParser().parseFromString(svgString, 'application/xml').documentElement;
  `icon ${classes}`.split(' ').forEach(cls => svg.classList.add(cls));
  return svg;
};

export const createPlusSvgIcon = (): Element => createSvgIcon(plusSvg, 'icon-plus');

export const createCheckSvgIcon = (): Element => createSvgIcon(checkSvg, 'icon-check');

export const createXSvgIcon = (): Element => createSvgIcon(xSvg, 'icon-x');

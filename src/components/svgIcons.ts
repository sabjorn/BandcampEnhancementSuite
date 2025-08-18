import plusSvg from '../../svg/plus.svg';

export const createSvgIcon = (svgString: string, classes: string = ''): Element => {
  const svg = new DOMParser().parseFromString(svgString, 'application/xml').documentElement;
  `icon ${classes}`.split(' ').forEach(cls => svg.classList.add(cls));
  return svg;
};

export const createPlusSvgIcon = (): Element => createSvgIcon(plusSvg, 'icon-plus');

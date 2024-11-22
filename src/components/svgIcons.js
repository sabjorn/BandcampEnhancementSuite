import plusSvg from "../../svg/plus.svg";

export const createSvgIcon = (svgString, classes = "") => {
  const svg = new DOMParser().parseFromString(svgString, "application/xml")
    .documentElement;
  `icon ${classes}`.split(" ").forEach(cls => svg.classList.add(cls));
  return svg;
};

export const createPlusSvgIcon = () => createSvgIcon(plusSvg, "icon-plus");

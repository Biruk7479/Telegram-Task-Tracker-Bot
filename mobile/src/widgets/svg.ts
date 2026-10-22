// SVG strings for the widget SvgWidget: progress rings and calendar cells
// split diagonally between the two members. Both carry a faint white inner
// stroke so they read as glass tiles on the translucent widget card.

const HIGHLIGHT = 'stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1"';

export const ringSvg = (fraction: number, color: string, track: string, size = 40, stroke = 5) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
 stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
<circle cx="${size / 2}" cy="${size / 2}" r="${r - stroke / 2 - 0.5}" fill="none" ${HIGHLIGHT}/>
</svg>`;
};

// Top-left triangle = first member, bottom-right = second. `ring` outlines today.
export const splitCellSvg = (a: string, b: string, size: number, ring?: string) => {
  const s = size;
  const outline = ring
    ? `<rect x="1" y="1" width="${s - 2}" height="${s - 2}" rx="${s * 0.22}" fill="none" stroke="${ring}" stroke-width="2"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<defs><clipPath id="r"><rect width="${s}" height="${s}" rx="${s * 0.22}"/></clipPath></defs>
<g clip-path="url(#r)">
<polygon points="0,0 ${s},0 0,${s}" fill="${a}"/>
<polygon points="${s},0 ${s},${s} 0,${s}" fill="${b}"/>
</g>
<rect x="0.5" y="0.5" width="${s - 1}" height="${s - 1}" rx="${s * 0.22 - 0.5}" fill="none" ${HIGHLIGHT}/>${outline}
</svg>`;
};

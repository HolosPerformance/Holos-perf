// Style commun des graphiques du dashboard : graduations et légendes lisibles
// (en noir, semi-gras, taille augmentée) pour pouvoir être reprises telles quelles dans
// un diaporama. Sur téléphone, tailles réduites et moins de dates sur l'axe X
// pour laisser la place au graphique.
const AXIS_TEXT_COLOR = '#0f172a';
const AXIS_LINE_COLOR = '#cbd5e1';

export function getChartStyle(isMobile) {
  const fontSize = isMobile ? 11 : 13;
  return {
    fontSize,
    axisTick: { fill: AXIS_TEXT_COLOR, fontSize, fontWeight: 600 },
    axisLineColor: AXIS_LINE_COLOR,
    // Hauteur réservée aux dates inclinées à -45°
    xAxisHeight: isMobile ? 56 : 84,
    legendStyle: { fontSize, fontWeight: 600, lineHeight: `${fontSize + 8}px`, color: AXIS_TEXT_COLOR },
  };
}

// Sur téléphone, environ 7 dates affichées sur l'axe X quelle que soit la période
export function xAxisInterval(isMobile, pointCount) {
  if (!isMobile) return 'preserveEnd';
  return Math.max(0, Math.ceil(pointCount / 7) - 1);
}

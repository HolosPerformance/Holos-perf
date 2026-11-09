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

// Axe des valeurs : de 0 à 100 au moins, étendu jusqu'à la plus grande valeur
// affichée ou au maximum de l'échelle des questions (`scaleMax`, ex. 200),
// avec des graduations rondes (0, 50, 100, 150, 200…). Rien n'est coupé.
export function valueAxis(values, scaleMax) {
  const finite = values.map(Number).filter(Number.isFinite);
  const top = Math.max(100, Number(scaleMax) || 0, ...finite);
  const low = Math.min(0, ...finite);
  const raw = (top - low) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw);
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(top / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { domain: [min, max], ticks };
}

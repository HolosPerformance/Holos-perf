import React from 'react';
import { Text } from 'recharts';

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

// Réglage d'échelle commun aux graphiques (voir AxisScaleToggle) :
// - yTicks : 'auto' ou nombre de graduations souhaité sur l'axe des valeurs
// - xMode : 'auto' | 'all' (toutes les dates) | 'every' (un jour sur xEvery)
//           | 'weekdays' (seulement les jours de la semaine de xWeekdays,
//           0 = dimanche … 6 = samedi, comme getDay)
export const DEFAULT_AXIS_SETTINGS = { yTicks: 'auto', xMode: 'auto', xEvery: 2, xWeekdays: [1] };

export function isDefaultAxisSettings(settings) {
  return !settings || (settings.yTicks === 'auto' && settings.xMode === 'auto');
}

// Sur téléphone, environ 7 dates affichées sur l'axe X quelle que soit la période
export function xAxisInterval(isMobile, pointCount) {
  if (!isMobile) return 'preserveEnd';
  return Math.max(0, Math.ceil(pointCount / 7) - 1);
}

// Props `interval` et `tick` de l'axe des dates selon le réglage d'échelle.
// Seules les dates écrites sous l'axe sont filtrées : tous les points restent tracés.
// `chartData` doit porter `dayOfWeek` sur chaque point.
export function xAxisProps(isMobile, chartData, tickStyle, settings) {
  const mode = settings?.xMode || 'auto';
  if (mode === 'all') return { interval: 0, tick: tickStyle };
  if (mode === 'every') {
    const every = Math.max(1, Number(settings.xEvery) || 1);
    return { interval: every - 1, tick: tickStyle };
  }
  if (mode === 'weekdays') {
    const days = new Set(settings.xWeekdays || []);
    return {
      interval: 0,
      tick: (props) => {
        const { payload, index } = props;
        if (!days.has(chartData[index]?.dayOfWeek)) return null;
        return <Text {...props} {...tickStyle}>{payload?.value}</Text>;
      },
    };
  }
  return { interval: xAxisInterval(isMobile, chartData.length), tick: tickStyle };
}

// Nombres de graduations proposés pour l'axe des valeurs. Seuls ceux qui
// tombent juste (pas rond) sur l'échelle du graphique sont réellement proposés.
export const Y_TICK_CHOICES = [3, 4, 5, 6, 7, 8, 10, 11];

// Graduations rondes (pas de 1, 2, 2,5 ou 5 × 10ⁿ) couvrant [low, top]
// en visant `intervals` intervalles
function niceAxis(low, top, intervals) {
  const raw = (top - low) / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw - 1e-9);
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(top / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { domain: [min, max], ticks };
}

// Plage à couvrir : de 0 à 100 au moins, étendue jusqu'à la plus grande valeur
// affichée ou au maximum de l'échelle des questions (`scaleMax`, ex. 200)
function valueRange(values, scaleMax) {
  const finite = values.map(Number).filter(Number.isFinite);
  return {
    low: Math.min(0, ...finite),
    top: Math.max(100, Number(scaleMax) || 0, ...finite),
  };
}

// Choix de graduations qui tombent juste pour cette échelle : [{ count, axis }]
export function yTickOptions(values, scaleMax) {
  const { low, top } = valueRange(values, scaleMax);
  return Y_TICK_CHOICES
    .map(count => ({ count, axis: niceAxis(low, top, count - 1) }))
    .filter(o => o.axis.ticks.length === o.count);
}

// Choix possible le plus proche du nombre demandé (à égalité, le plus grand),
// ou null si aucun ne tombe juste
export function closestTickOption(options, tickCount) {
  let best = null;
  options.forEach(o => {
    const d = Math.abs(o.count - tickCount);
    const bestD = best ? Math.abs(best.count - tickCount) : Infinity;
    if (d < bestD || (d === bestD && o.count > best.count)) best = o;
  });
  return best;
}

// Axe des valeurs, avec des graduations rondes (0, 50, 100, 150, 200…).
// Rien n'est coupé.
// `tickCount` (optionnel) : nombre de graduations voulu, ex. 5 → 0, 25, 50, 75, 100.
// S'il ne tombe pas juste sur cette échelle, le choix possible le plus proche est pris.
// En automatique, AUTO_TICK_COUNT graduations sont visées (0, 25, 50, 75, 100
// sur une échelle de 100).
export const AUTO_TICK_COUNT = 5;

export function valueAxis(values, scaleMax, tickCount) {
  const { low, top } = valueRange(values, scaleMax);
  const wanted = Number(tickCount) >= 2 ? Number(tickCount) : AUTO_TICK_COUNT;
  const option = closestTickOption(yTickOptions(values, scaleMax), wanted);
  return option ? option.axis : niceAxis(low, top, wanted - 1);
}

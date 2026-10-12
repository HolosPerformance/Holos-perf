// Statistiques avancées (moyenne, médiane, quartiles, moyennes mobiles) partagées
// entre le graphique d'évolution, les histogrammes et les boxplots du dashboard coach.
// Toujours calculées à partir des valeurs déjà filtrées (période + type de séance)
// passées en argument — jamais sur l'historique complet.

// kind 'reference' : ligne horizontale (valeur unique sur la période).
// kind 'ema' : courbe de moyenne mobile exponentielle sur `period` saisies.
export const ADVANCED_STAT_DEFS = [
  { key: 'mean', label: 'Moyenne', color: '#64748b', dash: '6 3', kind: 'reference' },
  { key: 'median', label: 'Médiane', color: '#7c3aed', dash: '2 2', kind: 'reference' },
  { key: 'q1', label: 'Q1', color: '#0ea5e9', dash: '4 4', kind: 'reference' },
  { key: 'q3', label: 'Q3', color: '#f97316', dash: '1 3', kind: 'reference' },
  { key: 'ema7', label: 'MME 7j', color: '#f59e0b', dash: undefined, kind: 'ema', period: 7 },
  { key: 'ema21', label: 'MME 21j', color: '#3b82f6', dash: '5 5', kind: 'ema', period: 21 },
  { key: 'trend', label: 'Droite de tendance', color: '#0f172a', dash: undefined, kind: 'trend' },
];

export const REFERENCE_STAT_DEFS = ADVANCED_STAT_DEFS.filter(d => d.kind === 'reference');
export const EMA_STAT_DEFS = ADVANCED_STAT_DEFS.filter(d => d.kind === 'ema');
export const TREND_STAT_DEF = ADVANCED_STAT_DEFS.find(d => d.kind === 'trend');

export const EMPTY_ADVANCED_STATS = { mean: false, median: false, q1: false, q3: false, ema7: false, ema21: false, trend: false };

// Droite de tendance f(x) = a·x + b par la méthode des moindres carrés, où x est
// le nombre de jours écoulés depuis `startDate`. Seules les saisies comprises
// dans la période [startDate, endDate] sont prises en compte ; les jours sans
// saisie sont ignorés (et non comptés comme 0).
// `points` : [{ date: 'yyyy-MM-dd', value: number }]
// Retourne { slope, intercept, valueAt(dateStr) } ou null si moins de 2 jours distincts.
export function computeLinearTrend(points, startDate, endDate) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const toDay = (dateStr) => Math.round(Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`) / DAY_MS);
  const startDay = toDay(startDate);
  const endDay = toDay(endDate);

  const xy = (points || [])
    .filter(p => p.value != null && !Number.isNaN(p.value) && p.date)
    .map(p => ({ x: toDay(p.date) - startDay, y: p.value }))
    .filter(p => p.x >= 0 && p.x <= endDay - startDay);

  if (new Set(xy.map(p => p.x)).size < 2) return null;

  const n = xy.length;
  const meanX = xy.reduce((acc, p) => acc + p.x, 0) / n;
  const meanY = xy.reduce((acc, p) => acc + p.y, 0) / n;
  const sxy = xy.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
  const sxx = xy.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  return {
    slope,
    intercept,
    valueAt: (dateStr) => Math.round((slope * (toDay(dateStr) - startDay) + intercept) * 10) / 10,
  };
}

// Pente formatée pour la légende, ex. « +0,8/j »
export function formatSlope(slope) {
  const rounded = Math.round(slope * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${String(rounded).replace('.', ',')}/j`;
}

// Moyenne mobile exponentielle ; les valeurs nulles restent nulles et ne
// modifient pas la moyenne en cours.
export function calculateEMA(values, period) {
  const multiplier = 2 / (period + 1);
  let ema = null;

  return values.map((value) => {
    if (value == null) return null;
    ema = ema === null ? value : (value * multiplier) + (ema * (1 - multiplier));
    return Math.round(ema * 10) / 10;
  });
}

export function computeMetricStats(values) {
  const cleaned = (values || []).filter(v => v != null && !Number.isNaN(v));
  if (cleaned.length === 0) return null;

  const sorted = [...cleaned].sort((a, b) => a - b);
  const sum = cleaned.reduce((acc, v) => acc + v, 0);
  const mean = sum / cleaned.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  const percentile = (p) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
  };

  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    q1: percentile(25),
    q3: percentile(75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: cleaned.length,
  };
}

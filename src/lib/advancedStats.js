// Statistiques avancées (moyenne, médiane, quartiles) partagées entre le
// graphique d'évolution, les histogrammes et les boxplots du dashboard coach.
// Toujours calculées à partir des valeurs déjà filtrées (période + type de séance)
// passées en argument — jamais sur l'historique complet.

export const ADVANCED_STAT_DEFS = [
  { key: 'mean', label: 'Moyenne', color: '#64748b', dash: '6 3' },
  { key: 'median', label: 'Médiane', color: '#7c3aed', dash: '2 2' },
  { key: 'q1', label: 'Q1', color: '#0ea5e9', dash: '4 4' },
  { key: 'q3', label: 'Q3', color: '#f97316', dash: '1 3' },
];

export const EMPTY_ADVANCED_STATS = { mean: false, median: false, q1: false, q3: false };

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

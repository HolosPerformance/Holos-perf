// ─── Suivi des marqueurs des questionnaires (module médical) ──────────────────
//
// Pour chaque athlète et chaque marqueur (question chiffrée), on compare son
// niveau récent à sa propre référence :
//   * référence      : moyenne mobile exponentielle (MME) longue sur les
//                      `baselineDays` jours qui précèdent la période observée ;
//   * écart habituel : dispersion robuste de ces mêmes jours (écart absolu
//                      médian × 1,4826), peu sensible à une réponse aberrante ;
//   * niveau actuel  : MME courte, partant de la référence, sur la période
//                      observée. Score = (MME courte − référence) / écart
//                      habituel → 5 niveaux (forte baisse … forte hausse) ;
//   * dérive         : CUSUM (somme cumulée des écarts) sur la période
//                      observée. Plusieurs jours un peu au-dessus ou en dessous
//                      de la référence finissent par dépasser un seuil, même
//                      quand chaque valeur prise seule paraît normale.
// Les hausses et les baisses sont signalées de la même façon : c'est le
// changement qui alerte, pas son sens. Aide à la décision, pas un diagnostic.

import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { questionnaireDay } from './questionnaireDay';
import { painZonesOf, painScaleOf } from './painZones';

// Réglages (en jours, en saisies, ou en nombre d'écarts habituels)
export const TREND_SETTINGS = {
  shortSpan: 7,          // MME courte (≈ 7 jours)
  longSpan: 28,          // MME longue de référence (≈ 28 jours)
  baselineDays: 28,      // jours de référence avant la période observée
  monitorDays: 14,       // période observée par le tableau des marqueurs
  recentDays: 7,         // fenêtre « saisies récentes »
  levelThreshold: 1,     // hausse / baisse au-delà de 1 écart habituel
  strongThreshold: 2,    // forte hausse / forte baisse au-delà de 2
  cusumK: 0.5,           // écart toléré chaque jour avant de cumuler
  cusumH: 4,             // seuil d'alerte de la dérive
  cusumClip: 2.5,        // écart maximal compté pour une journée (une valeur isolée ne suffit pas)
  minBaseline: 8,        // saisies minimum sur la référence (sinon « en apprentissage »)
  minRecent: 3,          // saisies minimum sur les 7 derniers jours
};

export const LEVELS = {
  '-2': { label: 'Forte baisse', arrow: '⇊' },
  '-1': { label: 'Baisse', arrow: '↓' },
  '0': { label: 'Stable', arrow: '=' },
  '1': { label: 'Hausse', arrow: '↑' },
  '2': { label: 'Forte hausse', arrow: '⇈' },
};

// Champs chiffrés de l'ancien questionnaire de séance (training_logs)
const TRAINING_LOG_MARKERS = [
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'intensite', label: 'Intensité' },
  { id: 'sommeil', label: 'Sommeil' },
  { id: 'plaisir', label: 'Plaisir' },
  { id: 'harmonie_proches', label: 'Harmonie avec les proches' },
  { id: 'maitrise_technique', label: 'Maîtrise technique' },
  { id: 'maitrise_tactique', label: 'Maîtrise tactique' },
  { id: 'epanouissement', label: 'Épanouissement' },
];

// Même regroupement que le dashboard coach : questions de même libellé = même marqueur
const markerKeyOf = (label) => (label || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim();

export const shiftDay = (day, n) => format(addDays(parseISO(day), n), 'yyyy-MM-dd');
export const daysBetweenDays = (from, to) => differenceInCalendarDays(parseISO(to), parseISO(from));

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function robustSd(values) {
  const m = median(values);
  const mad = median(values.map(v => Math.abs(v - m))) * 1.4826;
  if (mad > 0) return mad;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

/**
 * Marqueurs et douleurs à partir des réponses aux questionnaires et des
 * séances (training_logs).
 * Retourne {
 *   markers: [{ key, label, min, max }],
 *   series:  Map email → Map markerKey → Map day → valeur (médiane du jour),
 *   pains:   [{ email, day, zones: [...painZonesOf] }],
 * }
 */
export function extractMarkerData({ responses = [], trainingLogs = [], templates = [] }) {
  const templatesById = new Map(templates.map(t => [t.id, t]));
  const markers = new Map();
  const raw = new Map(); // email → key → day → [valeurs]
  const pains = [];

  const add = (email, key, day, value) => {
    if (!raw.has(email)) raw.set(email, new Map());
    const byKey = raw.get(email);
    if (!byKey.has(key)) byKey.set(key, new Map());
    const byDay = byKey.get(key);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(value);
  };
  const register = (key, label, scale) => {
    if (!markers.has(key)) markers.set(key, { key, label, min: scale?.min ?? null, max: scale?.max ?? null });
  };

  for (const response of responses) {
    const template = templatesById.get(response.template_id);
    if (!template || !response.submitted_date || !response.athlete_email) continue;
    const day = questionnaireDay(new Date(response.submitted_date));
    for (const q of template.questions || []) {
      const value = response.responses?.[q.id];
      if (value === undefined || value === null || value === '') continue;
      if (q.type === 'scale' || q.type === 'number') {
        const num = Number(value);
        const label = q.label || q.athleteLabel;
        const key = markerKeyOf(label);
        if (!key || !Number.isFinite(num)) continue;
        register(key, label, q.type === 'scale' ? { min: q.scaleOptions?.min ?? 0, max: q.scaleOptions?.max ?? 100 } : null);
        add(response.athlete_email, key, day, num);
      } else if (q.type === 'body_pain') {
        const zones = painZonesOf(value, painScaleOf(q));
        if (zones.length) pains.push({ email: response.athlete_email, day, zones });
      }
    }
  }

  for (const log of trainingLogs) {
    if (!log.training_date || !log.athlete_email) continue;
    for (const field of TRAINING_LOG_MARKERS) {
      const num = Number(log[field.id]);
      if (log[field.id] == null || !Number.isFinite(num)) continue;
      const key = markerKeyOf(field.label);
      register(key, field.label, null);
      add(log.athlete_email, key, log.training_date, num);
    }
    const zones = painZonesOf(log.douleurs_zones);
    if (zones.length) pains.push({ email: log.athlete_email, day: log.training_date, zones });
  }

  const series = new Map();
  raw.forEach((byKey, email) => {
    const out = new Map();
    byKey.forEach((byDay, key) => {
      out.set(key, new Map([...byDay].map(([day, vals]) => [day, median(vals)])));
    });
    series.set(email, out);
  });

  const sortedMarkers = [...markers.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  return { markers: sortedMarkers, series, pains };
}

const levelOf = (z, s) => {
  const a = Math.abs(z);
  const sign = Math.sign(z);
  if (a >= s.strongThreshold) return 2 * sign;
  if (a >= s.levelThreshold) return sign;
  return 0;
};

/**
 * Analyse d'un marqueur sur la période [monitorStart, monitorEnd], par rapport
 * aux `baselineDays` jours qui la précèdent.
 * `values` : Map day → valeur ; `marker` : { min, max } (pour l'écart minimal).
 * Retourne {
 *   status: 'ok' | 'sparse' (peu de saisies récentes) | 'learning' (référence insuffisante),
 *   reference, sd, short, z, level (-2…2), drift: { dir: ±1, since, days } | null,
 *   points: [{ day, value, ema, drift }] (un point par jour de la période),
 *   baselineCount, recentCount,
 * }
 */
export function analyzeSeries(values, monitorStart, monitorEnd, marker = {}, settings = TREND_SETTINGS) {
  const s = settings;
  const baselineStart = shiftDay(monitorStart, -s.baselineDays);
  const baseline = [...values.entries()]
    .filter(([day]) => day >= baselineStart && day < monitorStart)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, v]) => v);
  const nbDays = daysBetweenDays(monitorStart, monitorEnd) + 1;
  const recentStart = shiftDay(monitorEnd, -(s.recentDays - 1));
  let recentCount = 0;
  for (const day of values.keys()) if (day >= recentStart && day <= monitorEnd) recentCount++;

  if (baseline.length < s.minBaseline) {
    const points = Array.from({ length: nbDays }, (_, i) => {
      const day = shiftDay(monitorStart, i);
      return { day, value: values.get(day) ?? null, ema: null, drift: 0 };
    });
    return { status: 'learning', baselineCount: baseline.length, recentCount, points, drift: null, level: 0 };
  }

  // Référence : MME longue sur la période de référence, amorcée sur sa médiane
  const alphaLong = 2 / (s.longSpan + 1);
  let reference = median(baseline);
  for (const v of baseline) reference += alphaLong * (v - reference);
  const scaleRange = marker.min != null && marker.max != null ? marker.max - marker.min : null;
  const minSd = scaleRange ? 0.05 * scaleRange : Math.max(0.05 * Math.abs(reference), 0.1);
  const sd = Math.max(robustSd(baseline), minSd);

  // Période observée : MME courte partant de la référence + CUSUM haut et bas
  const alphaShort = 2 / (s.shortSpan + 1);
  let ema = reference;
  let hi = 0, lo = 0, hiSince = null, loSince = null;
  const points = [];
  for (let i = 0; i < nbDays; i++) {
    const day = shiftDay(monitorStart, i);
    const value = values.get(day) ?? null;
    if (value !== null) {
      ema += alphaShort * (value - ema);
      const z = Math.max(-s.cusumClip, Math.min(s.cusumClip, (value - reference) / sd));
      const nextHi = Math.max(0, hi + z - s.cusumK);
      const nextLo = Math.max(0, lo - z - s.cusumK);
      if (hi === 0 && nextHi > 0) hiSince = day;
      if (lo === 0 && nextLo > 0) loSince = day;
      hi = nextHi; lo = nextLo;
      if (hi === 0) hiSince = null;
      if (lo === 0) loSince = null;
    }
    const drift = hi > s.cusumH && hi >= lo ? 1 : lo > s.cusumH ? -1 : 0;
    points.push({ day, value, ema: Math.round(ema * 100) / 100, drift });
  }

  const last = points[points.length - 1];
  const z = (ema - reference) / sd;
  const since = last.drift === 1 ? hiSince : last.drift === -1 ? loSince : null;
  return {
    status: recentCount < s.minRecent ? 'sparse' : 'ok',
    reference, sd, short: ema, z, level: levelOf(z, s),
    drift: last.drift && since ? { dir: last.drift, since, days: daysBetweenDays(since, monitorEnd) + 1 } : null,
    points, baselineCount: baseline.length, recentCount,
  };
}

/**
 * Tendances de tous les marqueurs d'un athlète à la date `asOf` (par défaut
 * aujourd'hui) : période observée = les `monitorDays` derniers jours.
 * Retourne { byMarker: { [key]: analyse }, alerts } — alerts = nombre de
 * variations fortes ou de dérives sur les marqueurs suffisamment renseignés.
 */
export function athleteTrends(athleteSeries, markers, asOf = questionnaireDay(), settings = TREND_SETTINGS) {
  const monitorStart = shiftDay(asOf, -(settings.monitorDays - 1));
  const byMarker = {};
  let alerts = 0;
  for (const marker of markers) {
    const values = athleteSeries?.get(marker.key);
    if (!values || values.size === 0) continue;
    const result = analyzeSeries(values, monitorStart, asOf, marker, settings);
    byMarker[marker.key] = result;
    if (result.status === 'ok' && (Math.abs(result.level) === 2 || result.drift)) alerts++;
  }
  return { byMarker, alerts };
}

// Jours à charger pour le tableau des marqueurs (référence + période observée + marge)
export const TRENDS_LOOKBACK_DAYS = TREND_SETTINGS.baselineDays + TREND_SETTINGS.monitorDays + 3;

// Nombre au format français, ex. « +2,3 »
export const formatScore = (z) => `${z > 0 ? '+' : z < 0 ? '−' : ''}${Math.abs(z).toFixed(1).replace('.', ',')}`;
export const formatValue = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ','));

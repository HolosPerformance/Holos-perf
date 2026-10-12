import React from 'react';

// Mise en évidence de types de séance sur les graphiques du dashboard : une
// bande verticale colorée derrière chaque jour où le type a eu lieu. Ce n'est
// pas un filtre : toutes les données restent affichées.

const normalize = (str) => (str || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_-]+/g, ' ').trim();

const RED = '#ef4444';
const BLUE = '#3b82f6';
// Couleurs des autres types, choisies pour bien se distinguer du rouge et du bleu
const PALETTE = ['#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#64748b'];

function fixedColor(label) {
  const norm = normalize(label);
  if (norm.includes('compet') || /\bmatch/.test(norm)) return RED;
  if (norm === 'seance' || norm.includes('seance type') || norm.includes('seance terrain')) return BLUE;
  return null;
}

// Couleur de chaque type : rouge pour compétition / match, bleu pour séance /
// séance type / séance terrain, puis une couleur distincte par autre type.
export function highlightColors(typeEntries) {
  const colors = {};
  let next = 0;
  typeEntries.forEach(([key, label]) => {
    colors[key] = fixedColor(label) || PALETTE[next++ % PALETTE.length];
  });
  return colors;
}

// Jours mis en évidence : { 'yyyy-MM-dd': [{ key, label, color, count, total }] }
// count = athlètes ayant eu ce type de séance ce jour-là, total = athlètes ayant
// une saisie ce jour-là (pour distinguer « tout le groupe » d'« un seul athlète »).
export function buildHighlightDays(logs, types) {
  if (!types.length) return {};
  const keys = new Set(types.map(t => t.key));
  const athletesByDay = {};
  const typeAthletesByDay = {};
  logs.forEach(log => {
    const day = (log.training_date || '').slice(0, 10);
    if (!day) return;
    const who = log.athlete_email || log.id;
    (athletesByDay[day] = athletesByDay[day] || new Set()).add(who);
    if (keys.has(log.session_type)) {
      const byType = (typeAthletesByDay[day] = typeAthletesByDay[day] || {});
      (byType[log.session_type] = byType[log.session_type] || new Set()).add(who);
    }
  });
  const days = {};
  Object.entries(typeAthletesByDay).forEach(([day, byType]) => {
    days[day] = types
      .filter(t => byType[t.key])
      .map(t => ({ ...t, count: byType[t.key].size, total: athletesByDay[day].size }));
  });
  return days;
}

// Bande plus marquée quand au moins la moitié des athlètes du jour sont concernés
export const bandOpacity = (h) => (h.count * 2 >= h.total ? 0.2 : 0.08);

export const highlightText = (h) => (h.total > 1 ? `${h.label} (${h.count}/${h.total} athlètes)` : h.label);

// Calque Recharts (via <Customized component={...} />) : une bande par jour mis
// en évidence, partagée en parts égales si plusieurs types tombent le même jour.
// Fonctionne pour les axes en bandes (histogrammes) et en points (courbes).
export function HighlightBands({ xAxisMap, offset, data, highlightKey = '__highlights' }) {
  const xAxis = xAxisMap && Object.values(xAxisMap)[0];
  if (!xAxis?.scale || !offset || !data) return null;
  const { scale, dataKey } = xAxis;
  const step = typeof scale.step === 'function' ? scale.step() : 0;
  const bandwidth = typeof scale.bandwidth === 'function' ? scale.bandwidth() : 0;
  if (!step) return null;
  const left = offset.left;
  const right = offset.left + offset.width;

  return (
    <g className="session-highlights">
      {data.map((point, i) => {
        const hl = point[highlightKey];
        if (!hl?.length) return null;
        const pos = scale(point[dataKey]);
        if (pos == null || Number.isNaN(pos)) return null;
        // Bande : toute la largeur d'un jour, centrée sur le jour
        const center = bandwidth ? pos + bandwidth / 2 : pos;
        const x0 = Math.max(left, center - step / 2);
        const x1 = Math.min(right, center + step / 2);
        const part = (x1 - x0) / hl.length;
        return hl.map((h, k) => (
          <g key={`${i}-${h.key}`}>
            <rect x={x0 + k * part} y={offset.top} width={part} height={offset.height} fill={h.color} fillOpacity={bandOpacity(h)} />
            <rect x={x0 + k * part} y={offset.top} width={part} height={3} fill={h.color} />
          </g>
        ));
      })}
    </g>
  );
}

// Légende des types mis en évidence, affichée sous le graphique (incluse dans les captures)
export function HighlightLegend({ types, fontSize = 13 }) {
  if (!types?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1" style={{ fontSize, fontWeight: 600, color: '#0f172a' }}>
      {types.map(t => (
        <span key={t.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: t.color, opacity: 0.6 }} />
          {t.label}
        </span>
      ))}
    </div>
  );
}

// Lignes à ajouter dans une infobulle pour un jour mis en évidence
export function HighlightTooltipLines({ highlights }) {
  if (!highlights?.length) return null;
  return (
    <div className="mt-1 pt-1 border-t border-slate-100 space-y-0.5">
      {highlights.map(h => (
        <p key={h.key} className="text-xs font-medium flex items-center gap-1.5" style={{ color: h.color }}>
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: h.color }} />
          {highlightText(h)}
        </p>
      ))}
    </div>
  );
}

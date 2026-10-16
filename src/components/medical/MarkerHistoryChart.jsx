import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Check } from 'lucide-react';
import { analyzeSeries, formatValue, shiftDay } from '@/lib/markerTrends';
import { formatDate, statusInfo } from '@/lib/medical';
import { formatPainIntensity } from '@/lib/painZones';

const STATUS_COLORS = {
  blesse: '#ef4444', reeducation: '#f97316', reathletisation: '#eab308', reprise_progressive: '#3b82f6',
};
const DRIFT_COLORS = { 1: '#ea580c', [-1]: '#2563eb' };
const LINE_COLOR = '#334155';
const MAX_DEFAULT = 3;

const shortDay = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

// Périodes de statut de la blessure, bornées à la fenêtre affichée
function statusBands(injury, start, end) {
  if (!injury) return [];
  const history = [...(injury.status_history || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const stop = injury.end_date || end;
  return history.map((h, i) => {
    const next = history[i + 1]?.date || stop;
    const x1 = h.date < start ? start : h.date;
    const x2 = next > end ? end : next;
    return x1 <= x2 && STATUS_COLORS[h.status] ? { x1, x2, status: h.status } : null;
  }).filter(Boolean);
}

function ChartTooltip({ active, payload, painsByDay }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pains = painsByDay.get(p.day);
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
      <p className="font-semibold text-slate-700">{formatDate(p.day)}</p>
      <p className="text-slate-600">Valeur : <b>{formatValue(p.value)}</b></p>
      {p.ema != null && <p className="text-slate-600">Tendance (MME) : <b>{formatValue(p.ema)}</b></p>}
      {p.drift !== 0 && <p style={{ color: DRIFT_COLORS[p.drift] }}>{p.drift > 0 ? '⤴ Hausse continue' : '⤵ Baisse continue'}</p>}
      {pains && <p className="text-red-600">Douleur : {pains}</p>}
    </div>
  );
}

function MarkerChart({ marker, analysis, injury, start, end, painsByDay }) {
  const learning = analysis.status === 'learning';
  const values = analysis.points.map(p => p.value).filter(v => v != null);
  const domain = marker.min != null && marker.max != null
    ? [marker.min, marker.max]
    : [Math.floor(Math.min(...values, analysis.reference ?? Infinity)), Math.ceil(Math.max(...values, analysis.reference ?? -Infinity))];
  const data = analysis.points.map(p => ({ ...p, pain: painsByDay.has(p.day) ? domain[0] : null }));
  const bands = statusBands(injury, start, end);
  const inWindow = (day) => day && day >= start && day <= end;

  const DriftDot = ({ cx, cy, payload }) => (payload.drift
    ? <circle cx={cx} cy={cy} r={4} fill={DRIFT_COLORS[payload.drift]} stroke="#fff" strokeWidth={1} />
    : null);
  const PainDot = ({ cx, cy, payload }) => (payload.pain != null
    ? <path d={`M${cx},${cy - 7} L${cx + 5},${cy + 1} L${cx - 5},${cy + 1} Z`} fill="#dc2626" />
    : null);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-slate-800">{marker.label}</p>
        <p className="text-xs text-slate-500">
          {learning
            ? `Référence insuffisante (${analysis.baselineCount} saisies sur les 28 jours précédents)`
            : `Habituel : ${formatValue(analysis.reference)} ± ${formatValue(analysis.sd)}`}
        </p>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            {bands.map((b, i) => (
              <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill={STATUS_COLORS[b.status]} fillOpacity={0.1} stroke="none" ifOverflow="hidden" />
            ))}
            {!learning && (
              <ReferenceArea y1={analysis.reference - analysis.sd} y2={analysis.reference + analysis.sd}
                fill="#94a3b8" fillOpacity={0.18} stroke="none" ifOverflow="hidden" />
            )}
            {!learning && <ReferenceLine y={analysis.reference} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="hidden" />}
            {inWindow(injury?.injury_date) && <ReferenceLine x={injury.injury_date} stroke="#dc2626" strokeWidth={2} />}
            {inWindow(injury?.end_date) && <ReferenceLine x={injury.end_date} stroke="#16a34a" strokeWidth={2} />}
            <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={24} />
            <YAxis domain={domain} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip content={<ChartTooltip painsByDay={painsByDay} />} />
            <Line dataKey="value" stroke="#cbd5e1" strokeWidth={1} connectNulls
              dot={{ r: 2.5, fill: LINE_COLOR, stroke: 'none' }} activeDot={{ r: 4 }} isAnimationActive={false} />
            {!learning && (
              <Line dataKey="ema" stroke={LINE_COLOR} strokeWidth={2} dot={<DriftDot />} activeDot={false} isAnimationActive={false} />
            )}
            <Line dataKey="pain" stroke="none" dot={<PainDot />} activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Évolution des marqueurs d'un athlète sur [start, end], par rapport à sa
 * référence des 28 jours précédant `start`. Avec une blessure : trait rouge au
 * jour de la blessure, trait vert à la fin, périodes de statut en couleur.
 */
export default function MarkerHistoryChart({ athleteSeries, markers, pains, start, end, injury, focusMarker }) {
  const analyses = useMemo(() => {
    const out = [];
    for (const marker of markers) {
      const values = athleteSeries?.get(marker.key);
      if (!values) continue;
      const analysis = analyzeSeries(values, start, end, marker);
      if (analysis.points.some(p => p.value != null)) out.push({ marker, analysis });
    }
    return out;
  }, [athleteSeries, markers, start, end]);

  // Par défaut : le marqueur demandé, sinon ceux qui s'écartent le plus de leur référence
  const defaultKeys = useMemo(() => {
    if (focusMarker && analyses.some(a => a.marker.key === focusMarker)) return [focusMarker];
    const spread = ({ analysis }) => (analysis.status === 'learning' ? -1
      : Math.max(...analysis.points.map(p => Math.abs((p.ema - analysis.reference) / analysis.sd))));
    return [...analyses].sort((a, b) => spread(b) - spread(a)).slice(0, MAX_DEFAULT).map(a => a.marker.key);
  }, [analyses, focusMarker]);
  const [picked, setPicked] = useState(null);
  const selectedKeys = picked || defaultKeys;
  const toggle = (key) => setPicked(prev => {
    const cur = prev || defaultKeys;
    return cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
  });

  const painsByDay = useMemo(() => {
    const map = new Map();
    for (const p of pains || []) {
      if (p.day < start || p.day > end) continue;
      const text = p.zones.map(z => (z.intensity != null ? `${z.fullLabel} (${formatPainIntensity(z)})` : z.fullLabel)).join(', ');
      map.set(p.day, map.has(p.day) ? `${map.get(p.day)}, ${text}` : text);
    }
    return map;
  }, [pains, start, end]);

  if (analyses.length === 0) {
    return <p className="text-sm text-slate-500">Aucune réponse chiffrée aux questionnaires entre le {formatDate(start)} et le {formatDate(end)}.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {analyses.map(({ marker }) => {
          const on = selectedKeys.includes(marker.key);
          return (
            <button key={marker.key} type="button" onClick={() => toggle(marker.key)} aria-pressed={on}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition ${on ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {on && <Check className="w-3 h-3" />}{marker.label}
            </button>
          );
        })}
      </div>

      {analyses.filter(a => selectedKeys.includes(a.marker.key)).map(({ marker, analysis }) => (
        <MarkerChart key={marker.key} marker={marker} analysis={analysis} injury={injury}
          start={start} end={end} painsByDay={painsByDay} />
      ))}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700" /> réponse du jour</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-slate-700" /> tendance (MME 7 j)</span>
        <span className="flex items-center gap-1"><span className="w-4 h-2.5 bg-slate-300/60" /> zone habituelle</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-600" /><span className="w-2 h-2 rounded-full bg-blue-600" /> dérive continue</span>
        <span className="flex items-center gap-1"><span className="text-red-600">▲</span> douleur signalée</span>
        {injury && (
          <>
            <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-red-600" /> blessure</span>
            {injury.end_date && <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-green-600" /> fin de blessure</span>}
            {Object.keys(STATUS_COLORS).map(s => (
              <span key={s} className="flex items-center gap-1">
                <span className="w-3 h-2.5 rounded-sm" style={{ background: STATUS_COLORS[s], opacity: 0.35 }} />{statusInfo(s).label}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Fenêtre du graphique : 4 semaines avant la blessure jusqu'à sa fin (ou
// aujourd'hui) ; sans blessure, les 4 dernières semaines.
export const CHART_WEEKS_BEFORE = 4;
export function chartWindow(injury, today) {
  if (!injury) return { start: shiftDay(today, -(CHART_WEEKS_BEFORE * 7 - 1)), end: today };
  return { start: shiftDay(injury.injury_date, -CHART_WEEKS_BEFORE * 7), end: injury.end_date || today };
}

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeMetricStats } from '@/lib/advancedStats';
import {
  format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, endOfDay, getISOWeek, differenceInCalendarDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';

// Largeur d'une colonne et d'une boîte selon le regroupement : moins de
// colonnes = boîtes plus larges.
const LAYOUT = {
  day: { slot: 52, box: 22 },
  week: { slot: 72, box: 30 },
  month: { slot: 96, box: 40 },
};
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 84;
// En dessous de ce nombre de valeurs, la boîte est affichée en pâle
export const LOW_COUNT = 5;

// Regroupement par défaut selon la longueur de la période
export function autoBoxplotGroupBy(startDate, endDate) {
  if (!startDate || !endDate) return 'day';
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  if (days <= 31) return 'day';
  if (days <= 183) return 'week';
  return 'month';
}

const WEEK_OPTIONS = { weekStartsOn: 1 };

// Colonnes du graphique : un jour, une semaine (lundi → dimanche) ou un mois.
// Une semaine ou un mois coupé par la période est marqué « partiel ».
function buildBuckets(groupBy, start, rangeEnd) {
  const end = endOfDay(rangeEnd);
  if (groupBy === 'week') {
    return eachWeekOfInterval({ start, end }, WEEK_OPTIONS).map(weekStart => ({
      key: format(weekStart, 'yyyy-MM-dd'),
      label: `S${getISOWeek(weekStart)} · ${format(weekStart, 'dd/MM')}`,
      range: `du ${format(weekStart, 'dd/MM')} au ${format(endOfWeek(weekStart, WEEK_OPTIONS), 'dd/MM/yyyy')}`,
      partial: weekStart < start || endOfWeek(weekStart, WEEK_OPTIONS) > end,
    }));
  }
  if (groupBy === 'month') {
    return eachMonthOfInterval({ start, end }).map(monthStart => ({
      key: format(monthStart, 'yyyy-MM'),
      label: format(monthStart, 'MMM yyyy', { locale: fr }),
      range: format(monthStart, 'MMMM yyyy', { locale: fr }),
      partial: monthStart < start || endOfMonth(monthStart) > end,
    }));
  }
  return eachDayOfInterval({ start, end }).map(day => ({
    key: format(day, 'yyyy-MM-dd'),
    label: format(day, 'EEE dd/MM', { locale: fr }),
    range: format(day, 'EEEE dd/MM/yyyy', { locale: fr }),
    partial: false,
  }));
}

function bucketKeyOf(groupBy, dateStr) {
  const date = parseISO(dateStr);
  if (groupBy === 'week') return format(startOfWeek(date, WEEK_OPTIONS), 'yyyy-MM-dd');
  if (groupBy === 'month') return format(startOfMonth(date), 'yyyy-MM');
  return format(date, 'yyyy-MM-dd');
}

// Statistiques d'une boîte + moustaches de Tukey (1,5 × écart interquartile) :
// les valeurs au-delà sont affichées comme valeurs extrêmes.
function boxStats(values) {
  const stats = computeMetricStats(values);
  if (!stats) return null;
  const iqr = stats.q3 - stats.q1;
  const lowFence = stats.q1 - 1.5 * iqr;
  const highFence = stats.q3 + 1.5 * iqr;
  const inside = values.filter(v => v >= lowFence && v <= highFence);
  return {
    ...stats,
    whiskerLow: Math.min(...inside),
    whiskerHigh: Math.max(...inside),
    outliers: values.filter(v => v < lowFence || v > highFence),
  };
}

const fmtNum = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// Un boxplot par jour, semaine ou mois (Q1/médiane/Q3, moyenne, moustaches de
// Tukey, valeurs extrêmes), sur la période filtrée déjà appliquée aux autres
// graphiques. Positions en pixels réels pour un rendu net ; défilement
// horizontal si les colonnes sont nombreuses.
export default function BoxPlotChart({ data, dataKey, title, color = '#3b82f6', startDate, endDate, height = 280, groupBy = 'day' }) {
  const [hovered, setHovered] = useState(null);
  const start = startDate ? parseISO(startDate) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const end = endDate ? parseISO(endDate) : new Date();
  const { slot, box } = LAYOUT[groupBy] || LAYOUT.day;

  const columns = useMemo(() => {
    const valuesByBucket = {};
    data.forEach(d => {
      const v = d[dataKey];
      if (!d.training_date || v == null || Number.isNaN(v)) return;
      const key = bucketKeyOf(groupBy, d.training_date);
      (valuesByBucket[key] = valuesByBucket[key] || []).push(v);
    });
    return buildBuckets(groupBy, start, end).map(bucket => ({
      ...bucket,
      stats: boxStats(valuesByBucket[bucket.key] || []),
    }));
  }, [data, dataKey, groupBy, startDate, endDate]);

  const hasData = columns.some(c => c.stats);
  const usableHeight = height - PAD_TOP - PAD_BOTTOM;
  const valueToY = (v) => PAD_TOP + usableHeight * (1 - v / 100);
  const totalWidth = PAD_LEFT + PAD_RIGHT + columns.length * slot;
  const axisY = height - PAD_BOTTOM;
  const hoveredColumn = hovered !== null ? columns[hovered] : null;

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div style={{ height }} className="flex items-center justify-center text-sm text-slate-400">
            Pas de données sur cette période
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative" style={{ width: totalWidth, minWidth: '100%' }}>
              <svg width={totalWidth} height={height} onMouseLeave={() => setHovered(null)}>
                {[0, 25, 50, 75, 100].map(v => (
                  <g key={v}>
                    <line x1={PAD_LEFT} x2={totalWidth - PAD_RIGHT} y1={valueToY(v)} y2={valueToY(v)} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <text x={2} y={valueToY(v) + 3} fontSize={10} fill="#94a3b8">{v}</text>
                  </g>
                ))}

                {columns.map((c, i) => {
                  const cx = PAD_LEFT + i * slot + slot / 2;
                  const s = c.stats;
                  const faint = s && s.count < LOW_COUNT;
                  const labelText = c.partial ? `${c.label} (partiel)` : c.label;
                  return (
                    <g key={c.key} onMouseEnter={() => setHovered(s ? i : null)}>
                      {hovered === i && (
                        <rect x={cx - slot / 2} y={PAD_TOP} width={slot} height={usableHeight} fill="#f1f5f9" />
                      )}
                      {s && (
                        <g opacity={faint ? 0.4 : 1}>
                          <line x1={cx} x2={cx} y1={valueToY(s.whiskerLow)} y2={valueToY(s.q1)} stroke="#94a3b8" strokeWidth={1.2} />
                          <line x1={cx} x2={cx} y1={valueToY(s.q3)} y2={valueToY(s.whiskerHigh)} stroke="#94a3b8" strokeWidth={1.2} />
                          <line x1={cx - box / 4} x2={cx + box / 4} y1={valueToY(s.whiskerLow)} y2={valueToY(s.whiskerLow)} stroke="#94a3b8" strokeWidth={1.2} />
                          <line x1={cx - box / 4} x2={cx + box / 4} y1={valueToY(s.whiskerHigh)} y2={valueToY(s.whiskerHigh)} stroke="#94a3b8" strokeWidth={1.2} />
                          <rect
                            x={cx - box / 2}
                            y={valueToY(s.q3)}
                            width={box}
                            height={Math.max(1, valueToY(s.q1) - valueToY(s.q3))}
                            fill={color}
                            fillOpacity={0.22}
                            stroke={color}
                            strokeWidth={1.5}
                            strokeDasharray={c.partial ? '4 3' : undefined}
                            rx={2}
                          />
                          <line x1={cx - box / 2} x2={cx + box / 2} y1={valueToY(s.median)} y2={valueToY(s.median)} stroke={color} strokeWidth={2} />
                          {/* Moyenne : losange */}
                          <path
                            d={`M ${cx} ${valueToY(s.mean) - 4} L ${cx + 4} ${valueToY(s.mean)} L ${cx} ${valueToY(s.mean) + 4} L ${cx - 4} ${valueToY(s.mean)} Z`}
                            fill="white"
                            stroke={color}
                            strokeWidth={1.5}
                          />
                          {s.outliers.map((v, k) => (
                            <circle key={k} cx={cx} cy={valueToY(v)} r={2.5} fill="white" stroke={color} strokeWidth={1.2} />
                          ))}
                        </g>
                      )}
                      {/* Zone de survol sur toute la hauteur de la colonne */}
                      <rect x={cx - slot / 2} y={PAD_TOP} width={slot} height={usableHeight} fill="transparent" />
                      {s && (
                        <text x={cx} y={axisY + 13} fontSize={10} textAnchor="middle" fill={faint ? '#d97706' : '#64748b'}>
                          n={s.count}
                        </text>
                      )}
                      <text
                        x={cx}
                        y={axisY + 26}
                        fontSize={10}
                        fill={c.partial ? '#d97706' : '#94a3b8'}
                        textAnchor="end"
                        transform={`rotate(-45 ${cx} ${axisY + 26})`}
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {hoveredColumn?.stats && (
                <BoxTooltip
                  column={hoveredColumn}
                  left={PAD_LEFT + hovered * slot + slot / 2}
                  alignRight={hovered > columns.length / 2}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BoxTooltip({ column, left, alignRight }) {
  const s = column.stats;
  const rows = [
    ['Maximum', s.max],
    ['Q3', s.q3],
    ['Médiane', s.median],
    ['Moyenne', s.mean],
    ['Q1', s.q1],
    ['Minimum', s.min],
  ];
  return (
    <div
      className="absolute top-2 z-10 pointer-events-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={alignRight ? { right: `calc(100% - ${left - 14}px)` } : { left: left + 14 }}
    >
      <p className="font-semibold text-slate-800 capitalize whitespace-nowrap">{column.range}</p>
      {column.partial && <p className="text-amber-600 whitespace-nowrap">Période partielle</p>}
      <table className="mt-1">
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              <td className="pr-3 text-slate-500">{label}</td>
              <td className="text-right tabular-nums text-slate-800">{fmtNum(v)}</td>
            </tr>
          ))}
          <tr>
            <td className="pr-3 pt-1 text-slate-500">Valeurs</td>
            <td className={`pt-1 text-right tabular-nums font-semibold ${s.count < LOW_COUNT ? 'text-amber-600' : 'text-slate-800'}`}>{s.count}</td>
          </tr>
          {s.outliers.length > 0 && (
            <tr>
              <td className="pr-3 text-slate-500">Extrêmes</td>
              <td className="text-right tabular-nums text-slate-800">{s.outliers.length}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

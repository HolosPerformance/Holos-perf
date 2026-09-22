import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeMetricStats } from '@/lib/advancedStats';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY_WIDTH = 52;
const BOX_WIDTH = 22;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 60;

// Un boxplot par jour (min/Q1/médiane/Q3/max), sur la période filtrée déjà
// appliquée aux autres graphiques. Positions en pixels réels (pas de mise à
// l'échelle SVG) pour un rendu net ; défilement horizontal si la période est longue.
export default function BoxPlotChart({ data, dataKey, title, color = '#3b82f6', startDate, endDate, height = 260 }) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();
  const allDays = eachDayOfInterval({ start, end });

  const dayStats = allDays.map(day => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const values = data
      .filter(d => d.training_date && format(parseISO(d.training_date), 'yyyy-MM-dd') === dateKey)
      .map(d => d[dataKey])
      .filter(v => v != null);
    return {
      dateKey,
      fullDate: format(day, 'EEE dd/MM', { locale: fr }),
      stats: computeMetricStats(values),
    };
  });

  const hasData = dayStats.some(d => d.stats);
  const usableHeight = height - PAD_TOP - PAD_BOTTOM;
  const valueToY = (v) => PAD_TOP + usableHeight * (1 - v / 100);
  const totalWidth = PAD_LEFT + PAD_RIGHT + dayStats.length * DAY_WIDTH;

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
            <svg width={totalWidth} height={height} style={{ minWidth: '100%' }}>
              {[0, 25, 50, 75, 100].map(v => (
                <g key={v}>
                  <line x1={PAD_LEFT} x2={totalWidth - PAD_RIGHT} y1={valueToY(v)} y2={valueToY(v)} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x={2} y={valueToY(v) + 3} fontSize={10} fill="#94a3b8">{v}</text>
                </g>
              ))}

              {dayStats.map((d, i) => {
                const cx = PAD_LEFT + i * DAY_WIDTH + DAY_WIDTH / 2;
                return (
                  <g key={d.dateKey}>
                    {d.stats && (
                      <>
                        <line x1={cx} x2={cx} y1={valueToY(d.stats.min)} y2={valueToY(d.stats.max)} stroke="#94a3b8" strokeWidth={1.2} />
                        <circle cx={cx} cy={valueToY(d.stats.min)} r={2} fill="#94a3b8" />
                        <circle cx={cx} cy={valueToY(d.stats.max)} r={2} fill="#94a3b8" />
                        <rect
                          x={cx - BOX_WIDTH / 2}
                          y={valueToY(d.stats.q3)}
                          width={BOX_WIDTH}
                          height={Math.max(1, valueToY(d.stats.q1) - valueToY(d.stats.q3))}
                          fill={color}
                          fillOpacity={0.22}
                          stroke={color}
                          strokeWidth={1.5}
                          rx={2}
                        />
                        <line
                          x1={cx - BOX_WIDTH / 2}
                          x2={cx + BOX_WIDTH / 2}
                          y1={valueToY(d.stats.median)}
                          y2={valueToY(d.stats.median)}
                          stroke={color}
                          strokeWidth={2}
                        />
                      </>
                    )}
                    <text
                      x={cx}
                      y={height - PAD_BOTTOM + 14}
                      fontSize={10}
                      fill="#94a3b8"
                      textAnchor="end"
                      transform={`rotate(-45 ${cx} ${height - PAD_BOTTOM + 14})`}
                    >
                      {d.fullDate}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

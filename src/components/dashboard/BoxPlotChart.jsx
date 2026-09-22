import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeMetricStats } from '@/lib/advancedStats';

// Boxplot en SVG pour un indicateur, sur la période filtrée déjà appliquée
// aux autres graphiques (data = logs déjà filtrés en amont).
// Échelle fixe 0-100, cohérente avec les autres graphiques du dashboard.
export default function BoxPlotChart({ data, dataKey, title, color = '#3b82f6', height = 240 }) {
  const values = data.map(d => d[dataKey]).filter(v => v != null);
  const stats = computeMetricStats(values);

  const padTop = 24;
  const padBottom = 24;
  const usableHeight = height - padTop - padBottom;
  const valueToY = (v) => padTop + usableHeight * (1 - v / 100);

  const boxX = 60;
  const boxWidth = 56;
  const centerX = boxX + boxWidth / 2;
  const capHalfWidth = 16;
  const labelX = boxX + boxWidth + 14;

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!stats ? (
          <div style={{ height }} className="flex items-center justify-center text-sm text-slate-400">
            Pas de données sur cette période
          </div>
        ) : (
          <svg width="100%" height={height} viewBox={`0 0 220 ${height}`} preserveAspectRatio="xMidYMid meet">
            {/* Repères d'échelle 0-100 */}
            <text x={4} y={valueToY(100) + 4} fontSize={10} fill="#94a3b8">100</text>
            <text x={4} y={valueToY(0) + 4} fontSize={10} fill="#94a3b8">0</text>
            <line x1={boxX - 6} y1={valueToY(0)} x2={boxX - 6} y2={valueToY(100)} stroke="#e2e8f0" strokeWidth={1} />

            {/* Moustache min-max */}
            <line x1={centerX} y1={valueToY(stats.min)} x2={centerX} y2={valueToY(stats.max)} stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={centerX - capHalfWidth / 2} y1={valueToY(stats.min)} x2={centerX + capHalfWidth / 2} y2={valueToY(stats.min)} stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={centerX - capHalfWidth / 2} y1={valueToY(stats.max)} x2={centerX + capHalfWidth / 2} y2={valueToY(stats.max)} stroke="#94a3b8" strokeWidth={1.5} />

            {/* Boîte Q1-Q3 */}
            <rect
              x={boxX}
              y={valueToY(stats.q3)}
              width={boxWidth}
              height={Math.max(1, valueToY(stats.q1) - valueToY(stats.q3))}
              fill={color}
              fillOpacity={0.18}
              stroke={color}
              strokeWidth={2}
              rx={4}
            />

            {/* Médiane */}
            <line x1={boxX} y1={valueToY(stats.median)} x2={boxX + boxWidth} y2={valueToY(stats.median)} stroke={color} strokeWidth={3} />

            {/* Moyenne (marqueur distinct) */}
            <circle cx={centerX} cy={valueToY(stats.mean)} r={4} fill="#fff" stroke="#64748b" strokeWidth={2} />

            {/* Étiquettes */}
            <text x={labelX} y={valueToY(stats.max) + 3} fontSize={10} fill="#64748b">Max {stats.max}</text>
            <text x={labelX} y={valueToY(stats.q3) + 3} fontSize={10} fill={color}>Q3 {stats.q3}</text>
            <text x={labelX} y={valueToY(stats.median) + 3} fontSize={10} fontWeight={600} fill={color}>Méd. {stats.median}</text>
            <text x={labelX} y={valueToY(stats.mean) - 6} fontSize={10} fill="#64748b">Moy. {stats.mean}</text>
            <text x={labelX} y={valueToY(stats.q1) + 3} fontSize={10} fill={color}>Q1 {stats.q1}</text>
            <text x={labelX} y={valueToY(stats.min) + 3} fontSize={10} fill="#64748b">Min {stats.min}</text>
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

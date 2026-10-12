import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Customized } from 'recharts';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateEMA, computeLinearTrend, formatSlope } from '@/lib/advancedStats';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChartStyle, xAxisInterval } from './chartStyle';
import { HighlightBands, HighlightLegend, HighlightTooltipLines } from './sessionHighlights';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 max-w-xs">
        <p className="font-medium text-slate-800 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <p key={index} className="text-sm flex justify-between gap-4" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-semibold">{entry.value}</span>
            </p>
          ))}
        </div>
        <HighlightTooltipLines highlights={payload[0]?.payload?.__highlights} />
      </div>
    );
  }
  return null;
};

// `showTrend` : une droite de tendance par indicateur sélectionné.
// `highlights` : types de séance mis en évidence ({ types, days }, voir sessionHighlights).
// `exporting` : rendu pour la capture d'image (style ordinateur, marges
// réduites, légende entière, sans animation).
export default function AthleteDataChart({ data, selectedMetrics, title, metricConfig, startDate, endDate, height = 350, statLines = [], emaDefs = [], showTrend = false, highlights, isZoomed = false, exporting = false }) {
  const isMobile = useIsMobile() && !exporting;
  const style = getChartStyle(isMobile);
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();
  const allDays = eachDayOfInterval({ start, end });

  const sortedData = [...data].sort((a, b) => new Date(a.training_date) - new Date(b.training_date));

  const dataMap = new Map();
  sortedData.forEach(log => {
    const date = format(parseISO(log.training_date), 'yyyy-MM-dd');
    dataMap.set(date, log);
  });

  // Moyennes mobiles exponentielles : une série par indicateur sélectionné et
  // par MME active, calculée sur les saisies existantes (dans l'ordre des dates).
  const emaByDate = new Map();
  selectedMetrics.forEach(metric => {
    const points = sortedData.filter(d => d[metric] != null);
    emaDefs.forEach(def => {
      const emaValues = calculateEMA(points.map(d => d[metric]), def.period);
      points.forEach((d, i) => {
        const date = format(parseISO(d.training_date), 'yyyy-MM-dd');
        const entry = emaByDate.get(date) || {};
        entry[`${metric}__${def.key}`] = emaValues[i];
        emaByDate.set(date, entry);
      });
    });
  });

  // Droites de tendance, calculées sur les seules saisies de la période
  const trends = {};
  if (showTrend) {
    const startKey = format(start, 'yyyy-MM-dd');
    const endKey = format(end, 'yyyy-MM-dd');
    selectedMetrics.forEach(metric => {
      const trend = computeLinearTrend(
        sortedData.map(d => ({ date: format(parseISO(d.training_date), 'yyyy-MM-dd'), value: d[metric] })),
        startKey,
        endKey
      );
      if (trend) trends[metric] = trend;
    });
  }

  const chartData = allDays.map((day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const existingData = dataMap.get(dateKey);
    const dayOfWeek = getDay(day);
    const isMonday = dayOfWeek === 1;

    const dataPoint = {
      training_date: dateKey,
      date: format(day, 'dd/MM', { locale: fr }),
      dayLabel: format(day, 'EEE', { locale: fr }),
      fullDate: format(day, 'EEE dd/MM', { locale: fr }),
      isMonday,
      dayOfWeek
    };
    const dayHighlights = highlights?.days?.[dateKey];

    if (existingData) {
      Object.assign(dataPoint, existingData);
    }
    Object.assign(dataPoint, emaByDate.get(dateKey));
    Object.entries(trends).forEach(([metric, trend]) => {
      dataPoint[`${metric}__trend`] = trend.valueAt(dateKey);
    });
    // Après les données du jour, qui ne doivent pas l'écraser
    dataPoint.__highlights = dayHighlights;

    return dataPoint;
  });

  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
  const colorOf = (metric, index) => metricConfig?.[metric]?.color || chartColors[index % chartColors.length];
  const nameOf = (metric) => metricConfig?.[metric]?.name || metric;

  // Légende limitée à 2 lignes, défilable au-delà, pour que les nombreuses
  // séries de statistiques n'écrasent pas le graphique (sauf à l'export, où
  // elle est affichée en entier).
  const legendLineHeight = style.fontSize + 8;
  const legendStyle = exporting
    ? style.legendStyle
    : { ...style.legendStyle, maxHeight: legendLineHeight * 2, overflowY: 'auto' };

  return (
    <Card className={exporting ? 'border-0 shadow-none bg-white' : 'shadow-sm border-0'}>
      {title && (
        <CardHeader className={exporting ? 'p-2 pb-1' : 'pb-2'}>
          <CardTitle className={exporting ? 'text-lg text-slate-900' : 'text-lg'}>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={exporting ? 'p-0' : `${title ? 'pt-0' : 'pt-6'}${isMobile ? ' px-2 pb-4' : ''}`}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: isZoomed && !isMobile ? 180 : 5, left: -12, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            {/* Types de séance mis en évidence, dessinés derrière les courbes */}
            {highlights?.types?.length > 0 && <Customized component={HighlightBands} />}
            <XAxis
              dataKey="fullDate"
              tick={style.axisTick}
              stroke={style.axisLineColor}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={style.xAxisHeight}
              interval={xAxisInterval(isMobile, chartData.length)}
            />
            <YAxis
              tick={style.axisTick}
              stroke={style.axisLineColor}
              tickLine={false}
              domain={[0, 100]}
              allowDataOverflow
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={legendStyle} />
            {statLines.map((line) => (
              <ReferenceLine
                key={line.id}
                y={line.value}
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={line.dash}
                label={isZoomed && !isMobile ? { value: `${line.label} (${line.value})`, position: 'right', fill: line.color, fontSize: style.fontSize, fontWeight: 600 } : undefined}
              />
            ))}
            {selectedMetrics.map((metric, index) => {
              const metricColor = colorOf(metric, index);

              return (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  name={nameOf(metric)}
                  stroke={metricColor}
                  strokeWidth={isMobile ? 3 : 4}
                  strokeOpacity={1}
                  dot={{ r: isMobile ? 3 : 5, fill: metricColor, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff', fill: metricColor }}
                  connectNulls={false}
                  isAnimationActive={!exporting}
                />
              );
            })}
            {selectedMetrics.flatMap((metric, index) => {
              const metricColor = colorOf(metric, index);
              return emaDefs.map(def => (
                <Line
                  key={`${metric}__${def.key}`}
                  type="monotone"
                  dataKey={`${metric}__${def.key}`}
                  name={`${def.label} · ${nameOf(metric)}`}
                  stroke={metricColor}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  strokeDasharray={def.dash}
                  dot={false}
                  activeDot={false}
                  legendType="plainline"
                  connectNulls
                  isAnimationActive={!exporting}
                />
              ));
            })}
            {selectedMetrics.filter(metric => trends[metric]).map((metric) => (
              <Line
                key={`${metric}__trend`}
                type="linear"
                dataKey={`${metric}__trend`}
                name={`Tendance · ${nameOf(metric)} (${formatSlope(trends[metric].slope)})`}
                stroke={colorOf(metric, selectedMetrics.indexOf(metric))}
                strokeWidth={2.5}
                strokeOpacity={0.9}
                dot={false}
                activeDot={false}
                legendType="plainline"
                connectNulls
                isAnimationActive={!exporting}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <HighlightLegend types={highlights?.types} fontSize={style.fontSize} />
      </CardContent>
    </Card>
  );
}

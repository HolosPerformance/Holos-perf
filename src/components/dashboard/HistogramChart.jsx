import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine } from 'recharts';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REFERENCE_STAT_DEFS, EMA_STAT_DEFS, TREND_STAT_DEF, calculateEMA, computeMetricStats, computeLinearTrend, formatSlope } from '@/lib/advancedStats';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChartStyle, xAxisInterval } from './chartStyle';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload.find(p => p.dataKey === 'value')?.value;
    const trend = payload.find(p => p.dataKey === 'trend')?.value;
    if (value == null && trend == null) return null;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
        <p className="font-medium text-slate-800">{label}</p>
        {value != null && (
          <p className="text-sm text-slate-600">
            Valeur: <span className="font-semibold">{value}</span>
          </p>
        )}
        {trend != null && (
          <p className="text-sm text-slate-600">
            Tendance: <span className="font-semibold">{trend}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

// `exporting` : rendu pour la capture d'image (style ordinateur, marges
// réduites, sans animation).
export default function HistogramChart({ data, dataKey, title, color, startDate, endDate, height = 220, advancedStats, isZoomed = false, exporting = false }) {
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

  const filteredData = sortedData.filter(d => d[dataKey] != null);
  const values = filteredData.map(d => d[dataKey]);
  const ema7 = calculateEMA(values, 7);
  const ema21 = calculateEMA(values, 21);
  const metricStats = computeMetricStats(values);
  const trend = advancedStats?.trend
    ? computeLinearTrend(
        filteredData.map(d => ({ date: d.training_date, value: d[dataKey] })),
        format(start, 'yyyy-MM-dd'),
        format(end, 'yyyy-MM-dd')
      )
    : null;

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
      dayOfWeek,
      value: null,
      ema7: null,
      ema21: null,
      trend: trend ? trend.valueAt(dateKey) : null
    };

    if (existingData) {
      dataPoint.value = existingData[dataKey];
      dataPoint.athlete = existingData.athlete_name;

      const dataIndex = filteredData.findIndex(d =>
        format(parseISO(d.training_date), 'yyyy-MM-dd') === dateKey
      );

      if (dataIndex !== -1) {
        dataPoint.ema7 = ema7[dataIndex];
        dataPoint.ema21 = ema21[dataIndex];
      }
    }

    return dataPoint;
  });

  // Jours de compétition : détection par le session_type (label dynamique)
  const competitionIndices = chartData
    .map((d, i) => {
      const st = (d.session_type || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (st.includes('competition') || st.includes('comp')) return i;
      return null;
    })
    .filter(i => i !== null);

  return (
    <Card className={exporting ? 'border-0 shadow-none bg-white' : 'shadow-sm border-0'}>
      <CardHeader className={exporting ? 'p-2 pb-1' : 'pb-2'}>
        <CardTitle className={exporting ? 'text-base font-semibold text-slate-900' : 'text-base font-semibold'}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={exporting ? 'p-0' : isMobile ? 'px-2 pb-4' : undefined}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 5, right: isZoomed && !isMobile ? 130 : 5, left: -12, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="fullDate"
              tick={style.axisTick}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={style.xAxisHeight}
              interval={xAxisInterval(isMobile, chartData.length)}
            />
            <YAxis
              tick={style.axisTick}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              allowDataOverflow
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Sur téléphone, la légende « Valeur » seule n'apporte rien : masquée */}
            {(!isMobile || Object.values(advancedStats || {}).some(Boolean)) && (
              <Legend
                iconType="line"
                wrapperStyle={{ ...style.legendStyle, paddingTop: '8px' }}
                iconSize={12}
              />
            )}
            {competitionIndices.map((index) => (
              <ReferenceLine
                key={`competition-${index}`}
                x={chartData[index].fullDate}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeDasharray="4 2"
              />
            ))}
            {metricStats && REFERENCE_STAT_DEFS.filter(def => advancedStats?.[def.key]).map((def) => (
              <ReferenceLine
                key={def.key}
                y={metricStats[def.key]}
                stroke={def.color}
                strokeWidth={2}
                strokeDasharray={def.dash}
                label={isZoomed && !isMobile ? { value: `${def.label} (${metricStats[def.key]})`, position: 'right', fill: def.color, fontSize: style.fontSize, fontWeight: 600 } : undefined}
              />
            ))}
            <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Valeur" isAnimationActive={!exporting}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={color || '#3b82f6'} opacity={0.85} />
              ))}
            </Bar>
            {EMA_STAT_DEFS.filter(def => advancedStats?.[def.key]).map((def) => (
              <Line
                key={def.key}
                type="monotone"
                dataKey={def.key}
                stroke={def.color}
                strokeWidth={3.5}
                dot={{ r: 3, fill: def.color }}
                name={def.label}
                strokeOpacity={1}
                strokeDasharray={def.dash}
                connectNulls
                isAnimationActive={!exporting}
              />
            ))}
            {trend && (
              <Line
                type="linear"
                dataKey="trend"
                stroke={TREND_STAT_DEF.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                name={`Tendance (${formatSlope(trend.slope)})`}
                legendType="plainline"
                connectNulls
                isAnimationActive={!exporting}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

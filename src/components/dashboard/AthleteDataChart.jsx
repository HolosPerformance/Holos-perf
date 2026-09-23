import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateEMA } from '@/lib/advancedStats';

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
      </div>
    );
  }
  return null;
};

export default function AthleteDataChart({ data, selectedMetrics, title, metricConfig, startDate, endDate, height = 350, statLines = [], emaDefs = [], isZoomed = false }) {
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
    
    if (existingData) {
      Object.assign(dataPoint, existingData);
    }
    Object.assign(dataPoint, emaByDate.get(dateKey));
    
    return dataPoint;
  });

  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

  // Jours de compétition : détection par le session_type (label dynamique)
  const competitionIndices = chartData
    .map((d, i) => {
      const st = (d.session_type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (st.includes('competition') || st.includes('comp')) return i;
      return null;
    })
    .filter(i => i !== null);

  return (
    <Card className="shadow-sm border-0">
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "pt-6"}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: isZoomed ? 180 : 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="fullDate" 
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
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
            {statLines.map((line) => (
              <ReferenceLine
                key={line.id}
                y={line.value}
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={line.dash}
                label={isZoomed ? { value: `${line.label} (${line.value})`, position: 'right', fill: line.color, fontSize: 11, fontWeight: 600 } : undefined}
              />
            ))}
            {selectedMetrics.map((metric, index) => {
              const metricColor = metricConfig?.[metric]?.color || chartColors[index % chartColors.length];
              
              return (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  name={metricConfig?.[metric]?.name || metric}
                  stroke={metricColor}
                  strokeWidth={4}
                  strokeOpacity={1}
                  dot={{ r: 5, fill: metricColor, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff', fill: metricColor }}
                  connectNulls={false}
                />
              );
            })}
            {selectedMetrics.flatMap((metric, index) => {
              const metricColor = metricConfig?.[metric]?.color || chartColors[index % chartColors.length];
              return emaDefs.map(def => (
                <Line
                  key={`${metric}__${def.key}`}
                  type="monotone"
                  dataKey={`${metric}__${def.key}`}
                  name={`${def.label} · ${metricConfig?.[metric]?.name || metric}`}
                  stroke={metricColor}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  strokeDasharray={def.dash}
                  dot={false}
                  activeDot={false}
                  legendType="plainline"
                  connectNulls
                />
              ));
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
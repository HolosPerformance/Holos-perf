import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine } from 'recharts';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REFERENCE_STAT_DEFS, EMA_STAT_DEFS, calculateEMA, computeMetricStats } from '@/lib/advancedStats';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
        <p className="font-medium text-slate-800">{label}</p>
        <p className="text-sm text-slate-600">
          Valeur: <span className="font-semibold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function HistogramChart({ data, dataKey, title, color, startDate, endDate, height = 220, advancedStats, isZoomed = false }) {
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
      ema21: null
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
      const st = (d.session_type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (st.includes('competition') || st.includes('comp')) return i;
      return null;
    })
    .filter(i => i !== null);

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 5, right: isZoomed ? 90 : 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
              dataKey="fullDate" 
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              iconType="line" 
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconSize={12}
            />
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
                label={isZoomed ? { value: `${def.label} (${metricStats[def.key]})`, position: 'right', fill: def.color, fontSize: 11, fontWeight: 600 } : undefined}
              />
            ))}
            <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Valeur">
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
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
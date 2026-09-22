import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100">
        <p className="font-medium text-slate-800 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PerformanceChart({ data, metrics = ['rpe', 'fatigue_level'], title }) {
  const metricConfig = {
    rpe: { name: 'RPE', color: '#06b6d4' },
    fatigue_level: { name: 'Fatigue', color: '#f59e0b' },
    sleep_quality: { name: 'Sommeil', color: '#8b5cf6' },
    muscle_soreness: { name: 'Douleurs', color: '#ef4444' },
    sleep_hours: { name: 'Heures sommeil', color: '#10b981' }
  };

  const chartData = data
    .sort((a, b) => new Date(a.training_date) - new Date(b.training_date))
    .map(log => ({
      ...log,
      date: format(parseISO(log.training_date), 'dd MMM', { locale: fr })
    }));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      {title && <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            domain={[0, 10]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {metrics.map(metric => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              name={metricConfig[metric]?.name || metric}
              stroke={metricConfig[metric]?.color || '#06b6d4'}
              strokeWidth={2}
              dot={{ fill: metricConfig[metric]?.color || '#06b6d4', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
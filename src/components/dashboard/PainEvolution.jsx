import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase as base44 } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { painScaleOf, painZonesOf, isPainZoneOn, formatPainIntensity } from '@/lib/painZones';
import { PainBodyThumb } from '@/components/questionnaire/BodyPainInput';
import { getChartStyle, xAxisInterval } from './chartStyle';

const LINE_COLOR = '#e11d48';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Valeur ramenée d'une échelle à une autre (questions aux échelles différentes)
const rescale = (v, from, to) => (from.max === to.max && from.min === to.min
  ? v
  : to.min + ((v - from.min) / (from.max - from.min)) * (to.max - to.min));

/**
 * Réponses « Zones douloureuses » par athlète et par jour.
 * Retourne { scale, days: Map(date → [{ email, name, zones, scale, max }]) } ;
 * `max` : intensité la plus forte du jour (0 si l'athlète a répondu sans douleur).
 */
export function collectPainEntries(logs, templates) {
  const templateById = new Map(templates.map(t => [t.id, t]));
  const byKey = new Map();
  let scale = null;
  logs.forEach(log => {
    const questions = (templateById.get(log.template_id)?.questions || []).filter(q => q.type === 'body_pain');
    questions.forEach(q => {
      const value = log[q.id];
      if (value == null || typeof value !== 'object' || Array.isArray(value)) return;
      const qScale = painScaleOf(q);
      if (!scale) scale = qScale;
      const key = `${log.training_date}|${log.athlete_email}`;
      const entry = byKey.get(key) || {
        date: log.training_date, email: log.athlete_email, name: log.athlete_name || log.athlete_email,
        zones: {}, scale: qScale,
      };
      // Plusieurs réponses le même jour : intensité la plus forte par zone
      Object.entries(value).forEach(([id, v]) => {
        if (!isPainZoneOn(v)) return;
        const prev = entry.zones[id];
        entry.zones[id] = typeof v === 'number' && typeof prev === 'number' ? Math.max(prev, v) : (prev ?? v);
      });
      byKey.set(key, entry);
    });
  });
  const ref = scale || painScaleOf(null);
  const days = new Map();
  byKey.forEach(entry => {
    const intensities = Object.values(entry.zones).filter(v => typeof v === 'number');
    entry.max = intensities.length ? rescale(Math.max(...intensities), entry.scale, ref) : 0;
    entry.hurt = Object.keys(entry.zones).length > 0;
    if (!days.has(entry.date)) days.set(entry.date, []);
    days.get(entry.date).push(entry);
  });
  days.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  return { scale: ref, days };
}

const PainTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point.entries?.length) return null;
  const hurt = point.entries.filter(e => e.hurt);
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100 max-w-xs text-sm">
      <p className="font-medium text-slate-800 mb-1">{label}</p>
      {point.entries.length > 1 && (
        <p className="text-slate-600 mb-1">
          Médiane : <span className="font-semibold">{point.value}</span>
          <span className="text-xs text-slate-400"> · {hurt.length}/{point.entries.length} athlète{point.entries.length > 1 ? 's' : ''} avec douleur</span>
        </p>
      )}
      {hurt.length === 0 ? (
        <p className="text-slate-500">Aucune douleur</p>
      ) : (
        <div className="space-y-1">
          {hurt.map(e => (
            <div key={e.email}>
              {point.entries.length > 1 && <p className="font-semibold text-slate-700">{e.name}</p>}
              <p className="text-xs text-slate-600">
                {painZonesOf(e.zones, e.scale).map(z => (z.intensity != null ? `${z.fullLabel} (${formatPainIntensity(z)})` : z.fullLabel)).join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Évolution de la douleur (questions « Zones douloureuses ») : intensité la
 * plus forte du jour pour un athlète, médiane des athlètes ayant répondu pour
 * plusieurs (comme le graphique « Évolution »). En dessous, pour chaque jour
 * avec douleur, une silhouette par athlète douloureux.
 */
export default function PainEvolution({ logs, templates, startDate, endDate }) {
  const isMobile = useIsMobile();
  const style = getChartStyle(isMobile);
  const { scale, days } = useMemo(() => collectPainEntries(logs, templates), [logs, templates]);

  const hurtEmails = useMemo(
    () => [...new Set([...days.values()].flat().filter(e => e.hurt).map(e => e.email))].sort(),
    [days]
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ['pain-athlete-profiles', hurtEmails.join(',')],
    queryFn: () => base44.entities.AthleteProfile.filterIn('athlete_email', hurtEmails),
    enabled: hurtEmails.length > 0,
  });
  const sexOf = (email) => profiles.find(p => p.athlete_email === email)?.sex || null;

  const chartData = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).map(day => {
    const key = format(day, 'yyyy-MM-dd');
    const entries = days.get(key) || [];
    return {
      key,
      fullDate: format(day, 'EEE dd/MM', { locale: fr }),
      entries,
      value: entries.length ? Math.round(median(entries.map(e => e.max)) * 10) / 10 : null,
    };
  });
  const painDays = chartData.filter(d => d.entries.some(e => e.hurt));
  const answered = chartData.some(d => d.entries.length > 0);

  if (!answered) {
    return (
      <Card className="shadow-sm border-0">
        <CardContent className="pt-6">
          <p className="text-center text-sm text-slate-500 py-6">Aucune réponse sur les douleurs pendant la période sélectionnée.</p>
        </CardContent>
      </Card>
    );
  }

  const multi = new Set([...days.values()].flat().map(e => e.email)).size > 1;

  return (
    <Card className="shadow-sm border-0">
      <CardContent className={`pt-6 ${isMobile ? 'px-2' : ''}`}>
        <p className="text-xs text-slate-500 mb-3 px-2">
          {multi
            ? 'Médiane, jour par jour, de la douleur la plus forte de chaque athlète ayant répondu (0 = aucune douleur). Survolez un point pour le détail.'
            : 'Douleur la plus forte déclarée chaque jour (0 = aucune douleur). Survolez un point pour le détail des zones.'}
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -12, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
            <YAxis tick={style.axisTick} stroke={style.axisLineColor} tickLine={false} domain={[Math.min(0, scale.min), scale.max]} allowDecimals={false} />
            <Tooltip content={<PainTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              name={multi ? 'Douleur (médiane)' : 'Douleur'}
              stroke={LINE_COLOR}
              strokeWidth={isMobile ? 3 : 4}
              dot={{ r: isMobile ? 3 : 5, fill: LINE_COLOR, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff', fill: LINE_COLOR }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 px-2">
          <p className="text-sm font-semibold text-slate-700 mb-2">Zones douloureuses par jour</p>
          {painDays.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune zone douloureuse déclarée sur la période.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {painDays.map(day => (
                <div key={day.key} className="flex-shrink-0 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                  <p className="text-xs font-semibold text-slate-600 text-center mb-1 capitalize">{day.fullDate}</p>
                  <div className="flex gap-2">
                    {day.entries.filter(e => e.hurt).map(e => (
                      <div key={e.email} className="flex flex-col items-center"
                        title={`${e.name} : ${painZonesOf(e.zones, e.scale).map(z => (z.intensity != null ? `${z.fullLabel} (${formatPainIntensity(z)})` : z.fullLabel)).join(', ')}`}>
                        <PainBodyThumb value={e.zones} scale={e.scale} sex={sexOf(e.email)} />
                        {multi && <span className="text-[11px] text-slate-600 max-w-[6rem] truncate mt-0.5">{e.name}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

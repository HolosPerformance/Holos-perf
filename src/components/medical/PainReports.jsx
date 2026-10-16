import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';
import { daysBetweenDays, shiftDay } from '@/lib/markerTrends';
import { formatPainIntensity } from '@/lib/painZones';

export const PAIN_REPORT_DAYS = 7;
const VISIBLE = 6;

const agoText = (days) => (days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`);

/**
 * Douleurs signalées dans les questionnaires sur les 7 derniers jours, une
 * ligne par athlète et par zone. Une zone signalée plusieurs jours est mise en
 * avant. « Créer une fiche » ouvre le formulaire pré-rempli avec la zone.
 */
export default function PainReports({ athletes, pains, today, onCreate, onOpen }) {
  const [showAll, setShowAll] = useState(false);

  const reports = useMemo(() => {
    const byEmail = new Map(athletes.map(a => [a.email, a]));
    const from = shiftDay(today, -(PAIN_REPORT_DAYS - 1));
    const grouped = new Map();
    for (const p of pains) {
      const athlete = byEmail.get(p.email);
      if (!athlete || p.day < from || p.day > today) continue;
      for (const zone of p.zones) {
        const key = `${p.email}|${zone.location}|${zone.side}|${zone.label}`;
        // peak : signalement le plus intense (rapporté à son échelle)
        const r = grouped.get(key) || { key, athlete, zone, days: new Set(), lastDay: p.day, peak: null };
        r.days.add(p.day);
        if (p.day > r.lastDay) r.lastDay = p.day;
        const ratio = (z) => z.intensity / (z.scaleMax || 10);
        if (zone.intensity != null && (!r.peak || ratio(zone) > ratio(r.peak))) r.peak = zone;
        grouped.set(key, r);
      }
    }
    return [...grouped.values()].sort((a, b) =>
      (b.lastDay > a.lastDay ? 1 : b.lastDay < a.lastDay ? -1 : 0)
      || b.days.size - a.days.size
      || (b.peak ? b.peak.intensity / (b.peak.scaleMax || 10) : 0) - (a.peak ? a.peak.intensity / (a.peak.scaleMax || 10) : 0));
  }, [athletes, pains, today]);

  if (reports.length === 0) return null;
  const visible = showAll ? reports : reports.slice(0, VISIBLE);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-slate-800">Douleurs signalées</h2>
          <span className="text-xs text-slate-500">({PAIN_REPORT_DAYS} derniers jours)</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {visible.map(r => {
            const repeated = r.days.size >= 2;
            return (
              <li key={r.key} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button type="button" className="font-medium text-slate-800 hover:underline" onClick={() => onOpen(r.athlete.email)}>
                  {r.athlete.name}
                </button>
                <span className="text-sm text-red-700">{r.zone.fullLabel}</span>
                {r.peak && (
                  <span className="text-xs rounded-full bg-red-50 text-red-700 px-2 py-0.5">intensité {formatPainIntensity(r.peak)}</span>
                )}
                <span className="text-xs text-slate-500">{agoText(daysBetweenDays(r.lastDay, today))}</span>
                {repeated && (
                  <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">
                    {r.days.size} jours sur {PAIN_REPORT_DAYS}
                  </span>
                )}
                <span className="ml-auto">
                  {r.athlete.current ? (
                    <Button size="sm" variant="ghost" onClick={() => onOpen(r.athlete.email)}>Voir la fiche</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onCreate(r.athlete.email, r.peak || r.zone)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Créer une fiche
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {reports.length > VISIBLE && (
          <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Réduire' : `Voir tout (${reports.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

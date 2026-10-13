import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Période par athlète (« Paramètres avancés ») : chaque athlète utilise la
// période globale, sauf s'il a une période personnalisée, toujours ramenée à
// l'intérieur de la période globale.

const maxDate = (a, b) => (a > b ? a : b);
const minDate = (a, b) => (a < b ? a : b);

// Périodes réellement appliquées : { email: { start, end } }, uniquement pour
// les athlètes sélectionnés dont la période diffère de la période globale.
// start > end signifie qu'il ne reste aucun jour (aucune donnée affichée).
export function effectiveAthletePeriods(periods, athleteEmails, startDate, endDate) {
  const result = {};
  athleteEmails.forEach(email => {
    const p = periods[email];
    if (!p) return;
    const start = maxDate(p.start || startDate, startDate);
    const end = minDate(p.end || endDate, endDate);
    if (start === startDate && end === endDate) return;
    result[email] = { start, end };
  });
  return result;
}

export const isInAthletePeriod = (effective, log) => {
  const p = effective[log.athlete_email];
  return !p || (log.training_date >= p.start && log.training_date <= p.end);
};

// Ligne d'infobulle : nombre d'athlètes dont la période couvre ce jour
export function PeriodCoverageLine({ coverage }) {
  if (!coverage || coverage.count === coverage.total) return null;
  return (
    <p className="mt-1 text-xs text-indigo-700">
      Médiane sur {coverage.count}/{coverage.total} athlètes (périodes personnalisées)
    </p>
  );
}

const shortDate =(d) => format(parseISO(d), 'd MMM', { locale: fr });

export default function AthletePeriodsPanel({ athletes, periods, onChange, startDate, endDate }) {
  const effective = effectiveAthletePeriods(periods, athletes.map(a => a.email), startDate, endDate);

  const setPeriod = (email, start, end) => {
    const next = { ...periods };
    if (start === startDate && end === endDate) delete next[email];
    else next[email] = { start, end };
    onChange(next);
  };

  // N derniers jours de la période globale
  const lastDays = (email, n) => setPeriod(email, maxDate(format(subDays(parseISO(endDate), n - 1), 'yyyy-MM-dd'), startDate), endDate);

  const resetAll = () => {
    const next = { ...periods };
    athletes.forEach(a => { delete next[a.email]; });
    onChange(next);
  };

  if (athletes.length === 0) {
    return <p className="text-sm text-slate-500">Sélectionnez des athlètes pour leur donner une période personnalisée.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Par défaut, chaque athlète utilise la période globale (du {shortDate(startDate)} au {shortDate(endDate)}).
        Une période personnalisée reste comprise dans la période globale.
      </p>
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
        {[...athletes].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(athlete => {
          const p = effective[athlete.email];
          const start = p?.start ?? startDate;
          const end = p?.end ?? endDate;
          const empty = p && p.start > p.end;
          return (
            <div key={athlete.email} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 ${p ? 'bg-indigo-50/60' : ''}`}>
              <div className="min-w-[10rem] flex-1">
                <p className="text-sm font-medium text-slate-800">{athlete.name}</p>
                <p className={`text-xs ${empty ? 'text-red-600' : p ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {empty ? 'Aucun jour dans la période globale' : p ? 'Période personnalisée' : 'Période globale'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  aria-label={`Début de période de ${athlete.name}`}
                  value={start}
                  min={startDate}
                  max={endDate}
                  onChange={(e) => e.target.value && setPeriod(athlete.email, e.target.value, end)}
                  className="h-8 w-36 text-sm"
                />
                <span className="text-sm text-slate-400">→</span>
                <Input
                  type="date"
                  aria-label={`Fin de période de ${athlete.name}`}
                  value={end}
                  min={startDate}
                  max={endDate}
                  onChange={(e) => e.target.value && setPeriod(athlete.email, start, e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => lastDays(athlete.email, 7)}>7 derniers j.</Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => lastDays(athlete.email, 14)}>14 derniers j.</Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" disabled={!p} onClick={() => setPeriod(athlete.email, startDate, endDate)}>
                  Période globale
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(effective).length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500" onClick={resetAll}>
            Remettre tous les athlètes sur la période globale
          </Button>
        </div>
      )}
    </div>
  );
}

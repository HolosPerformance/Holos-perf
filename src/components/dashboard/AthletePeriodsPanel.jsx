import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from 'lucide-react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Période par athlète (« Paramètres avancés ») : chaque athlète utilise la
// période globale, sauf s'il a une ou plusieurs plages personnalisées,
// toujours ramenées à l'intérieur de la période globale. Une saisie est
// retenue si sa date tombe dans au moins une des plages.

const maxDate = (a, b) => (a > b ? a : b);
const minDate = (a, b) => (a < b ? a : b);
const toISO = (d) => format(d, 'yyyy-MM-dd');

// Plages enregistrées d'un athlète, sous forme de liste (les anciens réglages
// stockaient une seule plage { start, end })
const storedRanges = (periods, email) => {
  const p = periods[email];
  if (!p) return [];
  return Array.isArray(p) ? p : [p];
};

const clampRange = (r, startDate, endDate) => ({
  start: maxDate(r.start || startDate, startDate),
  end: minDate(r.end || endDate, endDate),
});

// Plages réellement appliquées : { email: [{ start, end }, …] }, triées par
// début, uniquement pour les athlètes sélectionnés dont les plages diffèrent
// de la période globale. Une liste vide signifie qu'il ne reste aucun jour
// (aucune donnée affichée).
export function effectiveAthletePeriods(periods, athleteEmails, startDate, endDate) {
  const result = {};
  athleteEmails.forEach(email => {
    const stored = storedRanges(periods, email);
    if (stored.length === 0) return;
    const ranges = stored
      .map(r => clampRange(r, startDate, endDate))
      .filter(r => r.start <= r.end)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (ranges.some(r => r.start === startDate && r.end === endDate)) return;
    result[email] = ranges;
  });
  return result;
}

export const isInAthletePeriod = (effective, log) => {
  const ranges = effective[log.athlete_email];
  return !ranges || ranges.some(r => log.training_date >= r.start && log.training_date <= r.end);
};

// Début de la première plage de l'athlète (période globale par défaut)
export const athletePeriodStart = (effective, email, startDate) =>
  effective[email]?.[0]?.start ?? startDate;

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

  const setRanges = (email, ranges) => {
    const next = { ...periods };
    // Une seule plage égale à la période globale = pas de personnalisation ;
    // plusieurs plages sont conservées pour pouvoir les ajuster une à une
    const isGlobal = ranges.length === 1 && ranges[0].start === startDate && ranges[0].end === endDate;
    if (ranges.length === 0 || isGlobal) delete next[email];
    else next[email] = ranges;
    onChange(next);
  };

  // Plages affichées (ramenées dans la période globale, dans l'ordre de saisie)
  const displayedRanges = (email) => {
    const stored = storedRanges(periods, email);
    return stored.length > 0
      ? stored.map(r => clampRange(r, startDate, endDate))
      : [{ start: startDate, end: endDate }];
  };

  const updateRange = (email, index, range) =>
    setRanges(email, displayedRanges(email).map((r, i) => (i === index ? range : r)));

  // Nouvelle plage : du lendemain de la dernière plage à la fin de la période globale
  const addRange = (email) => {
    const ranges = displayedRanges(email);
    const last = ranges[ranges.length - 1];
    const start = minDate(maxDate(toISO(addDays(parseISO(last.end), 1)), startDate), endDate);
    setRanges(email, [...ranges, { start, end: endDate }]);
  };

  const removeRange = (email, index) =>
    setRanges(email, displayedRanges(email).filter((_, i) => i !== index));

  // N derniers jours de la période globale (remplace toutes les plages)
  const lastDays = (email, n) =>
    setRanges(email, [{ start: maxDate(toISO(subDays(parseISO(endDate), n - 1)), startDate), end: endDate }]);

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
        Les plages personnalisées restent comprises dans la période globale ; le bouton + en ajoute une.
      </p>
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
        {[...athletes].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(athlete => {
          const p = effective[athlete.email];
          const empty = p && p.length === 0;
          const ranges = displayedRanges(athlete.email);
          const label = empty
            ? 'Aucun jour dans la période globale'
            : p
              ? (p.length > 1 ? `${p.length} plages personnalisées` : 'Période personnalisée')
              : 'Période globale';
          return (
            <div key={athlete.email} className={`flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2 ${p ? 'bg-indigo-50/60' : ''}`}>
              <div className="min-w-[10rem] flex-1 pt-1">
                <p className="text-sm font-medium text-slate-800">{athlete.name}</p>
                <p className={`text-xs ${empty ? 'text-red-600' : p ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {label}
                </p>
              </div>
              <div className="space-y-1.5">
                {ranges.map((range, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      aria-label={`Début de la plage ${index + 1} de ${athlete.name}`}
                      value={range.start}
                      min={startDate}
                      max={endDate}
                      onChange={(e) => e.target.value && updateRange(athlete.email, index, { start: e.target.value, end: range.end })}
                      className="h-8 w-36 text-sm"
                    />
                    <span className="text-sm text-slate-400">→</span>
                    <Input
                      type="date"
                      aria-label={`Fin de la plage ${index + 1} de ${athlete.name}`}
                      value={range.end}
                      min={startDate}
                      max={endDate}
                      onChange={(e) => e.target.value && updateRange(athlete.email, index, { start: range.start, end: e.target.value })}
                      className="h-8 w-36 text-sm"
                    />
                    {index === 0 ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        title="Ajouter une plage"
                        aria-label={`Ajouter une plage pour ${athlete.name}`}
                        onClick={() => addRange(athlete.email)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500"
                        title="Supprimer cette plage"
                        aria-label={`Supprimer la plage ${index + 1} de ${athlete.name}`}
                        onClick={() => removeRange(athlete.email, index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 pt-0.5">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => lastDays(athlete.email, 7)}>7 derniers j.</Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => lastDays(athlete.email, 14)}>14 derniers j.</Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" disabled={storedRanges(periods, athlete.email).length === 0} onClick={() => setRanges(athlete.email, [])}>
                  Période globale
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {athletes.some(a => storedRanges(periods, a.email).length > 0) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500" onClick={resetAll}>
            Remettre tous les athlètes sur la période globale
          </Button>
        </div>
      )}
    </div>
  );
}

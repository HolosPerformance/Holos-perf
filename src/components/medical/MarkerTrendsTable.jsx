import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { LEVELS, TREND_SETTINGS, formatScore, formatValue } from '@/lib/markerTrends';

// Couleurs neutres : bleu pour les baisses, orange pour les hausses
const LEVEL_STYLES = {
  '-2': 'bg-blue-200 text-blue-900',
  '-1': 'bg-blue-50 text-blue-700',
  '0': 'text-slate-400',
  '1': 'bg-orange-50 text-orange-700',
  '2': 'bg-orange-200 text-orange-900',
};
const DRIFT_ICON = { 1: '⤴', [-1]: '⤵' };

function driftText(drift) {
  if (!drift) return null;
  return `${drift.dir > 0 ? 'Hausse' : 'Baisse'} continue depuis ${drift.days} jour${drift.days > 1 ? 's' : ''}`;
}

function TrendCell({ result, onOpen }) {
  if (!result) return <td className="px-2 py-2 text-center text-slate-200">—</td>;
  if (result.status === 'learning') {
    return (
      <td className="px-2 py-2 text-center text-[11px] text-slate-400 italic"
        title={`En apprentissage : ${result.baselineCount} saisie(s) sur les ${TREND_SETTINGS.baselineDays} jours de référence (${TREND_SETTINGS.minBaseline} nécessaires)`}>
        appr.
      </td>
    );
  }
  const sparse = result.status === 'sparse';
  const level = sparse ? 0 : result.level;
  const drift = sparse ? null : result.drift;
  return (
    <td className="px-1 py-1 text-center">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button"
            className={`w-full min-w-[68px] rounded-md px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition hover:ring-2 hover:ring-slate-300 ${sparse ? 'text-slate-300' : LEVEL_STYLES[level]}`}>
            {sparse ? '·' : (
              <>
                {LEVELS[level].arrow}{level !== 0 && ` ${formatScore(result.z)}`}
                {drift && <span className="ml-1" aria-label={driftText(drift)}>{DRIFT_ICON[drift.dir]}</span>}
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-sm space-y-1.5">
          {sparse ? (
            <p className="text-slate-600">
              Peu de saisies récentes : {result.recentCount} sur les {TREND_SETTINGS.recentDays} derniers jours
              ({TREND_SETTINGS.minRecent} nécessaires).
            </p>
          ) : (
            <>
              <p className="font-semibold text-slate-800">{LEVELS[level].label}</p>
              <p className="text-slate-600">Niveau actuel : <b>{formatValue(result.short)}</b></p>
              <p className="text-slate-600">Habituel : <b>{formatValue(result.reference)}</b> (± {formatValue(result.sd)})</p>
              <p className="text-slate-600">Écart : <b>{formatScore(result.z)}</b> écart habituel</p>
              {drift && <p className="text-slate-700 font-medium">{DRIFT_ICON[drift.dir]} {driftText(drift)}</p>}
            </>
          )}
          <Button size="sm" variant="outline" className="w-full mt-2" onClick={onOpen}>Voir la fiche</Button>
        </PopoverContent>
      </Popover>
    </td>
  );
}

/**
 * Tableau « Suivi des marqueurs » : athlètes en lignes, marqueurs en colonnes,
 * variation de chacun par rapport à sa propre référence.
 * `trends` : { [email]: { byMarker, alerts } } (voir athleteTrends).
 */
export default function MarkerTrendsTable({ athletes, markers, trends, loading, onOpen }) {
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // Seulement les marqueurs renseignés pour au moins un athlète affiché
  const columns = markers.filter(m => athletes.some(a => trends[a.email]?.byMarker[m.key]));
  const rows = onlyAlerts ? athletes.filter(a => trends[a.email]?.alerts > 0) : athletes;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {TREND_SETTINGS.monitorDays} derniers jours comparés aux {TREND_SETTINGS.baselineDays} jours précédents de chaque athlète.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={onlyAlerts} onChange={e => setOnlyAlerts(e.target.checked)} />
          Seulement les athlètes à surveiller
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400">Chargement des questionnaires…</p>
        ) : columns.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Aucune réponse chiffrée aux questionnaires sur la période.</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Aucun athlète à surveiller.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 z-10 min-w-[140px]">Athlète</th>
                  {columns.map(m => (
                    <th key={m.key} className="px-2 py-2 font-medium text-center max-w-[110px]" title={m.label}>
                      <span className="block truncate">{m.label}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center" title="Variations fortes ou dérives"><AlertTriangle className="w-4 h-4 inline" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(a => {
                  const t = trends[a.email];
                  return (
                    <tr key={a.email}>
                      <td className="px-3 py-2 sticky left-0 bg-white z-10 font-medium text-slate-800 whitespace-nowrap">
                        <button type="button" className="hover:underline text-left" onClick={() => onOpen(a.email)}>{a.name}</button>
                      </td>
                      {columns.map(m => (
                        <TrendCell key={m.key} result={t?.byMarker[m.key]} onOpen={() => onOpen(a.email, m.key)} />
                      ))}
                      <td className="px-2 py-2 text-center">
                        {t?.alerts > 0 && <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs"><AlertTriangle className="w-3.5 h-3.5" />{t.alerts}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span><b className="text-blue-800">⇊</b> forte baisse</span>
        <span><b className="text-blue-600">↓</b> baisse</span>
        <span><b>=</b> stable</span>
        <span><b className="text-orange-600">↑</b> hausse</span>
        <span><b className="text-orange-800">⇈</b> forte hausse</span>
        <span>⤵ ⤴ dérive continue</span>
        <span>· peu de saisies récentes</span>
        <span>appr. : en apprentissage</span>
        <span>Chiffre : écart en nombre d'« écarts habituels » de l'athlète.</span>
      </div>
      <p className="text-xs text-slate-400">
        Aide au suivi, pas un diagnostic : une variation signale un changement à vérifier avec l'athlète.
      </p>
    </div>
  );
}

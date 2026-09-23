import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyzeEfa } from '@/lib/psychometrics';
import {
  Panel, IndicatorToggleList, AnalysisWarnings, SwitchField, SelectField, StatPill,
  countValues, fmt, signedColor,
} from './AnalysisParts';

export const FACTOR_PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777'];

export default function EfaPanel({ logs, metricLabels, settings, onChange }) {
  const available = useMemo(() => {
    const counts = countValues(logs, Object.keys(metricLabels));
    return Object.keys(metricLabels).filter(k => counts[k] > 0);
  }, [logs, metricLabels]);
  const counts = useMemo(() => countValues(logs, available), [logs, available]);
  const included = available.filter(k => !settings.excluded.includes(k));

  const result = useMemo(
    () => analyzeEfa(logs, included, metricLabels, settings),
    [logs, included.join('|'), metricLabels, settings.nFactorsMode, settings.nFactors, settings.rotation, settings.loadingThreshold, settings.centerByAthlete]
  );

  const p = result.data?.keys.length || included.length;
  const maxFactors = Math.max(1, p - 1);
  const labelOf = (i) => metricLabels[result.data.keys[i]];

  return (
    <div className="space-y-4">
      <Panel title="Réglages de l'AFE" description="Indépendants des indicateurs affichés dans le reste du dashboard. Les filtres généraux (période, athlètes, types de séance) s'appliquent.">
        <div className="space-y-4">
          <IndicatorToggleList
            available={available}
            labels={metricLabels}
            counts={counts}
            excluded={settings.excluded}
            onChange={(excluded) => onChange({ excluded })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <SelectField
              label="Nombre de facteurs"
              value={settings.nFactorsMode === 'auto' ? 'auto' : String(settings.nFactors)}
              onChange={(v) => onChange(v === 'auto' ? { nFactorsMode: 'auto' } : { nFactorsMode: 'manual', nFactors: Number(v) })}
              options={[
                { value: 'auto', label: `Automatique (analyse parallèle${result.parallel ? ` : ${result.parallel.nFactors}` : ''})` },
                ...Array.from({ length: maxFactors }, (_, i) => ({ value: String(i + 1), label: `${i + 1} facteur${i ? 's' : ''}` })),
              ]}
            />
            <SelectField
              label="Rotation"
              value={settings.rotation}
              onChange={(rotation) => onChange({ rotation })}
              options={[
                { value: 'oblimin', label: 'Oblimin (facteurs corrélés)' },
                { value: 'varimax', label: 'Varimax (facteurs indépendants)' },
              ]}
            />
            <SelectField
              label="Seuil des saturations"
              value={String(settings.loadingThreshold)}
              onChange={(v) => onChange({ loadingThreshold: Number(v) })}
              options={[0.2, 0.3, 0.4, 0.5].map(v => ({ value: String(v), label: fmt(v) }))}
            />
            <SwitchField
              id="efa-center"
              label="Centrer par athlète"
              hint="Analyse les variations de chacun"
              checked={settings.centerByAthlete}
              onChange={(centerByAthlete) => onChange({ centerByAthlete })}
            />
          </div>
        </div>
      </Panel>

      <AnalysisWarnings warnings={result.warnings} />

      {result.efa && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatPill label="Saisies complètes" value={result.data.n} tone={result.data.n >= 100 ? 'good' : 'bad'} />
            <StatPill label="Athlètes" value={result.data.nAthletes} />
            <StatPill label="KMO" value={result.kmo ? fmt(result.kmo.overall) : '—'} tone={result.kmo && result.kmo.overall >= 0.6 ? 'good' : 'bad'} />
            <StatPill
              label="Bartlett"
              value={result.bartlett ? (result.bartlett.pValue < 0.001 ? 'p < 0,001' : `p = ${fmt(result.bartlett.pValue, 3)}`) : '—'}
              tone={result.bartlett && result.bartlett.pValue < 0.05 ? 'good' : 'bad'}
            />
            <StatPill label="Variance expliquée" value={`${Math.round(result.efa.totalVarianceExplained * 100)} %`} />
          </div>

          <Panel
            title="Saturations factorielles"
            description={`Chaque case indique à quel point l'indicateur « appartient » au facteur (de −1 à 1). En gras : saturation ≥ ${fmt(settings.loadingThreshold)}. h² = part de l'indicateur expliquée par les facteurs.`}
          >
            <LoadingsTable result={result} labelOf={labelOf} threshold={settings.loadingThreshold} />
          </Panel>

          {settings.rotation === 'oblimin' && result.efa.nFactors > 1 && (
            <Panel title="Corrélations entre facteurs" description="Avec une rotation oblique, les facteurs peuvent être liés entre eux.">
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th />
                      {result.efa.phi.map((_, j) => <th key={j} className="px-3 py-1 font-semibold" style={{ color: FACTOR_PALETTE[j % FACTOR_PALETTE.length] }}>F{j + 1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.efa.phi.map((row, i) => (
                      <tr key={i}>
                        <td className="pr-3 py-1 font-semibold" style={{ color: FACTOR_PALETTE[i % FACTOR_PALETTE.length] }}>F{i + 1}</td>
                        {row.map((v, j) => <td key={j} className="px-3 py-1 text-center tabular-nums">{fmt(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Matrice de corrélations" description="Lien entre chaque paire d'indicateurs : bleu = varient dans le même sens, rouge = en sens inverse.">
              <CorrelationHeatmap R={result.R} labels={result.data.keys.map(k => metricLabels[k])} />
            </Panel>
            <Panel title="Choix du nombre de facteurs" description="On garde les facteurs dont la valeur propre (bleu) dépasse celle obtenue sur des données aléatoires (gris).">
              <ScreePlot parallel={result.parallel} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function LoadingsTable({ result, labelOf, threshold }) {
  const { efa } = result;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 pr-3 font-semibold text-slate-600">Indicateur</th>
            {efa.factors.map(f => (
              <th key={f.index} className="px-2 py-2 text-center font-semibold" style={{ color: FACTOR_PALETTE[f.index % FACTOR_PALETTE.length] }}>
                F{f.index + 1}
              </th>
            ))}
            <th className="px-2 py-2 text-center font-semibold text-slate-600">h²</th>
          </tr>
        </thead>
        <tbody>
          {efa.loadings.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1.5 pr-3 text-slate-700 whitespace-nowrap">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                  style={{ backgroundColor: efa.assignment[i] !== null ? FACTOR_PALETTE[efa.assignment[i] % FACTOR_PALETTE.length] : '#cbd5e1' }}
                />
                {labelOf(i)}
              </td>
              {row.map((v, j) => {
                const strong = Math.abs(v) >= threshold;
                return (
                  <td
                    key={j}
                    className={`px-2 py-1.5 text-center tabular-nums ${strong ? 'font-bold' : 'text-slate-400'}`}
                    style={strong ? { backgroundColor: signedColor(v, 1.6) } : undefined}
                  >
                    {fmt(v)}
                  </td>
                );
              })}
              <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">{fmt(efa.communalities[i])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200">
            <td className="py-1.5 pr-3 text-slate-600 font-medium">Variance expliquée</td>
            {efa.factors.map(f => <td key={f.index} className="px-2 py-1.5 text-center tabular-nums text-slate-600">{Math.round(f.proportion * 100)} %</td>)}
            <td />
          </tr>
          <tr>
            <td className="py-1.5 pr-3 text-slate-600 font-medium" title="Cohérence interne des indicateurs rattachés au facteur (standardisé, items négatifs inversés)">Alpha de Cronbach</td>
            {efa.factors.map(f => (
              <td key={f.index} className={`px-2 py-1.5 text-center tabular-nums ${f.alpha !== null && f.alpha < 0.7 ? 'text-amber-700' : 'text-slate-600'}`}>
                {f.alpha === null ? '—' : fmt(f.alpha)}
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
      <p className="text-[11px] text-slate-500 mt-2">
        La pastille de couleur indique le facteur de rattachement de chaque indicateur (gris : aucun). Alpha ≥ 0,70 : cohérence interne acceptable.
      </p>
    </div>
  );
}

function CorrelationHeatmap({ R, labels }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {labels.map((l, j) => <th key={j} className="px-1 font-semibold text-slate-500" title={l}>{j + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {R.map((row, i) => (
            <tr key={i}>
              <td className="pr-2 text-slate-600 whitespace-nowrap max-w-[160px] truncate" title={labels[i]}>
                <span className="text-slate-400 mr-1">{i + 1}.</span>{labels[i]}
              </td>
              {row.map((v, j) => (
                <td
                  key={j}
                  title={`${labels[i]} × ${labels[j]} : ${fmt(v)}`}
                  className="w-9 h-7 text-center tabular-nums rounded-sm"
                  style={{
                    backgroundColor: i === j ? '#f1f5f9' : signedColor(v),
                    color: i === j ? '#94a3b8' : Math.abs(v) > 0.5 ? 'white' : '#334155',
                  }}
                >
                  {i === j ? '—' : fmt(v).replace('0,', ',')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScreePlot({ parallel }) {
  const data = parallel.observed.map((v, i) => ({
    name: i + 1,
    observed: Number(v.toFixed(3)),
    random: Number(parallel.threshold[i].toFixed(3)),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} label={{ value: 'Facteur', position: 'insideBottomRight', offset: -2, fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Facteur ${l}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="observed" name="Données" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="random" name="Aléatoire (95e centile)" stroke="#94a3b8" strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

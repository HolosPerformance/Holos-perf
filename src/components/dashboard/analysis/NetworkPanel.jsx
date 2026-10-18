import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Wand2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ColorPicker from '@/components/ui/ColorPicker';
import { analyzeNetwork, analyzeEfa, forceLayout } from '@/lib/psychometrics';
import NetworkGraph from './NetworkGraph';
import { FACTOR_PALETTE } from './EfaPanel';
import {
  Panel, IndicatorToggleList, AnalysisWarnings, SwitchField, SelectField, StatPill,
  countValues, fmt,
} from './AnalysisParts';

const CENTRALITY_OPTIONS = [
  { value: 'strength', label: 'Force (somme des liens)' },
  { value: 'expectedInfluence', label: 'Influence attendue (liens signés)' },
  { value: 'closeness', label: 'Proximité' },
  { value: 'betweenness', label: 'Intermédiarité' },
];

const SIDE_COLORS = { A: '#0f766e', B: '#c2410c' };
const UNGROUPED_COLOR = '#94a3b8';

// Deux estimations comparables doivent porter sur les mêmes indicateurs :
// si un indicateur est constant d'un côté, il est retiré des deux.
function analyzePair(logsA, logsB, keys, labels, settings) {
  let a = analyzeNetwork(logsA, keys, labels, settings);
  if (!logsB) return { a, b: null };
  let b = analyzeNetwork(logsB, keys, labels, settings);
  if (a.data && b.data) {
    const common = a.data.keys.filter(k => b.data.keys.includes(k));
    if (common.length !== a.data.keys.length || common.length !== b.data.keys.length) {
      a = analyzeNetwork(logsA, common, labels, settings);
      b = analyzeNetwork(logsB, common, labels, settings);
    }
  }
  return { a, b };
}

const filterSide = (logs, side) => logs.filter(l =>
  l.training_date >= side.startDate && l.training_date <= side.endDate && side.sessionTypes.includes(l.session_type));

export default function NetworkPanel({
  periodLogs, athleteLogs, metricLabels, metricColors, sessionTypeLabels, globalFilters,
  settings, onChange, efaSettings,
}) {
  const [compare, setCompare] = useState(false);
  const [sideA, setSideA] = useState(globalFilters);
  const [sideB, setSideB] = useState(globalFilters);
  const [dragged, setDragged] = useState({});
  const [efaMessage, setEfaMessage] = useState(null);

  const toggleCompare = (on) => {
    if (on && !compare) { setSideA(globalFilters); setSideB(globalFilters); }
    setCompare(on);
  };

  const logsA = useMemo(() => (compare ? filterSide(athleteLogs, sideA) : periodLogs), [compare, athleteLogs, sideA, periodLogs]);
  const logsB = useMemo(() => (compare ? filterSide(athleteLogs, sideB) : null), [compare, athleteLogs, sideB]);

  const allKeys = Object.keys(metricLabels);
  const countsA = useMemo(() => countValues(logsA, allKeys), [logsA, metricLabels]);
  const countsB = useMemo(() => (logsB ? countValues(logsB, allKeys) : null), [logsB, metricLabels]);
  const available = allKeys.filter(k => countsA[k] > 0 && (!countsB || countsB[k] > 0));
  const counts = Object.fromEntries(available.map(k => [k, countsA[k] + (countsB ? countsB[k] : 0)]));
  const included = available.filter(k => !settings.excluded.includes(k));

  const { a: resultA, b: resultB } = useMemo(
    () => analyzePair(logsA, logsB, included, metricLabels, settings),
    [logsA, logsB, included.join('|'), metricLabels, settings.gamma, settings.centerByAthlete]
  );

  const ready = resultA.network && (!compare || resultB?.network);
  const keys = ready ? resultA.data.keys : [];
  const keysSignature = keys.join('|');

  // Positions : disposition automatique, remplacée par les bulles déplacées à la main
  useEffect(() => { setDragged({}); }, [keysSignature]);
  const autoLayout = useMemo(() => {
    if (!ready) return [];
    const avg = resultA.network.weights.map((row, i) => row.map((w, j) =>
      (compare ? (Math.abs(w) + Math.abs(resultB.network.weights[i][j])) / 2 : Math.abs(w))));
    return forceLayout(avg);
  }, [ready, resultA, resultB, compare]);
  const positions = Object.fromEntries(keys.map((k, i) => [k, dragged[k] || autoLayout[i]]));
  const moveNode = (key, pt) => setDragged(prev => ({ ...prev, [key]: pt }));

  // Couleur des bulles : groupe de l'utilisateur, sinon couleur de l'indicateur
  const groupById = Object.fromEntries(settings.colorGroups.map(g => [g.id, g]));
  const nodeColors = Object.fromEntries(included.map(k => {
    const group = groupById[settings.assignments[k]];
    if (group) return [k, group.color];
    return [k, settings.colorGroups.length === 0 ? (metricColors[k] || '#64748b') : UNGROUPED_COLOR];
  }));

  const colorFromEfa = () => {
    const efaResult = analyzeEfa(periodLogs, included, metricLabels, efaSettings);
    if (!efaResult.efa) {
      setEfaMessage(`AFE impossible avec ces indicateurs : ${efaResult.warnings.find(w => w.level === 'block')?.text || 'données insuffisantes.'}`);
      return;
    }
    const groups = efaResult.efa.factors.map(f => ({
      id: `efa-${f.index + 1}`,
      name: `Facteur ${f.index + 1}`,
      color: FACTOR_PALETTE[f.index % FACTOR_PALETTE.length],
    }));
    const assignments = {};
    efaResult.efa.assignment.forEach((factor, i) => {
      if (factor !== null) assignments[efaResult.data.keys[i]] = `efa-${factor + 1}`;
    });
    onChange({ colorGroups: groups, assignments });
    setEfaMessage(`${groups.length} groupe(s) créé(s) d'après l'AFE (période et filtres généraux, réglages du menu AFE).`);
  };

  const maxWeight = ready
    ? Math.max(0.01, ...[resultA, resultB].filter(Boolean).flatMap(r => r.network.weights.flatMap(row => row.map(Math.abs))))
    : 1;
  const diffWeights = ready && compare
    ? resultB.network.weights.map((row, i) => row.map((w, j) => w - resultA.network.weights[i][j]))
    : null;

  return (
    <div className="space-y-4">
      <Panel title="Réglages de l'analyse réseau" description="Indépendants des indicateurs affichés dans le reste du dashboard. Les filtres généraux s'appliquent (en mode comparaison, les athlètes restent communs et chaque réseau a sa période et ses types de séance).">
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
              label="Sélection des liens (EBIC γ)"
              value={String(settings.gamma)}
              onChange={(v) => onChange({ gamma: Number(v) })}
              options={[
                { value: '0', label: 'Sensible (γ = 0)' },
                { value: '0.25', label: 'Intermédiaire (γ = 0,25)' },
                { value: '0.5', label: 'Prudente (γ = 0,5, standard)' },
              ]}
            />
            <SelectField
              label="Masquer les liens plus faibles que"
              value={String(settings.edgeThreshold)}
              onChange={(v) => onChange({ edgeThreshold: Number(v) })}
              options={[0, 0.05, 0.1, 0.15, 0.2, 0.3].map(v => ({ value: String(v), label: v === 0 ? 'Aucun seuil' : fmt(v) }))}
            />
            <SelectField
              label="Centralité affichée"
              value={settings.centrality}
              onChange={(centrality) => onChange({ centrality })}
              options={CENTRALITY_OPTIONS}
            />
            <SwitchField
              id="network-center"
              label="Centrer par athlète"
              hint="Analyse les variations de chacun"
              checked={settings.centerByAthlete}
              onChange={(centerByAthlete) => onChange({ centerByAthlete })}
            />
          </div>
          <ColorGroupsEditor
            keys={included}
            labels={metricLabels}
            groups={settings.colorGroups}
            assignments={settings.assignments}
            onChange={onChange}
            onColorFromEfa={colorFromEfa}
            efaMessage={efaMessage}
          />
          <div className="pt-3 border-t border-slate-100">
            <SwitchField
              id="network-compare"
              label="Comparer deux réseaux"
              hint="Ex. compétitions vs entraînements, ou une période vs une autre"
              checked={compare}
              onChange={toggleCompare}
            />
            {compare && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <SideFilterEditor name="A" value={sideA} onChange={setSideA} sessionTypeLabels={sessionTypeLabels} globalFilters={globalFilters} />
                <SideFilterEditor name="B" value={sideB} onChange={setSideB} sessionTypeLabels={sessionTypeLabels} globalFilters={globalFilters} />
              </div>
            )}
          </div>
        </div>
      </Panel>

      {compare ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnalysisWarnings title="Réseau A" warnings={resultA.warnings} />
          <AnalysisWarnings title="Réseau B" warnings={resultB?.warnings} />
        </div>
      ) : (
        <AnalysisWarnings warnings={resultA.warnings} />
      )}

      {ready && (
        <>
          {compare ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[['A', resultA], ['B', resultB]].map(([name, result]) => (
                <Panel key={name} title={<span style={{ color: SIDE_COLORS[name] }}>Réseau {name}</span>}>
                  <NetworkSummary result={result} edgeThreshold={settings.edgeThreshold} />
                  <NetworkGraph
                    keys={keys} labels={metricLabels} nodeColors={nodeColors}
                    weights={result.network.weights} positions={positions} onMoveNode={moveNode}
                    edgeThreshold={settings.edgeThreshold} maxWeight={maxWeight}
                  />
                </Panel>
              ))}
            </div>
          ) : (
            <Panel
              title="Réseau des indicateurs"
              description="Chaque lien est une corrélation partielle : le lien entre deux indicateurs une fois l'effet de tous les autres retiré. Bleu = même sens, rouge = sens inverse, épaisseur = force. Les bulles se déplacent à la souris."
            >
              <NetworkSummary result={resultA} edgeThreshold={settings.edgeThreshold} />
              <NetworkGraph
                keys={keys} labels={metricLabels} nodeColors={nodeColors}
                weights={resultA.network.weights} positions={positions} onMoveNode={moveNode}
                edgeThreshold={settings.edgeThreshold} maxWeight={maxWeight}
              />
            </Panel>
          )}

          <GraphLegend
            groups={settings.colorGroups}
            hasUngrouped={settings.colorGroups.length > 0 && included.some(k => !groupById[settings.assignments[k]])}
            onResetLayout={Object.keys(dragged).length > 0 ? () => setDragged({}) : null}
          />

          {compare && (
            <>
              <Panel
                title="Différences entre les réseaux (B − A)"
                description="Bleu : lien plus positif dans B que dans A. Rouge : lien plus négatif (ou moins positif) dans B. Épaisseur = ampleur de la différence."
              >
                <NetworkGraph
                  keys={keys} labels={metricLabels} nodeColors={nodeColors}
                  weights={diffWeights} positions={positions} onMoveNode={moveNode}
                  edgeThreshold={settings.edgeThreshold} maxWeight={maxWeight}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  <StatPill label="Connectivité A" value={fmt(resultA.globalStrength)} />
                  <StatPill label="Connectivité B" value={fmt(resultB.globalStrength)} />
                  <StatPill label="Différence (B − A)" value={fmt(resultB.globalStrength - resultA.globalStrength)} />
                  <StatPill label="Liens A / B" value={`${resultA.network.nEdges} / ${resultB.network.nEdges}`} />
                </div>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
                  Aucun test statistique n'est appliqué à ces différences : une partie peut venir du hasard, surtout avec peu de saisies.
                  Ne retenez que les écarts nets et cohérents avec ce que vous observez sur le terrain.
                </p>
              </Panel>
            </>
          )}

          <Panel
            title={`Centralité : ${CENTRALITY_OPTIONS.find(o => o.value === settings.centrality)?.label}`}
            description="Indique les indicateurs les plus connectés au reste du réseau."
          >
            <CentralityChart
              keys={keys} labels={metricLabels} measure={settings.centrality}
              resultA={resultA} resultB={compare ? resultB : null}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

function NetworkSummary({ result, edgeThreshold }) {
  const visible = result.network.weights.reduce((s, row, i) =>
    s + row.filter((w, j) => j > i && w !== 0 && Math.abs(w) >= edgeThreshold).length, 0);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
      <span><strong className="text-slate-700">{result.data.n}</strong> saisies complètes</span>
      <span><strong className="text-slate-700">{result.data.nAthletes}</strong> athlète(s)</span>
      <span><strong className="text-slate-700">{visible}</strong> lien(s) affiché(s) sur {result.network.nEdges}</span>
      <span>Connectivité : <strong className="text-slate-700">{fmt(result.globalStrength)}</strong></span>
    </div>
  );
}

function GraphLegend({ groups, hasUngrouped, onResetLayout }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 px-1">
      <span className="flex items-center gap-1.5"><span className="w-5 h-1 rounded bg-blue-600" /> lien positif</span>
      <span className="flex items-center gap-1.5"><span className="w-5 h-1 rounded bg-red-600" /> lien négatif</span>
      {groups.map(g => (
        <span key={g.id} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} /> {g.name}
        </span>
      ))}
      {hasUngrouped && (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: UNGROUPED_COLOR }} /> sans groupe
        </span>
      )}
      {onResetLayout && (
        <button type="button" onClick={onResetLayout} className="ml-auto flex items-center gap-1 text-blue-600 hover:underline">
          <RotateCcw className="w-3 h-3" /> Réorganiser les bulles
        </button>
      )}
    </div>
  );
}

function ColorGroupsEditor({ keys, labels, groups, assignments, onChange, onColorFromEfa, efaMessage }) {
  const addGroup = () => {
    const idx = groups.length;
    onChange({
      colorGroups: [...groups, {
        id: `g-${Date.now().toString(36)}`,
        name: `Groupe ${idx + 1}`,
        color: FACTOR_PALETTE[idx % FACTOR_PALETTE.length],
      }],
    });
  };
  const updateGroup = (id, patch) => onChange({ colorGroups: groups.map(g => (g.id === id ? { ...g, ...patch } : g)) });
  const removeGroup = (id) => onChange({
    colorGroups: groups.filter(g => g.id !== id),
    assignments: Object.fromEntries(Object.entries(assignments).filter(([, gid]) => gid !== id)),
  });
  const assign = (key, groupId) => {
    const next = { ...assignments };
    if (groupId) next[key] = groupId; else delete next[key];
    onChange({ assignments: next });
  };

  return (
    <div className="rounded-md border border-slate-200 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-slate-700">Couleurs des bulles</p>
          <p className="text-xs text-slate-500">Créez des groupes (ex. « Physique » en rouge) et rangez-y les indicateurs.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onColorFromEfa} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700">
            <Wand2 className="w-3.5 h-3.5" /> Colorer selon l'AFE
          </button>
          <button type="button" onClick={addGroup} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-700">
            <Plus className="w-3.5 h-3.5" /> Nouveau groupe
          </button>
        </div>
      </div>
      {efaMessage && <p className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1.5">{efaMessage}</p>}

      {groups.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 pl-1.5 pr-1 py-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="w-5 h-5 rounded-full ring-2 ring-white shadow" style={{ backgroundColor: g.color }} title="Changer la couleur" />
                  </PopoverTrigger>
                  <PopoverContent className="p-3 w-auto">
                    <ColorPicker value={g.color} onChange={(color) => updateGroup(g.id, { color })} />
                  </PopoverContent>
                </Popover>
                <Input
                  value={g.name}
                  onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                  className="h-7 w-32 text-xs"
                />
                <button type="button" onClick={() => removeGroup(g.id)} className="p-1 text-slate-400 hover:text-red-600" title="Supprimer le groupe">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
            {keys.map(key => {
              const group = groups.find(g => g.id === assignments[key]);
              return (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group?.color || UNGROUPED_COLOR }} />
                  <span className="flex-1 truncate text-slate-700" title={labels[key]}>{labels[key]}</span>
                  <select
                    value={group ? group.id : ''}
                    onChange={(e) => assign(key, e.target.value)}
                    className="h-7 rounded border border-slate-200 bg-white px-1 text-xs text-slate-700 max-w-[130px]"
                  >
                    <option value="">Sans groupe</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SideFilterEditor({ name, value, onChange, sessionTypeLabels, globalFilters }) {
  const toggleType = (type) => onChange({
    ...value,
    sessionTypes: value.sessionTypes.includes(type) ? value.sessionTypes.filter(t => t !== type) : [...value.sessionTypes, type],
  });
  return (
    <div className="rounded-md border-2 p-3 space-y-2" style={{ borderColor: `${SIDE_COLORS[name]}55` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: SIDE_COLORS[name] }}>Réseau {name}</span>
        <button type="button" onClick={() => onChange(globalFilters)} className="text-xs text-blue-600 hover:underline">
          Reprendre les filtres généraux
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600">Du</span>
        <Input type="date" value={value.startDate} onChange={(e) => onChange({ ...value, startDate: e.target.value })} className="h-8 w-36 text-xs" />
        <span className="text-xs text-slate-600">au</span>
        <Input type="date" value={value.endDate} onChange={(e) => onChange({ ...value, endDate: e.target.value })} className="h-8 w-36 text-xs" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {Object.entries(sessionTypeLabels).map(([type, label]) => (
          <label key={type} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <Checkbox checked={value.sessionTypes.includes(type)} onCheckedChange={() => toggleType(type)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function CentralityChart({ keys, labels, measure, resultA, resultB }) {
  const data = keys.map((key, i) => ({
    name: `${i + 1}. ${labels[key].length > 22 ? `${labels[key].slice(0, 21)}…` : labels[key]}`,
    A: Number(resultA.centralities[measure][i].toFixed(3)),
    ...(resultB ? { B: Number(resultB.centralities[measure][i].toFixed(3)) } : {}),
  }));
  if (!resultB) data.sort((a, b) => b.A - a.A);
  const height = Math.max(160, keys.length * (resultB ? 34 : 26) + 50);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => fmt(v, 3)} />
        {resultB && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Bar dataKey="A" name={resultB ? 'Réseau A' : 'Centralité'} fill={resultB ? SIDE_COLORS.A : '#475569'} radius={[0, 3, 3, 0]} />
        {resultB && <Bar dataKey="B" name="Réseau B" fill={SIDE_COLORS.B} radius={[0, 3, 3, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

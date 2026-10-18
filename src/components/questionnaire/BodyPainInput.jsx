import React, { useId, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { PAIN_SCALE_DEFAULT, painScaleMiddle, isPainZoneOn, painZoneInfo } from '@/lib/painZones';
import { BODY_ART } from './bodyArt';

const SIDE_KEY = { gauche: 'painLeft', droit: 'painRight' };
const FLIP_MS = 160;
const SKIN = '#fbeee4';
const INK = '#6b4433';
const SEX_STORAGE_KEY = 'painBodySex';

// Identifiants des zones dessinées dans chaque vue (silhouette homme et femme confondues)
const VIEW_ZONE_IDS = Object.fromEntries(['front', 'back'].map(view => [view, new Set(
  Object.values(BODY_ART).flatMap(art => [...art[view].zones.map(z => z.id), ...art[view].joints.map(j => j.id)])
)]));
const viewsOf = (id) => ['front', 'back'].filter(v => VIEW_ZONE_IDS[v].has(id));

// Couleur selon la position sur l'échelle : vert (bas) → orange → rouge (haut)
const HUE_STOPS = [[1, 120], [3, 90], [5, 38], [7, 18], [10, 0]];
const MAX_BUTTONS = 11; // au-delà (ex. 0-100), un curseur remplace les boutons
function intensityColor(v, scale = PAIN_SCALE_DEFAULT, alpha = 1) {
  const ratio = (Number(v) - scale.min) / (scale.max - scale.min);
  const x = 1 + 9 * Math.min(Math.max(Number.isFinite(ratio) ? ratio : 0.5, 0), 1);
  const k = HUE_STOPS.findIndex(([n]) => n >= x);
  const [n0, h0] = HUE_STOPS[Math.max(k - 1, 0)];
  const [n1, h1] = HUE_STOPS[k];
  const hue = n1 === n0 ? h1 : h0 + ((x - n0) / (n1 - n0)) * (h1 - h0);
  return `hsl(${Math.round(hue)} 80% 50% / ${alpha})`;
}

const VIEW_STYLE = {
  front: 'bg-sky-600',
  back: 'bg-violet-600',
};

const readStoredSex = () => {
  try { return localStorage.getItem(SEX_STORAGE_KEY) === 'femme' ? 'femme' : 'homme'; } catch { return 'homme'; }
};

function Body({ art, zones, onToggle, scale }) {
  const uid = useId().replace(/:/g, '');
  const hit = 'cursor-pointer fill-transparent hover:fill-amber-400/25 transition-colors';
  return (
    <svg viewBox={art.viewBox} className="w-52 h-[26rem] select-none">
      <defs>
        <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      {/* Muscles (tracés d'origine), regroupés par zone */}
      {art.zones.filter(z => !z.hairOnly).flatMap(z => z.d.map((d, i) => (
        <path key={`${z.id}-${i}`} d={d} fill={SKIN} stroke={INK} strokeWidth="3" strokeLinejoin="round" pointerEvents="none" />
      )))}
      {art.hair.map((d, i) => <path key={`hair-${i}`} d={d} fill={INK} fillOpacity="0.55" stroke={INK} strokeWidth="3" pointerEvents="none" />)}
      {/* Taches de couleur des zones douloureuses */}
      <g filter={`url(#blur-${uid})`} pointerEvents="none">
        {art.zones.filter(z => isPainZoneOn(zones[z.id])).flatMap(z => z.d.map((d, i) => (
          <path key={`${z.id}-${i}`} d={d} fill={intensityColor(zones[z.id], scale)} opacity="0.85" />
        )))}
        {art.joints.filter(j => isPainZoneOn(zones[j.id])).map(j => (
          <circle key={j.id} cx={j.cx} cy={j.cy} r={j.r} fill={intensityColor(zones[j.id], scale)} opacity="0.9" />
        ))}
      </g>
      {/* Zones cliquables (coudes, poignets… par-dessus les membres) */}
      {art.zones.map(z => {
        const label = painZoneInfo(z.id)?.fullLabel;
        return (
          <g key={z.id} className={hit} role="button" aria-pressed={isPainZoneOn(zones[z.id])} aria-label={label}
            onClick={() => onToggle(z.id)}>
            <title>{label}</title>
            {z.d.map((d, i) => <path key={i} d={d} />)}
          </g>
        );
      })}
      {art.joints.map(j => {
        const label = painZoneInfo(j.id)?.fullLabel;
        return (
          <circle key={j.id} cx={j.cx} cy={j.cy} r={j.r} className={hit} role="button" aria-pressed={isPainZoneOn(zones[j.id])} aria-label={label}
            onClick={() => onToggle(j.id)}>
            <title>{label}</title>
          </circle>
        );
      })}
    </svg>
  );
}

// Intensité d'une zone : boutons pour une petite échelle, curseur sinon.
// Sans chiffres (scale.showNumbers = false) : pastilles de couleur, curseur seul.
function IntensityInput({ value, onChange, scale, label }) {
  const count = scale.max - scale.min + 1;
  const numbers = scale.showNumbers !== false;
  return (
    <div>
      {count <= MAX_BUTTONS ? (
        <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
          {Array.from({ length: count }, (_, i) => scale.min + i).map(n => (
            <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={String(n)}
              onClick={() => onChange(n)}
              className={`flex-1 h-8 rounded text-xs font-semibold transition ${n === value
                ? `text-white shadow ${numbers ? '' : 'ring-2 ring-offset-1 ring-slate-700 scale-110'}`
                : numbers ? 'bg-white text-slate-500 hover:bg-slate-100' : 'hover:opacity-80'}`}
              style={n === value ? { background: intensityColor(n, scale) } : numbers ? undefined : { background: intensityColor(n, scale, 0.3) }}>
              {numbers && n}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <input type="range" min={scale.min} max={scale.max} value={value} aria-label={label}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 h-3 rounded-lg appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, ${intensityColor(scale.min, scale)}, ${intensityColor((scale.min + scale.max) / 2, scale)}, ${intensityColor(scale.max, scale)})` }} />
          {numbers && <span className="w-10 text-right text-sm font-bold" style={{ color: intensityColor(value, scale) }}>{value}</span>}
        </div>
      )}
      {(scale.minLabel || scale.maxLabel) && (
        <div className="flex justify-between gap-2 mt-1 text-[11px] text-slate-500">
          <span>{scale.minLabel}</span><span className="text-right">{scale.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Question « Zones douloureuses » : silhouette homme ou femme (selon le profil
 * de l'athlète, sinon au choix) à retourner devant / derrière, puis une
 * intensité par zone touchée, sur l'échelle de la question (`scale`, voir
 * painScaleOf ; 1 à 10 par défaut). Valeur : { [zoneId]: intensité }.
 */
export default function BodyPainInput({ value, onChange, t, sex, scale = PAIN_SCALE_DEFAULT, initialView = 'front' }) {
  const zones = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const [view, setView] = useState(initialView);
  const [turning, setTurning] = useState(false);
  const [chosenSex, setChosenSex] = useState(readStoredSex);
  const bodySex = sex === 'femme' || sex === 'homme' ? sex : chosenSex;
  const art = BODY_ART[bodySex === 'femme' ? 'female' : 'male'][view];

  const toggle = (id) => {
    const next = { ...zones };
    if (isPainZoneOn(next[id])) delete next[id];
    else next[id] = painScaleMiddle(scale);
    onChange(next);
  };
  const setIntensity = (id, v) => onChange({ ...zones, [id]: v });
  const flip = () => {
    setTurning(true);
    setTimeout(() => { setView(v => (v === 'front' ? 'back' : 'front')); setTurning(false); }, FLIP_MS);
  };
  const chooseSex = (s) => {
    setChosenSex(s);
    try { localStorage.setItem(SEX_STORAGE_KEY, s); } catch { /* stockage indisponible */ }
  };

  const selected = Object.keys(zones).filter(id => isPainZoneOn(zones[id]) && painZoneInfo(id));
  const otherView = view === 'front' ? 'back' : 'front';
  // Zones cochées visibles seulement de l'autre côté
  const otherCount = selected.filter(id => !VIEW_ZONE_IDS[view].has(id) && VIEW_ZONE_IDS[otherView].has(id)).length;
  // De face, la gauche de l'athlète est à droite du schéma ; de dos, à gauche
  const [leftLabel, rightLabel] = view === 'front' ? [t.painRightFull, t.painLeftFull] : [t.painLeftFull, t.painRightFull];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t.painHint}</p>

      <div className="rounded-xl p-3 flex flex-col items-center gap-2" style={{ background: '#fdf8f3' }}>
        {!sex && (
          <div className="flex rounded-full bg-white border border-slate-200 p-0.5 text-xs self-end">
            {[['homme', t.painMale], ['femme', t.painFemale]].map(([s, label]) => (
              <button key={s} type="button" onClick={() => chooseSex(s)}
                className={`px-3 py-1 rounded-full transition ${bodySex === s ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={`px-4 py-1 rounded-full text-white text-sm font-bold tracking-wide uppercase transition-colors ${VIEW_STYLE[view]}`}>
          {view === 'front' ? t.painFront : t.painBack}
        </div>

        <div style={{ transform: turning ? 'scaleX(0)' : 'scaleX(1)', transition: `transform ${FLIP_MS}ms ease-in-out` }}>
          <Body art={art} zones={zones} onToggle={toggle} scale={scale} />
        </div>

        <div className="w-52 flex justify-between text-xs font-semibold" style={{ color: INK }}>
          <span>← {leftLabel}</span>
          <span>{rightLabel} →</span>
        </div>

        <button type="button" onClick={flip}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 active:scale-95 transition">
          <RotateCcw className="w-4 h-4" />
          {view === 'front' ? t.painShowBack : t.painShowFront}
          {otherCount > 0 && (
            <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {otherCount}
            </span>
          )}
        </button>
      </div>

      {selected.length === 0 ? (
        <p className="text-sm text-slate-400 text-center">{t.painNone}</p>
      ) : (
        <div className="space-y-2">
          {selected.map(id => {
            const v = typeof zones[id] === 'number' ? Math.min(Math.max(zones[id], scale.min), scale.max) : painScaleMiddle(scale);
            const info = painZoneInfo(id);
            const views = viewsOf(id);
            const onlyView = views.length === 1 ? views[0] : null;
            return (
              <div key={id} className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-red-800">
                    {info.label}{SIDE_KEY[info.side] ? ` (${t[SIDE_KEY[info.side]]})` : ''}
                    {onlyView && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white ${VIEW_STYLE[onlyView]}`}>
                        {onlyView === 'front' ? t.painFront : t.painBack}
                      </span>
                    )}
                  </span>
                  <button type="button" onClick={() => toggle(id)} aria-label="Retirer"
                    className="p-1 rounded-full text-red-600 hover:bg-red-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <IntensityInput value={v} onChange={(n) => setIntensity(id, n)} scale={scale} label={t.painIntensity} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

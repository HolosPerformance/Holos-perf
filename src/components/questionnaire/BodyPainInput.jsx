import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  PAIN_ZONES, PAIN_INTENSITY_DEFAULT, PAIN_INTENSITY_MAX, painZoneInfo,
} from '@/lib/painZones';

const SIDE_KEY = { gauche: 'painLeft', droit: 'painRight' };
const FLIP_MS = 160;

// ─── Silhouette (repère 200 × 360, commun aux deux vues) ─────────────────────
// Moitié gauche du contour (à l'écran), de la base du cou à l'entrejambe ;
// l'autre moitié est son symétrique.
const HALF_OUTLINE = [
  [91, 62], [90, 74], [70, 77], [55, 85], [48, 100], [46, 130], [46, 152], [47, 168],
  [48, 198], [50, 208], [45, 222], [50, 234], [62, 235], [66, 222], [65, 208],
  [66, 168], [67, 152], [68, 118], [71, 112], [73, 140], [74, 160], [70, 176],
  [67, 200], [67, 238], [68, 252], [71, 266], [70, 290], [74, 310], [68, 334],
  [69, 350], [90, 351], [91, 336], [87, 312], [88, 266], [92, 252], [93, 200], [100, 192],
];

// Contour lissé (Catmull-Rom → courbes de Bézier)
function smoothPath(points) {
  const n = points.length;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return `${d} Z`;
}
const BODY_PATH = smoothPath([...HALF_OUTLINE, ...[...HALF_OUTLINE].reverse().slice(1).map(([x, y]) => [200 - x, y])]);

const CUE = { fill: 'none', stroke: '#64748b', strokeWidth: 1.6, strokeLinecap: 'round', pointerEvents: 'none' };

// Repères de face : visage, pectoraux, abdominaux, nombril, rotules, orteils
function FrontCues() {
  return (
    <g>
      <circle cx="91" cy="36" r="2.6" fill="#475569" pointerEvents="none" />
      <circle cx="109" cy="36" r="2.6" fill="#475569" pointerEvents="none" />
      <path d="M100,39 L97.5,47 L101.5,47" {...CUE} />
      <path d="M92,53 Q100,59 108,53" {...CUE} />
      <path d="M76,112 Q87,123 98,114 M124,112 Q113,123 102,114" {...CUE} />
      <path d="M100,128 L100,166 M91,140 L109,140 M91,152 L109,152" {...CUE} strokeWidth={1.2} />
      <circle cx="100" cy="161" r="1.6" fill="#64748b" pointerEvents="none" />
      <circle cx="80" cy="249" r="5" {...CUE} strokeWidth={1.2} />
      <circle cx="120" cy="249" r="5" {...CUE} strokeWidth={1.2} />
      {[73, 77, 81, 85].map(x => <circle key={`d${x}`} cx={x} cy="348" r="1.6" fill="#64748b" pointerEvents="none" />)}
      {[115, 119, 123, 127].map(x => <circle key={`g${x}`} cx={x} cy="348" r="1.6" fill="#64748b" pointerEvents="none" />)}
    </g>
  );
}

// Repères de dos : cheveux, colonne, omoplates, pli des fessiers, creux des genoux, talons
function BackCues() {
  return (
    <g>
      <path d="M77,38 Q78,13 100,14 Q122,13 123,38 Q122,58 100,63 Q78,58 77,38 Z" fill="#475569" opacity="0.75" pointerEvents="none" />
      <path d="M86,24 Q92,40 89,58 M100,16 L100,62 M114,24 Q108,40 111,58" {...CUE} stroke="#334155" strokeWidth={1} />
      <path d="M100,80 L100,168" {...CUE} strokeDasharray="3 3" />
      <path d="M77,95 Q83,116 95,104 M123,95 Q117,116 105,104" {...CUE} />
      <path d="M100,172 L100,190 M72,191 Q86,197 99,191 M128,191 Q114,197 101,191" {...CUE} />
      <path d="M73,250 Q80,246 87,250 M113,250 Q120,246 127,250" {...CUE} strokeWidth={1.2} />
      <ellipse cx="80" cy="345" rx="7" ry="5" fill="#94a3b8" pointerEvents="none" />
      <ellipse cx="120" cy="345" rx="7" ry="5" fill="#94a3b8" pointerEvents="none" />
    </g>
  );
}

function Shape({ shape, ...props }) {
  if (shape.r) return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props} />;
  if (shape.rx && shape.ry) return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...props} />;
  return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...props} />;
}

// Couleur d'une zone selon l'intensité (jaune → rouge)
const intensityColor = (v) => `hsl(${Math.round(45 - (Math.min(v, PAIN_INTENSITY_MAX) - 1) * 5)} 90% 50%)`;

const VIEW_STYLE = {
  front: 'bg-sky-600',
  back: 'bg-violet-600',
};

/**
 * Question « Zones douloureuses » : une silhouette à retourner (devant /
 * derrière), puis une intensité de 1 à 10 par zone touchée.
 * Valeur : { [zoneId]: intensité }.
 */
export default function BodyPainInput({ value, onChange, t, initialView = 'front' }) {
  const zones = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const [view, setView] = useState(initialView);
  const [turning, setTurning] = useState(false);

  const toggle = (id) => {
    const next = { ...zones };
    if (next[id]) delete next[id];
    else next[id] = PAIN_INTENSITY_DEFAULT;
    onChange(next);
  };
  const setIntensity = (id, v) => onChange({ ...zones, [id]: v });
  const flip = () => {
    setTurning(true);
    setTimeout(() => { setView(v => (v === 'front' ? 'back' : 'front')); setTurning(false); }, FLIP_MS);
  };

  const selected = Object.keys(zones).filter(id => zones[id] && painZoneInfo(id));
  const otherView = view === 'front' ? 'back' : 'front';
  const otherCount = selected.filter(id => PAIN_ZONES.find(z => z.id === id)?.view === otherView).length;
  // De face, la gauche de l'athlète est à droite du schéma ; de dos, à gauche
  const [leftLabel, rightLabel] = view === 'front' ? [t.painRightFull, t.painLeftFull] : [t.painLeftFull, t.painRightFull];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t.painHint}</p>

      <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center gap-2">
        <div className={`px-4 py-1 rounded-full text-white text-sm font-bold tracking-wide uppercase transition-colors ${VIEW_STYLE[view]}`}>
          {view === 'front' ? t.painFront : t.painBack}
        </div>

        <div style={{ transform: turning ? 'scaleX(0)' : 'scaleX(1)', transition: `transform ${FLIP_MS}ms ease-in-out` }}>
          <svg viewBox="0 0 200 360" className="w-44 h-80 select-none">
            <path d={BODY_PATH} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
            <circle cx="100" cy="40" r="25" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
            {PAIN_ZONES.filter(z => z.view === view).map(zone => {
              const v = zones[zone.id];
              const label = painZoneInfo(zone.id).fullLabel;
              return (
                <Shape key={zone.id} shape={zone.shape}
                  role="button" aria-pressed={!!v} aria-label={label}
                  onClick={() => toggle(zone.id)}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  fill={v ? intensityColor(v) : '#cbd5e1'}
                  stroke={v ? '#b91c1c' : '#94a3b8'}
                  strokeWidth={v ? 2 : 0.8}
                  opacity={v ? 0.95 : 0.45}>
                  <title>{label}</title>
                </Shape>
              );
            })}
            {view === 'front' ? <FrontCues /> : <BackCues />}
          </svg>
        </div>

        <div className="w-44 flex justify-between text-xs font-semibold text-slate-500">
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
            const v = typeof zones[id] === 'number' ? zones[id] : PAIN_INTENSITY_DEFAULT;
            const info = painZoneInfo(id);
            const zoneView = PAIN_ZONES.find(z => z.id === id)?.view;
            return (
              <div key={id} className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-red-800">
                    {info.label}{SIDE_KEY[info.side] ? ` (${t[SIDE_KEY[info.side]]})` : ''}
                    {zoneView && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white ${VIEW_STYLE[zoneView]}`}>
                        {zoneView === 'front' ? t.painFront : t.painBack}
                      </span>
                    )}
                  </span>
                  <button type="button" onClick={() => toggle(id)} aria-label="Retirer"
                    className="p-1 rounded-full text-red-600 hover:bg-red-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1" role="radiogroup" aria-label={t.painIntensity}>
                  {Array.from({ length: PAIN_INTENSITY_MAX }, (_, i) => i + 1).map(n => (
                    <button key={n} type="button" role="radio" aria-checked={n === v}
                      onClick={() => setIntensity(id, n)}
                      className={`flex-1 h-8 rounded text-xs font-semibold transition ${n === v ? 'text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                      style={n === v ? { background: intensityColor(n) } : undefined}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  PAIN_ZONES, PAIN_INTENSITY_DEFAULT, PAIN_INTENSITY_MAX, painZoneInfo,
} from '@/lib/painZones';

const SIDE_KEY = { gauche: 'painLeft', droit: 'painRight' };
const FLIP_MS = 160;

// ─── Silhouette (repère 240 × 480, commun aux deux vues) ─────────────────────
// Moitié gauche du contour (à l'écran), du cou à l'entrejambe ; l'autre moitié
// est son symétrique. Bras légèrement écartés pour bien séparer les zones.
const VIEW_W = 240;
const HALF_OUTLINE = [
  [111, 66], [110, 84], [96, 92], [80, 98], [68, 107], [62, 122], [58, 142], [53, 168],
  [47, 200], [41, 229], [33, 243], [28, 258], [30, 274], [36, 284], [44, 282], [48, 270],
  [51, 258], [55, 244], [55, 234], [61, 206], [67, 176], [73, 145], [79, 128], [82, 150],
  [86, 190], [82, 222], [78, 258], [81, 300], [80, 340], [88, 392], [91, 418], [83, 440],
  [83, 453], [94, 459], [109, 457], [111, 444], [106, 414], [108, 352], [110, 312],
  [113, 262], [120, 242],
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
const BODY_PATH = smoothPath([...HALF_OUTLINE, ...[...HALF_OUTLINE].reverse().slice(1).map(([x, y]) => [VIEW_W - x, y])]);

const SKIN = '#fbeee4';
const INK = '#6b4433';
const LINE = { fill: 'none', stroke: INK, strokeWidth: 1.2, strokeLinecap: 'round', opacity: 0.55, pointerEvents: 'none' };

// Trait dessiné à gauche du schéma et son symétrique
const sym = (d) => d + ' ' + d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${VIEW_W - Number(x)},${y}`);

function Head({ back }) {
  return (
    <g pointerEvents="none">
      <ellipse cx="97" cy="50" rx="4" ry="7" fill={SKIN} stroke={INK} strokeWidth="1.4" />
      <ellipse cx="143" cy="50" rx="4" ry="7" fill={SKIN} stroke={INK} strokeWidth="1.4" />
      <ellipse cx="120" cy="46" rx="22" ry="27" fill={SKIN} stroke={INK} strokeWidth="1.6" />
      {back && <path d="M98,44 Q97,18 120,19 Q143,18 142,44 Q141,57 136,60 Q120,55 104,60 Q99,57 98,44 Z" fill={INK} opacity="0.55" />}
    </g>
  );
}

// Repères de face : clavicules, pectoraux, nombril, plis de l'aine, rotules, doigts, orteils
function FrontLines() {
  return (
    <g>
      <path d={sym('M97,99 Q108,104 117,101')} {...LINE} />
      <path d="M116,100 L120,105 L124,100" {...LINE} />
      <path d={sym('M88,150 Q103,160 117,152')} {...LINE} />
      <path d="M120,158 L120,180" {...LINE} opacity={0.3} />
      <ellipse cx="120" cy="197" rx="2" ry="3" {...LINE} />
      <path d={sym('M96,214 Q106,228 114,238')} {...LINE} />
      <path d={sym('M89,318 Q96,323 103,318')} {...LINE} />
      <path d={sym('M33,268 L35,280 M39,270 L40,282 M44,268 L45,279')} {...LINE} />
      <path d={sym('M88,452 L88,457 M94,453 L94,458 M100,453 L100,457')} {...LINE} />
    </g>
  );
}

// Repères de dos : colonne, omoplates, pli des fessiers, creux des genoux, mollets, talons
function BackLines() {
  return (
    <g>
      <path d="M120,92 L120,212" {...LINE} strokeDasharray="2 4" />
      <path d={sym('M94,112 Q97,140 110,138 Q112,124 104,108')} {...LINE} />
      <path d="M120,214 L120,240" {...LINE} />
      <path d={sym('M86,246 Q101,254 118,247')} {...LINE} />
      <path d={sym('M88,314 Q96,310 104,314')} {...LINE} />
      <path d={sym('M86,335 Q92,352 96,372')} {...LINE} opacity={0.35} />
      <path d={sym('M90,448 Q96,456 104,450')} {...LINE} />
    </g>
  );
}

function Shape({ shape, ...props }) {
  const transform = shape.rot ? `rotate(${shape.rot} ${shape.cx} ${shape.cy})` : undefined;
  return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={transform} {...props} />;
}

// Couleur d'une intensité : vert (légère) → orange → rouge (très forte)
const HUE_STOPS = [[1, 120], [3, 90], [5, 38], [7, 18], [10, 0]];
function intensityColor(v) {
  const x = Math.min(Math.max(v, 1), PAIN_INTENSITY_MAX);
  const k = HUE_STOPS.findIndex(([n]) => n >= x);
  const [n0, h0] = HUE_STOPS[Math.max(k - 1, 0)];
  const [n1, h1] = HUE_STOPS[k];
  const hue = n1 === n0 ? h1 : h0 + ((x - n0) / (n1 - n0)) * (h1 - h0);
  return `hsl(${Math.round(hue)} 80% 50%)`;
}

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

      <div className="rounded-xl p-3 flex flex-col items-center gap-2" style={{ background: '#fdf8f3' }}>
        <div className={`px-4 py-1 rounded-full text-white text-sm font-bold tracking-wide uppercase transition-colors ${VIEW_STYLE[view]}`}>
          {view === 'front' ? t.painFront : t.painBack}
        </div>

        <div style={{ transform: turning ? 'scaleX(0)' : 'scaleX(1)', transition: `transform ${FLIP_MS}ms ease-in-out` }}>
          <svg viewBox="0 0 240 480" className="w-52 h-[26rem] select-none">
            <defs>
              <clipPath id="pain-body-clip"><path d={BODY_PATH} /><ellipse cx="120" cy="46" rx="22" ry="27" /></clipPath>
              <filter id="pain-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
            </defs>
            <path d={BODY_PATH} fill={SKIN} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            <Head back={view === 'back'} />
            {/* Taches de couleur des zones douloureuses, contenues dans la silhouette */}
            <g clipPath="url(#pain-body-clip)" filter="url(#pain-blur)" pointerEvents="none">
              {PAIN_ZONES.filter(z => z.view === view && zones[z.id]).map(zone => (
                <Shape key={zone.id} shape={{ ...zone.shape, rx: zone.shape.rx * 1.15, ry: zone.shape.ry * 1.1 }} fill={intensityColor(zones[zone.id])} opacity={0.9} />
              ))}
            </g>
            {view === 'front' ? <FrontLines /> : <BackLines />}
            {/* Zones cliquables (invisibles, légèrement teintées au survol) */}
            {PAIN_ZONES.filter(z => z.view === view).map(zone => {
              const label = painZoneInfo(zone.id).fullLabel;
              return (
                <Shape key={zone.id} shape={zone.shape}
                  role="button" aria-pressed={!!zones[zone.id]} aria-label={label}
                  onClick={() => toggle(zone.id)}
                  className="cursor-pointer fill-transparent hover:fill-amber-400/25 transition-colors">
                  <title>{label}</title>
                </Shape>
              );
            })}
          </svg>
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

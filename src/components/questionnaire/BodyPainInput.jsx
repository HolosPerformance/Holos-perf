import React from 'react';
import { X } from 'lucide-react';
import {
  PAIN_ZONES, BACK_DECOR, PAIN_INTENSITY_DEFAULT, PAIN_INTENSITY_MAX, painZoneInfo,
} from '@/lib/painZones';

const SIDE_KEY = { gauche: 'painLeft', droit: 'painRight' };

function Shape({ shape, ...props }) {
  if (shape.r) return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props} />;
  if (shape.rx && shape.ry) return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...props} />;
  return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...props} />;
}

// Couleur d'une zone selon l'intensité (jaune → rouge)
const intensityColor = (v) => `hsl(${Math.round(45 - (Math.min(v, PAIN_INTENSITY_MAX) - 1) * 5)} 90% 50%)`;

function Silhouette({ view, title, value, onToggle, t }) {
  // De face, la gauche de l'athlète est à droite du schéma ; de dos, à gauche
  const [leftLabel, rightLabel] = view === 'front' ? [t.painRight, t.painLeft] : [t.painLeft, t.painRight];
  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
      <svg viewBox="0 0 200 360" className="w-32 h-56 sm:w-36 sm:h-64 select-none">
        <text x="20" y="20" className="fill-slate-400 text-[14px] font-semibold">{leftLabel}</text>
        <text x="172" y="20" className="fill-slate-400 text-[14px] font-semibold">{rightLabel}</text>
        {view === 'back' && BACK_DECOR.map((shape, i) => (
          <Shape key={i} shape={shape} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1} />
        ))}
        {PAIN_ZONES.filter(z => z.view === view).map(zone => {
          const v = value[zone.id];
          return (
            <Shape key={zone.id} shape={zone.shape}
              role="button" aria-pressed={!!v} aria-label={painZoneInfo(zone.id).fullLabel}
              onClick={() => onToggle(zone.id)}
              className="cursor-pointer transition-opacity hover:opacity-80"
              fill={v ? intensityColor(v) : '#cbd5e1'}
              stroke={v ? '#b91c1c' : '#94a3b8'}
              strokeWidth={v ? 2 : 1}
              opacity={v ? 0.95 : 0.55}>
              <title>{painZoneInfo(zone.id).fullLabel}</title>
            </Shape>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Question « Zones douloureuses » : schéma du corps de face et de dos, puis une
 * intensité de 1 à 10 par zone touchée. Valeur : { [zoneId]: intensité }.
 */
export default function BodyPainInput({ value, onChange, t }) {
  const zones = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  const toggle = (id) => {
    const next = { ...zones };
    if (next[id]) delete next[id];
    else next[id] = PAIN_INTENSITY_DEFAULT;
    onChange(next);
  };
  const setIntensity = (id, v) => onChange({ ...zones, [id]: v });

  const selected = Object.keys(zones).filter(id => zones[id] && painZoneInfo(id));

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t.painHint}</p>
      <div className="flex justify-center gap-2 sm:gap-6 bg-slate-50 rounded-xl p-3">
        <Silhouette view="front" title={t.painFront} value={zones} onToggle={toggle} t={t} />
        <Silhouette view="back" title={t.painBack} value={zones} onToggle={toggle} t={t} />
      </div>

      {selected.length === 0 ? (
        <p className="text-sm text-slate-400 text-center">{t.painNone}</p>
      ) : (
        <div className="space-y-2">
          {selected.map(id => {
            const v = typeof zones[id] === 'number' ? zones[id] : PAIN_INTENSITY_DEFAULT;
            const side = painZoneInfo(id).side;
            return (
              <div key={id} className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-red-800">
                    {painZoneInfo(id).label}{SIDE_KEY[side] ? ` (${t[SIDE_KEY[side]]})` : ''}
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

import React, { useState, useRef, useCallback, useEffect } from 'react';

function hsvToHex(h, s, v) {
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { h: 0, s: 0, v: 1 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6 * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: max === 0 ? 0 : d / max, v: max };
}

function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

const PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#64748b', '#1e293b',
];

export default function ColorPicker({ value = '#3b82f6', onChange }) {
  const safe = isValidHex(value) ? value : '#3b82f6';
  const init = hexToHsv(safe);

  const [hue, setHue] = useState(init.h);
  const [sat, setSat] = useState(init.s);
  const [val, setVal] = useState(init.v);
  const [hexInput, setHexInput] = useState(safe);

  const svRef = useRef(null);
  const hueRef = useRef(null);

  useEffect(() => {
    if (isValidHex(value)) {
      const hsv = hexToHsv(value);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      setHexInput(value);
    }
  }, [value]);

  const commit = useCallback((h, s, v) => {
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSvEvent = useCallback((e) => {
    const rect = svRef.current.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setSat(s);
    setVal(v);
    commit(hue, s, v);
  }, [hue, commit]);

  const handleHueEvent = useCallback((e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    setHue(h);
    commit(h, sat, val);
  }, [sat, val, commit]);

  const currentHex = hsvToHex(hue, sat, val);

  return (
    <div className="space-y-3 select-none" style={{ width: 240 }}>
      {/* Saturation / Value square */}
      <div
        ref={svRef}
        className="relative w-full rounded-lg cursor-crosshair"
        style={{ height: 150, background: `hsl(${hue}deg, 100%, 50%)`, touchAction: 'none' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleSvEvent(e); }}
        onPointerMove={(e) => { if (e.buttons > 0) handleSvEvent(e); }}
      >
        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative w-full rounded-full cursor-pointer"
        style={{
          height: 16,
          background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          touchAction: 'none',
        }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleHueEvent(e); }}
        onPointerMove={(e) => { if (e.buttons > 0) handleHueEvent(e); }}
      >
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: `hsl(${hue}deg, 100%, 50%)`,
          }}
        />
      </div>

      {/* Color preview + hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-lg border border-slate-200 flex-shrink-0 shadow-sm"
          style={{ backgroundColor: currentHex }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            const v = e.target.value;
            setHexInput(v);
            if (isValidHex(v)) {
              const hsv = hexToHsv(v);
              setHue(hsv.h);
              setSat(hsv.s);
              setVal(hsv.v);
              onChange(v);
            }
          }}
          className="flex-1 h-9 px-2 text-sm border border-slate-200 rounded-lg font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          maxLength={7}
          placeholder="#000000"
          spellCheck={false}
        />
      </div>

      {/* Preset colors */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Couleurs rapides</p>
        <div className="grid grid-cols-9 gap-1">
          {PRESETS.map(c => (
            <button
              key={c}
              type="button"
              title={c}
              className="w-6 h-6 rounded border border-slate-200 hover:scale-125 transition-transform"
              style={{
                backgroundColor: c,
                outline: currentHex.toLowerCase() === c.toLowerCase() ? '2px solid #3b82f6' : 'none',
                outlineOffset: 1,
              }}
              onClick={() => {
                const hsv = hexToHsv(c);
                setHue(hsv.h);
                setSat(hsv.s);
                setVal(hsv.v);
                setHexInput(c);
                onChange(c);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

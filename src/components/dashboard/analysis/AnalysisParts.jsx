import React from 'react';
import { ChevronDown, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

// Bouton repliable, même présentation que le menu « Boxplot » du dashboard
export function CollapsibleAnalysis({ title, icon: Icon, open, onToggle, badge, children }) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
      >
        <span className="font-semibold text-slate-800 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-500" />}
          {title}
          {badge && <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{badge}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

export function Panel({ title, description, children, className }) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {title && <h4 className="font-semibold text-slate-800 text-sm">{title}</h4>}
      {description && <p className="text-xs text-slate-500 mt-0.5 mb-3">{description}</p>}
      {!description && title && <div className="mb-3" />}
      {children}
    </div>
  );
}

// Indicateurs inclus dans l'analyse, indépendants de « Indicateurs à afficher »
export function IndicatorToggleList({ available, labels, counts, excluded, onChange }) {
  const toggle = (key) => onChange(excluded.includes(key) ? excluded.filter(k => k !== key) : [...excluded, key]);
  const includedCount = available.filter(k => !excluded.includes(k)).length;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-xs text-slate-500">
          {includedCount} / {available.length} indicateurs inclus · entre parenthèses : nombre de valeurs sur la période
        </span>
        <div className="flex gap-2 text-xs">
          <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange(excluded.filter(k => !available.includes(k)))}>Tout inclure</button>
          <button type="button" className="text-slate-500 hover:underline" onClick={() => onChange([...new Set([...excluded, ...available])])}>Tout exclure</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {available.map(key => {
          const included = !excluded.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                included
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-400 border-slate-200 line-through hover:text-slate-600'
              )}
            >
              {labels[key]} <span className={included ? 'text-slate-300' : ''}>({counts[key] || 0})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const WARNING_STYLES = {
  block: { box: 'bg-red-50 border-red-200 text-red-800', icon: XCircle },
  warn: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: AlertTriangle },
  info: { box: 'bg-slate-50 border-slate-200 text-slate-600', icon: Info },
};

export function AnalysisWarnings({ warnings, title }) {
  if (!warnings || warnings.length === 0) return null;
  const hasProblems = warnings.some(w => w.level !== 'info');
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-slate-600">{title}</p>}
      {hasProblems && (
        <p className="text-xs text-amber-800 font-medium">
          Les résultats ci-dessous sont à interpréter avec prudence pour les raisons suivantes :
        </p>
      )}
      {warnings.map((w, i) => {
        const style = WARNING_STYLES[w.level] || WARNING_STYLES.info;
        const Icon = style.icon;
        return (
          <div key={i} className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-xs', style.box)}>
            <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{w.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SwitchField({ id, label, hint, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 cursor-pointer">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}

export function StatPill({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-slate-100 text-slate-700',
    good: 'bg-emerald-50 text-emerald-700',
    bad: 'bg-amber-50 text-amber-800',
  };
  return (
    <div className={cn('rounded-md px-3 py-2', tones[tone])}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

// Nombre de valeurs numériques par indicateur dans un ensemble de saisies
export function countValues(logs, keys) {
  const counts = {};
  keys.forEach(k => { counts[k] = 0; });
  logs.forEach(log => keys.forEach(k => {
    if (typeof log[k] === 'number' && Number.isFinite(log[k])) counts[k]++;
  }));
  return counts;
}

export const fmt = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits).replace('.', ','));

// Couleur d'une corrélation / d'un poids : bleu positif, rouge négatif
export function signedColor(value, maxAbs = 1) {
  const a = Math.min(1, Math.abs(value) / (maxAbs || 1));
  return value >= 0 ? `rgba(37, 99, 235, ${a})` : `rgba(220, 38, 38, ${a})`;
}

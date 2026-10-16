import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BodyPainInput from './BodyPainInput';
import { PAIN_SCALE_DEFAULT, painScaleOf } from '@/lib/painZones';
import { uiStrings } from '@/lib/questionnaireI18n';

// Changement de type dans un éditeur : chaque type part de sa propre échelle
// par défaut (« Zones douloureuses » : 1 à 10 ; « Échelle » : `scaleDefault`).
export function withQuestionType(question, type, scaleDefault) {
  if (type === 'body_pain' && question.type !== 'body_pain') return { ...question, type, scaleOptions: { ...PAIN_SCALE_DEFAULT } };
  if (type === 'scale' && question.type === 'body_pain') return { ...question, type, scaleOptions: { ...scaleDefault } };
  return { ...question, type };
}

// Échelle à éditer pour une question existante (avant le réglage : 1 à 10)
export const painScaleOptionsFor = (question) => ({ ...PAIN_SCALE_DEFAULT, ...(question.scaleOptions || {}) });

/**
 * Réglages d'une question « Zones douloureuses » : échelle d'intensité (min,
 * max et leurs libellés) avec l'aperçu du schéma tel que l'athlète le verra.
 */
export default function PainScaleEditor({ question, onChange }) {
  const options = question.scaleOptions || PAIN_SCALE_DEFAULT;
  const scale = painScaleOf(question);
  const [preview, setPreview] = useState({});
  const set = (patch) => onChange({ ...options, ...patch });
  const num = (v) => (v === '' ? '' : Number(v));
  const invalid = Number(options.max) <= Number(options.min);

  return (
    <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-4">
      <h4 className="font-medium text-slate-800 text-sm">Échelle d'intensité</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Min</Label>
          <Input type="number" value={options.min ?? ''} onChange={(e) => set({ min: num(e.target.value) })} /></div>
        <div className="space-y-2"><Label>Max</Label>
          <Input type="number" value={options.max ?? ''} onChange={(e) => set({ max: num(e.target.value) })} /></div>
      </div>
      {invalid && <p className="text-xs text-red-600">Le maximum doit être supérieur au minimum (sinon l'échelle 1 à 10 est utilisée).</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Libellé min</Label>
          <Input value={options.minLabel || ''} onChange={(e) => set({ minLabel: e.target.value })} placeholder="Ex : Gêne légère" /></div>
        <div className="space-y-2"><Label>Libellé max</Label>
          <Input value={options.maxLabel || ''} onChange={(e) => set({ maxLabel: e.target.value })} placeholder="Ex : Douleur insupportable" /></div>
      </div>
      <p className="text-xs text-slate-500">
        Jusqu'à 11 valeurs (ex. 0 à 10), l'athlète choisit avec des boutons ; au-delà (ex. 0 à 100), avec un curseur.
      </p>

      <div className="bg-white p-4 rounded-lg border space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aperçu (touchez une zone)</p>
        <BodyPainInput value={preview} onChange={setPreview} t={uiStrings('fr')} scale={scale} />
      </div>
    </div>
  );
}

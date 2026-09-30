import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Plus, Trash2 } from 'lucide-react';

const COLORS = [
  { name: 'Rouge', value: '#ea4335' }, { name: 'Orange', value: '#ff6d00' },
  { name: 'Jaune', value: '#fbbc04' }, { name: 'Vert', value: '#34a853' },
  { name: 'Cyan', value: '#00bcd4' }, { name: 'Bleu', value: '#4285f4' },
  { name: 'Violet', value: '#9c27b0' }, { name: 'Rose', value: '#e91e63' },
  { name: 'Marron', value: '#795548' }, { name: 'Gris', value: '#9e9e9e' },
  { name: 'Noir', value: '#000000' }, { name: 'Blanc', value: '#ffffff' }
];

export default function QuestionForm({
  isEditing,
  newQuestion,
  setNewQuestion,
  formData,
  editingQuestionId,
  addQuestion,
  cancelEdit,
  previewValue,
  setPreviewValue,
}) {
  return (
    <div className={`space-y-4 p-4 rounded-lg ${isEditing ? 'mt-4 border-2 border-blue-300 bg-blue-50' : 'border-t pt-4 bg-slate-50'}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{isEditing ? 'Modifier la question' : 'Créer une question'}</h3>
        <Button type="button" variant="ghost" onClick={cancelEdit} className="text-sm gap-1"><X className="w-3 h-3" />Annuler</Button>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Libellé interne (dashboard)</Label>
          <Input value={newQuestion.label} onChange={(e) => setNewQuestion({ ...newQuestion, label: e.target.value })} placeholder="Ex: Comment vous sentez-vous ?" />
        </div>
        <div className="space-y-2">
          <Label>Libellé athlète (optionnel)</Label>
          <Input value={newQuestion.athleteLabel || ''} onChange={(e) => setNewQuestion({ ...newQuestion, athleteLabel: e.target.value })} placeholder="Si vide, le libellé interne sera utilisé" />
        </div>
        <div className="space-y-2">
          <Label>Description (optionnel)</Label>
          <Input value={newQuestion.description || ''} onChange={(e) => setNewQuestion({ ...newQuestion, description: e.target.value })} placeholder="Phrase courte pour décrire la question" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type de réponse</Label>
            <Select value={newQuestion.type} onValueChange={(v) => setNewQuestion({ ...newQuestion, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scale">Échelle (0-100)</SelectItem>
                <SelectItem value="text">Texte court</SelectItem>
                <SelectItem value="textarea">Texte long</SelectItem>
                <SelectItem value="number">Nombre</SelectItem>
                <SelectItem value="select">Choix multiples</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newQuestion.required} onChange={(e) => setNewQuestion({ ...newQuestion, required: e.target.checked })} className="w-4 h-4 rounded border-slate-300" />
              <span className="text-sm text-slate-700">Obligatoire</span>
            </label>
          </div>
        </div>
        {/* Condition */}
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
          <h4 className="font-medium text-slate-800 text-sm">Condition d'apparition (optionnel)</h4>
          <div className="flex items-center gap-2">
            <Checkbox id="has-cond" checked={!!newQuestion.condition}
              onCheckedChange={(c) => setNewQuestion({ ...newQuestion, condition: c ? { type: 'show', questionId: '', expectedValues: [] } : null })} />
            <Label htmlFor="has-cond" className="text-sm cursor-pointer">Ajouter une condition</Label>
          </div>
          {newQuestion.condition && (
            <div className="space-y-3 pl-6">
              <Select value={newQuestion.condition.type || 'show'} onValueChange={(v) => setNewQuestion({ ...newQuestion, condition: { ...newQuestion.condition, type: v } })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="show">Afficher si</SelectItem>
                  <SelectItem value="hide">Masquer si</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newQuestion.condition.questionId || ''} onValueChange={(v) => setNewQuestion({ ...newQuestion, condition: { ...newQuestion.condition, questionId: v, expectedValues: [] } })}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Sélectionner une question" /></SelectTrigger>
                <SelectContent>
                  {formData.questions.filter(q => q.id !== editingQuestionId && q.type === 'select').map(q => (
                    <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newQuestion.condition.questionId && (() => {
                const sq = formData.questions.find(q => q.id === newQuestion.condition.questionId);
                return sq?.selectOptions?.choices ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Sélectionner une ou plusieurs réponses</Label>
                    <div className="space-y-1.5">
                      {sq.selectOptions.choices.map((c, i) => {
                        const val = c.label;
                        const selected = (newQuestion.condition.expectedValues || []).includes(val);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <Checkbox
                              id={`cond-val-${i}`}
                              checked={selected}
                              onCheckedChange={(checked) => {
                                const current = newQuestion.condition.expectedValues || [];
                                const next = checked ? [...current, val] : current.filter(v => v !== val);
                                setNewQuestion({ ...newQuestion, condition: { ...newQuestion.condition, expectedValues: next } });
                              }}
                            />
                            <Label htmlFor={`cond-val-${i}`} className="text-sm cursor-pointer font-normal">{val || `Choix ${i + 1}`}</Label>
                          </div>
                        );
                      })}
                    </div>
                    {(newQuestion.condition.expectedValues || []).length > 0 && (
                      <p className="text-xs text-orange-600 font-medium">
                        {(newQuestion.condition.expectedValues || []).length} réponse(s) sélectionnée(s)
                      </p>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Scale options */}
        {newQuestion.type === 'scale' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <h4 className="font-medium text-slate-800 text-sm">Options de l'échelle</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Min</Label><Input type="number" value={newQuestion.scaleOptions?.min ?? 0} onChange={(e) => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, min: Number(e.target.value) } })} /></div>
              <div className="space-y-2"><Label>Max</Label><Input type="number" value={newQuestion.scaleOptions?.max ?? 100} onChange={(e) => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, max: Number(e.target.value) } })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Label min</Label><Input value={newQuestion.scaleOptions?.minLabel || ''} onChange={(e) => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, minLabel: e.target.value } })} placeholder="Ex: Très faible" /></div>
              <div className="space-y-2"><Label>Label max</Label><Input value={newQuestion.scaleOptions?.maxLabel || ''} onChange={(e) => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, maxLabel: e.target.value } })} placeholder="Ex: Très élevé" /></div>
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c.value} type="button" onClick={() => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, color: c.value } })}
                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value, borderColor: newQuestion.scaleOptions?.color === c.value ? '#3b82f6' : '#e2e8f0' }} title={c.name} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="reversed" checked={newQuestion.scaleOptions?.reversed || false} onCheckedChange={(c) => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, reversed: c } })} />
                <Label htmlFor="reversed" className="text-sm cursor-pointer">Échelle inversée</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="show-nums" checked={newQuestion.scaleOptions?.showNumbers ?? true} onCheckedChange={(c) => setNewQuestion({ ...newQuestion, scaleOptions: { ...newQuestion.scaleOptions, showNumbers: c } })} />
                <Label htmlFor="show-nums" className="text-sm cursor-pointer">Afficher les chiffres</Label>
              </div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="flex justify-between text-sm mb-2">
                <span>{newQuestion.scaleOptions?.minLabel}</span><span>{newQuestion.scaleOptions?.maxLabel}</span>
              </div>
              <input type="range" min={newQuestion.scaleOptions?.min ?? 0} max={newQuestion.scaleOptions?.max ?? 100}
                value={previewValue} onChange={(e) => setPreviewValue(Number(e.target.value))}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                style={{ background: newQuestion.scaleOptions?.color || '#3b82f6', transform: newQuestion.scaleOptions?.reversed ? 'scaleX(-1)' : 'none' }}
              />
              {newQuestion.scaleOptions?.showNumbers && <div className="text-center mt-2 text-lg font-semibold" style={{ color: newQuestion.scaleOptions?.color }}>{previewValue}</div>}
            </div>
          </div>
        )}

        {/* Select options */}
        {newQuestion.type === 'select' && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
            <h4 className="font-medium text-slate-800 text-sm">Choix multiples</h4>
            <div className="flex items-center gap-2">
              <Checkbox
                id="multi-select"
                checked={newQuestion.selectOptions?.multiSelect ?? false}
                onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, selectOptions: { ...newQuestion.selectOptions, multiSelect: checked } })}
              />
              <Label htmlFor="multi-select" className="text-sm cursor-pointer">Permettre plusieurs réponses</Label>
            </div>
            {(newQuestion.selectOptions?.choices || []).map((choice, ci) => (
              <div key={ci} className="p-3 bg-white border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Choix {ci + 1}</span>
                  {(newQuestion.selectOptions?.choices || []).length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => { const c = [...(newQuestion.selectOptions?.choices || [])]; c.splice(ci, 1); setNewQuestion({ ...newQuestion, selectOptions: { ...newQuestion.selectOptions, choices: c } }); }} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>}
                </div>
                <Input value={choice.label || ''} onChange={(e) => { const c = [...(newQuestion.selectOptions?.choices || [])]; c[ci] = { ...c[ci], label: e.target.value }; setNewQuestion({ ...newQuestion, selectOptions: { ...newQuestion.selectOptions, choices: c } }); }} placeholder="Ex: Très bien" />
                <div className="flex flex-wrap gap-1">
                  {COLORS.map(col => (
                    <button key={col.value} type="button" onClick={() => { const c = [...(newQuestion.selectOptions?.choices || [])]; c[ci] = { ...c[ci], color: col.value }; setNewQuestion({ ...newQuestion, selectOptions: { ...newQuestion.selectOptions, choices: c } }); }}
                      className="w-6 h-6 rounded-full border hover:scale-110 transition-transform"
                      style={{ backgroundColor: col.value, borderColor: choice.color === col.value ? '#3b82f6' : '#e2e8f0' }} />
                  ))}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => { const c = [...(newQuestion.selectOptions?.choices || [])]; c.push({ label: '', color: '#3b82f6', image: '' }); setNewQuestion({ ...newQuestion, selectOptions: { ...newQuestion.selectOptions, choices: c } }); }} className="w-full gap-2">
              <Plus className="w-4 h-4" />Nouveau choix
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={addQuestion} className="gap-2 flex-1"><Save className="w-4 h-4" />{editingQuestionId ? 'Enregistrer' : 'Valider la question'}</Button>
        <Button type="button" variant="outline" onClick={cancelEdit}>Annuler</Button>
      </div>
    </div>
  );
}
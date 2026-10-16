import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  INJURY_STATUSES, INJURY_TYPES, BODY_LOCATIONS, SIDES, SEVERITIES, CONTEXTS, todayISO,
} from '@/lib/medical';

const EMPTY = {
  injury_type: '',
  body_location: '',
  side: '',
  severity: '',
  context: '',
  is_recurrence: false,
  injury_date: '',
  expected_return_date: '',
  end_date: '',
  status: 'blesse',
  diagnosis: '',
  practitioner: '',
  notes: '',
};

function OptionSelect({ label, value, onChange, options, placeholder = 'Choisir…' }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Création / édition d'une fiche blessure.
 * En création, le statut initial est demandé ; en édition, le statut se change
 * depuis la frise de la fiche (pour garder l'historique cohérent).
 */
export default function InjuryForm({ open, onOpenChange, injury, prefill, athleteName, onSubmit, saving }) {
  const isEdit = !!injury;
  // `prefill` : champs déjà connus en création (ex. zone d'une douleur signalée)
  const [form, setForm] = useState(() => (
    injury
      ? Object.fromEntries(Object.keys(EMPTY).map(k => [k, injury[k] ?? EMPTY[k]]))
      : { ...EMPTY, injury_date: todayISO(), ...prefill }
  ));
  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    for (const k of Object.keys(payload)) if (payload[k] === '') payload[k] = null;
    if (isEdit) delete payload.status;
    if (!isEdit || !injury.end_date) delete payload.end_date;
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier la blessure' : 'Nouvelle blessure'}
            {athleteName && <span className="text-slate-500 font-normal"> · {athleteName}</span>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OptionSelect label="Type de blessure" value={form.injury_type} onChange={set('injury_type')} options={INJURY_TYPES} />
            <OptionSelect label="Localisation" value={form.body_location} onChange={set('body_location')} options={BODY_LOCATIONS} />
            <OptionSelect label="Côté" value={form.side} onChange={set('side')} options={SIDES} />
            <OptionSelect label="Gravité" value={form.severity} onChange={set('severity')} options={SEVERITIES} />
            <OptionSelect label="Circonstances" value={form.context} onChange={set('context')} options={CONTEXTS} />
            {!isEdit && (
              <OptionSelect label="Statut initial" value={form.status} onChange={set('status')} options={INJURY_STATUSES} />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch id="is_recurrence" checked={form.is_recurrence} onCheckedChange={set('is_recurrence')} />
            <Label htmlFor="is_recurrence">Récidive</Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date de blessure *</Label>
              <Input type="date" required value={form.injury_date || ''} onChange={e => set('injury_date')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de retour prévue</Label>
              <Input type="date" value={form.expected_return_date || ''} min={form.injury_date || undefined}
                onChange={e => set('expected_return_date')(e.target.value)} />
            </div>
            {isEdit && injury.end_date && (
              <div className="space-y-1.5">
                <Label>Date de fin de blessure *</Label>
                <Input type="date" required value={form.end_date || ''} min={form.injury_date || undefined}
                  onChange={e => set('end_date')(e.target.value)} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Diagnostic</Label>
              <Input value={form.diagnosis || ''} onChange={e => set('diagnosis')(e.target.value)} placeholder="Ex. lésion grade 2 du biceps fémoral" />
            </div>
            <div className="space-y-1.5">
              <Label>Soignant / suivi par</Label>
              <Input value={form.practitioner || ''} onChange={e => set('practitioner')(e.target.value)} placeholder="Ex. Dr Martin, kiné du club" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes || ''} onChange={e => set('notes')(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving || !form.injury_date}>
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la fiche'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export default function ManageCoachQuestionnairesModal({ coachEmail, coachName, questionnaires, onClose }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialiser avec les questionnaires déjà assignés à cet entraîneur
    const assigned = questionnaires
      .filter(q => (q.assigned_coaches || []).includes(coachEmail))
      .map(q => q.id);
    setSelected(assigned);
  }, [coachEmail, questionnaires]);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Pour chaque questionnaire master, mettre à jour assigned_coaches
      const masterQuestionnaires = questionnaires.filter(q => q.is_master_template !== false);
      await Promise.all(masterQuestionnaires.map(q => {
        const current = q.assigned_coaches || [];
        const shouldHave = selected.includes(q.id);
        const has = current.includes(coachEmail);
        if (shouldHave && !has) {
          return base44.entities.QuestionnaireTemplate.update(q.id, {
            assigned_coaches: [...current, coachEmail]
          });
        } else if (!shouldHave && has) {
          return base44.entities.QuestionnaireTemplate.update(q.id, {
            assigned_coaches: current.filter(e => e !== coachEmail)
          });
        }
        return Promise.resolve();
      }));
      toast.success('Questionnaires assignés mis à jour');
      onClose();
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const masterQuestionnaires = questionnaires.filter(q => q.is_master_template !== false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Questionnaires accessibles pour {coachName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-2 mb-2">
          Sélectionnez les questionnaires que cet entraîneur pourra voir et modifier.
        </p>
        <div className="max-h-80 overflow-y-auto space-y-2 py-2">
          {masterQuestionnaires.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Aucun questionnaire disponible</p>
          ) : (
            masterQuestionnaires.map(q => (
              <div key={q.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
                <Checkbox
                  id={`cq-${q.id}`}
                  checked={selected.includes(q.id)}
                  onCheckedChange={() => toggle(q.id)}
                />
                <Label htmlFor={`cq-${q.id}`} className="cursor-pointer flex-1">
                  <span className="font-medium">{q.name}</span>
                  <span className="text-xs text-slate-400 block">{q.questions?.length || 0} questions</span>
                </Label>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

export default function ManageAthleteQuestionnairesModal({ athleteEmail, questionnaires, onClose }) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async ({ questionnaire, assign }) => {
      const current = questionnaire.assigned_athletes || [];
      const updated = assign
        ? [...current, athleteEmail]
        : current.filter(e => e !== athleteEmail);
      return base44.entities.QuestionnaireTemplate.update(questionnaire.id, { assigned_athletes: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const masterQuestionnaires = questionnaires.filter(q => q.is_master_template !== false && q.is_active !== false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Questionnaires assignés</DialogTitle>
          <p className="text-sm text-slate-500">{athleteEmail}</p>
        </DialogHeader>
        <div className="space-y-3 mt-2 max-h-80 overflow-y-auto">
          {masterQuestionnaires.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Aucun questionnaire disponible</p>
          )}
          {masterQuestionnaires.map(q => {
            const isAssigned = (q.assigned_athletes || []).includes(athleteEmail);
            return (
              <div key={q.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                <Checkbox
                  id={`q-${q.id}`}
                  checked={isAssigned}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(checked) => toggleMutation.mutate({ questionnaire: q, assign: checked })}
                />
                <Label htmlFor={`q-${q.id}`} className="flex-1 cursor-pointer">
                  <span className="font-medium text-sm">{q.name}</span>
                  {q.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{q.description}</p>
                  )}
                </Label>
                {isAssigned && <Badge variant="secondary" className="text-xs">Assigné</Badge>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserCheck, Save, X, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function CoachQuestionnaireAssignment({ template, coachEmail }) {
  const [isEditing, setIsEditing] = useState(false);
  const [assignedAthletes, setAssignedAthletes] = useState(template.assigned_athletes || []);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuestionnaireTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-questionnaire-templates'] });
      toast.success('Assignations mises à jour');
      setIsEditing(false);
    },
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club', coachEmail],
    queryFn: async () => {
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(coachEmail)) || null;
    },
    enabled: !!coachEmail
  });

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', coachEmail],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: coachEmail });
      return groups[0] || null;
    },
    enabled: !!coachEmail && !coachClub
  });

  // Priorité au club, sinon fallback sur le groupe
  const coachAthletes = coachClub ? (coachClub.athlete_emails || []) : (coachGroup?.athlete_emails || []);

  const handleSave = () => {
    updateMutation.mutate({
      id: template.id,
      data: { assigned_athletes: assignedAthletes }
    });
  };

  const handleCancel = () => {
    setAssignedAthletes(template.assigned_athletes || []);
    setIsEditing(false);
  };

  const athletesAssignedCount = coachAthletes.filter(email => assignedAthletes.includes(email)).length;

  const handleAssignAll = () => {
    const merged = Array.from(new Set([...assignedAthletes, ...coachAthletes]));
    setAssignedAthletes(merged);
  };

  if (!template.is_active) {
    return (
      <Card className="mt-4 border-t-4 border-t-slate-300">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <UserCheck className="w-4 h-4" />
            <span>Ce questionnaire est <strong>inactif</strong> — les assignations sont désactivées.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isEditing) {
    return (
      <Card className="mt-4 border-t-4 border-t-blue-500">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Mes athlètes assignés
              </h3>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="text-xs">Gérer</Button>
            </div>
            <div className="text-sm">
              <span className="text-slate-600"><strong>{athletesAssignedCount}</strong> de mes athlètes assigné(s)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-t-4 border-t-blue-500">
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Assigner mes athlètes</h3>
            {coachAthletes.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleAssignAll} className="text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Users className="w-3 h-3" />
                Assigner à tous
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sélectionner les athlètes</Label>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {coachAthletes.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-4">Aucun athlète dans votre {coachClub ? 'club' : 'groupe'}</p>
              ) : (
                coachAthletes.map(athleteEmail => {
                  const isAssigned = assignedAthletes.includes(athleteEmail);
                  return (
                    <label key={athleteEmail} className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0">
                      <input type="checkbox" checked={isAssigned}
                        onChange={(e) => {
                          if (e.target.checked) setAssignedAthletes([...assignedAthletes, athleteEmail]);
                          else setAssignedAthletes(assignedAthletes.filter(a => a !== athleteEmail));
                        }}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">{athleteEmail}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            {athletesAssignedCount > 0 && (
              <p className="text-xs text-slate-600">{athletesAssignedCount} sélectionné(s)</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="flex-1 gap-2 text-sm" size="sm">
              <Save className="w-4 h-4" />Enregistrer
            </Button>
            <Button onClick={handleCancel} variant="outline" size="sm" className="text-sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
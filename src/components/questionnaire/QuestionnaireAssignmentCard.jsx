import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Save, X, GitBranch, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function QuestionnaireAssignmentCard({ template, allTemplates = [], onEditCopy }) {
  const [isEditing, setIsEditing] = useState(false);
  const [coachSearch, setCoachSearch] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [assignedCoaches, setAssignedCoaches] = useState(template.assigned_coaches || []);
  const [showCopies, setShowCopies] = useState(false);
  const queryClient = useQueryClient();

  // Copies de ce template pour chaque coach
  const copies = allTemplates.filter(t => t.parent_master_template_id === template.id);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list()
  });

  const coaches = allUsers.filter(u => u.user_status === 'coach' || u.user_status === 'coach_pro');
  const athletes = allUsers.filter(u => u.user_status === 'athlete');
  
  // Pour le questionnaire standard, tous les athlètes sont pré-cochés par défaut
  const isStandardQuestionnaire = template.name === "questionnaire standard";
  const [assignedAthletes, setAssignedAthletes] = useState(() => {
    if (isStandardQuestionnaire && (!template.assigned_athletes || template.assigned_athletes.length === 0)) {
      return athletes.map(a => a.email);
    }
    return template.assigned_athletes || [];
  });

  const filteredCoaches = coaches.filter(c => 
    c.full_name?.toLowerCase().includes(coachSearch.toLowerCase()) || 
    c.email?.toLowerCase().includes(coachSearch.toLowerCase())
  );

  const filteredAthletes = athletes.filter(a => 
    a.full_name?.toLowerCase().includes(athleteSearch.toLowerCase()) || 
    a.email?.toLowerCase().includes(athleteSearch.toLowerCase())
  );

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.QuestionnaireTemplate.update(template.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] });
      toast.success('Assignations mises à jour');
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      ...template,
      assigned_coaches: assignedCoaches,
      assigned_athletes: assignedAthletes
    });
  };

  const handleCancel = () => {
    setAssignedCoaches(template.assigned_coaches || []);
    setAssignedAthletes(template.assigned_athletes || []);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Card className="mt-4 border-t-4 border-t-purple-500">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Assignations
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-xs"
              >
                Modifier
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="text-slate-600">
                  <strong>{assignedCoaches.length}</strong> entraîneur(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-green-600" />
                <span className="text-slate-600">
                  <strong>{assignedAthletes.length}</strong> athlète(s)
                </span>
              </div>
            </div>
            {/* Section copies par coach */}
            {copies.length > 0 && (
              <div className="border-t pt-3">
                <button
                  onClick={() => setShowCopies(!showCopies)}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  {showCopies ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <GitBranch className="w-4 h-4 text-purple-500" />
                  <span>{copies.length} version(s) personnalisée(s)</span>
                </button>
                {showCopies && (
                  <div className="mt-2 space-y-2">
                    {copies.map(copy => {
                      const coachUser = allUsers.find(u => u.email === copy.assigned_to_coach_email);
                      return (
                        <div key={copy.id} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                          <div>
                            <p className="text-xs font-medium text-slate-700">
                              {coachUser?.full_name || copy.assigned_to_coach_email}
                            </p>
                            {copy.last_modified_by_email && copy.last_modified_by_email !== copy.assigned_to_coach_email && (
                              <p className="text-xs text-slate-400">Modifié par {copy.last_modified_by_email}</p>
                            )}
                            <Badge variant="outline" className={`text-xs mt-1 ${copy.is_active ? 'text-green-700 border-green-200' : 'text-slate-400 border-slate-200'}`}>
                              {copy.is_active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                          {onEditCopy && (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => onEditCopy(copy)}>
                              Voir
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-t-4 border-t-purple-500">
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Modifier les assignations</h3>
          </div>

          {/* Entraîneurs */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Entraîneurs assignés</Label>
            <Input
              placeholder="Rechercher un entraîneur..."
              value={coachSearch}
              onChange={(e) => setCoachSearch(e.target.value)}
              className="text-sm"
            />
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {filteredCoaches.map(coach => (
                <label
                  key={coach.email}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={assignedCoaches.includes(coach.email)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAssignedCoaches([...assignedCoaches, coach.email]);
                      } else {
                        setAssignedCoaches(assignedCoaches.filter(c => c !== coach.email));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-slate-800 truncate">{coach.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{coach.email}</p>
                  </div>
                </label>
              ))}
              {filteredCoaches.length === 0 && (
                <p className="text-center text-slate-500 text-xs py-3">Aucun entraîneur trouvé</p>
              )}
            </div>
            {assignedCoaches.length > 0 && (
              <p className="text-xs text-slate-600">
                {assignedCoaches.length} sélectionné(s)
              </p>
            )}
          </div>

          {/* Athlètes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Athlètes assignés</Label>
            <Input
              placeholder="Rechercher un athlète..."
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              className="text-sm"
            />
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {filteredAthletes.map(athlete => (
                <label
                  key={athlete.email}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={assignedAthletes.includes(athlete.email)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAssignedAthletes([...assignedAthletes, athlete.email]);
                      } else {
                        setAssignedAthletes(assignedAthletes.filter(a => a !== athlete.email));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-slate-800 truncate">{athlete.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{athlete.email}</p>
                  </div>
                </label>
              ))}
              {filteredAthletes.length === 0 && (
                <p className="text-center text-slate-500 text-xs py-3">Aucun athlète trouvé</p>
              )}
            </div>
            {assignedAthletes.length > 0 && (
              <p className="text-xs text-slate-600">
                {assignedAthletes.length} sélectionné(s)
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 gap-2 text-sm"
              size="sm"
            >
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="text-sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
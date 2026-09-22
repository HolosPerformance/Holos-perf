import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, Check, Star, Pencil, X, UserCheck, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function ClubTeamsSection({ club, athletes, templates, currentUser, onClubUpdate }) {
  const qc = useQueryClient();
  const [newTeamName, setNewTeamName] = useState('');
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingMainTeamName, setEditingMainTeamName] = useState(false);
  const [mainTeamNameValue, setMainTeamNameValue] = useState(club.main_team_name || 'Équipe principale');
  const [isDragging, setIsDragging] = useState(false);

  const { data: coaches = [] } = useQuery({
    queryKey: ['club-coaches', club.id],
    queryFn: async () => {
      const allUsers = await base44.entities.User.list();
      return allUsers.filter(u => (club.coach_emails || []).includes(u.email));
    },
    enabled: !!club.id,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', club.id],
    queryFn: () => base44.entities.Team.filter({ club_id: club.id }),
    enabled: !!club.id,
  });

  const createTeamMutation = useMutation({
    mutationFn: (name) => base44.entities.Team.create({ name, club_id: club.id, athlete_emails: [], questionnaire_template_ids: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', club.id] });
      setNewTeamName('');
      setShowNewTeam(false);
      toast.success('Équipe créée');
    },
  });

  const renameTeamMutation = useMutation({
    mutationFn: ({ id: teamId, name }) => base44.entities.Team.update(teamId, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', club.id] });
      setEditingTeamId(null);
      toast.success('Équipe renommée');
    },
    onError: (err) => toast.error('Erreur lors du renommage : ' + err.message),
  });

  const saveMainTeamName = async () => {
    try {
      await base44.entities.Club.update(club.id, { main_team_name: mainTeamNameValue.trim() || 'Équipe principale' });
      qc.invalidateQueries({ queryKey: ['club', club.id] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      if (onClubUpdate) onClubUpdate();
      setEditingMainTeamName(false);
      toast.success('Nom mis à jour');
    } catch (err) {
      toast.error('Erreur lors de la mise à jour : ' + err.message);
    }
  };

  const deleteTeamMutation = useMutation({
    mutationFn: async (team) => {
      for (const templateId of (team.questionnaire_template_ids || [])) {
        const tmpl = templates.find(t => t.id === templateId);
        if (tmpl) {
          const filtered = (tmpl.assigned_athletes || []).filter(e => !(team.athlete_emails || []).includes(e));
          await base44.entities.QuestionnaireTemplate.update(templateId, { assigned_athletes: filtered });
        }
      }
      return base44.entities.Team.delete(team.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', club.id] });
      toast.success('Équipe supprimée');
    },
  });

  const moveAthlete = async (athleteEmail, targetTeamId) => {
    for (const team of teams) {
      if ((team.athlete_emails || []).includes(athleteEmail) && team.id !== targetTeamId) {
        const prevQIds = team.questionnaire_template_ids || [];
        for (const qId of prevQIds) {
          const tmpl = templates.find(t => t.id === qId);
          if (tmpl) {
            await base44.entities.QuestionnaireTemplate.update(qId, {
              assigned_athletes: (tmpl.assigned_athletes || []).filter(e => e !== athleteEmail)
            });
          }
        }
        await base44.entities.Team.update(team.id, {
          athlete_emails: (team.athlete_emails || []).filter(e => e !== athleteEmail)
        });
      }
    }
    if (targetTeamId) {
      const target = teams.find(t => t.id === targetTeamId);
      if (target && !(target.athlete_emails || []).includes(athleteEmail)) {
        for (const qId of (target.questionnaire_template_ids || [])) {
          const tmpl = templates.find(t => t.id === qId);
          if (tmpl && !(tmpl.assigned_athletes || []).includes(athleteEmail)) {
            await base44.entities.QuestionnaireTemplate.update(qId, {
              assigned_athletes: [...(tmpl.assigned_athletes || []), athleteEmail]
            });
          }
        }
        await base44.entities.Team.update(target.id, {
          athlete_emails: [...(target.athlete_emails || []), athleteEmail]
        });
      }
    }
    qc.invalidateQueries({ queryKey: ['teams', club.id] });
    qc.invalidateQueries({ queryKey: ['questionnaire-templates-club'] });
    toast.success('Athlète déplacé');
  };

  const toggleTeamQuestionnaire = async (team, templateId) => {
    const current = team.questionnaire_template_ids || [];
    const isSelected = current.includes(templateId);
    const newIds = isSelected ? current.filter(id => id !== templateId) : [...current, templateId];
    await base44.entities.Team.update(team.id, { questionnaire_template_ids: newIds });
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      const teamAthletes = team.athlete_emails || [];
      if (isSelected) {
        await base44.entities.QuestionnaireTemplate.update(templateId, {
          assigned_athletes: (tmpl.assigned_athletes || []).filter(e => !teamAthletes.includes(e))
        });
      } else {
        await base44.entities.QuestionnaireTemplate.update(templateId, {
          assigned_athletes: Array.from(new Set([...(tmpl.assigned_athletes || []), ...teamAthletes]))
        });
      }
    }
    qc.invalidateQueries({ queryKey: ['teams', club.id] });
    qc.invalidateQueries({ queryKey: ['questionnaire-templates-club'] });
    toast.success('Questionnaire mis à jour');
  };

  const toggleMainTeamQuestionnaire = async (templateId) => {
    const currentIds = club.default_questionnaire_template_ids || [];
    const isSelected = currentIds.includes(templateId);
    const newIds = isSelected ? currentIds.filter(id => id !== templateId) : [...currentIds, templateId];
    await base44.entities.Club.update(club.id, { default_questionnaire_template_ids: newIds });
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      const athletesInTeamsSet = new Set(teams.flatMap(t => t.athlete_emails || []));
      const mainAthletes = athletes.filter(a => !athletesInTeamsSet.has(a.email)).map(a => a.email);
      if (isSelected) {
        await base44.entities.QuestionnaireTemplate.update(templateId, {
          assigned_athletes: (tmpl.assigned_athletes || []).filter(e => !mainAthletes.includes(e))
        });
      } else {
        await base44.entities.QuestionnaireTemplate.update(templateId, {
          assigned_athletes: Array.from(new Set([...(tmpl.assigned_athletes || []), ...mainAthletes]))
        });
      }
    }
    if (onClubUpdate) onClubUpdate();
    qc.invalidateQueries({ queryKey: ['questionnaire-templates-club'] });
    toast.success('Questionnaire mis à jour');
  };

  const onDragEnd = async (result) => {
    setIsDragging(false);
    const { draggableId, destination } = result;
    if (!destination) return;
    const athleteEmail = draggableId;
    const targetTeamId = destination.droppableId === '__main__' ? null : destination.droppableId;
    const currentTeam = teams.find(t => (t.athlete_emails || []).includes(athleteEmail));
    const currentTeamId = currentTeam?.id || null;
    if (currentTeamId === targetTeamId) return;
    await moveAthlete(athleteEmail, targetTeamId);
  };

  const athletesInTeams = new Set(teams.flatMap(t => t.athlete_emails || []));
  const mainTeamAthletes = athletes.filter(a => !athletesInTeams.has(a.email));

  const isCoach = currentUser?.user_status === 'coach' || currentUser?.user_status === 'coach_pro';
  const canEditName = currentUser?.user_status === 'admin' || isCoach;
  const activeTemplates = templates.filter(t => {
    if (!t.is_active) return false;
    if (isCoach) {
      return t.created_by_email === currentUser.email
        || t.assigned_to_coach_email === currentUser.email
        || (t.assigned_coaches || []).includes(currentUser.email);
    }
    return true;
  });

  const isAdmin = currentUser?.user_status === 'admin';

  const removeAthleteMutation = useMutation({
    mutationFn: async (athleteEmail) => {
      // Retirer de l'équipe et des questionnaires de l'équipe
      for (const team of teams) {
        if ((team.athlete_emails || []).includes(athleteEmail)) {
          for (const qId of (team.questionnaire_template_ids || [])) {
            const tmpl = templates.find(t => t.id === qId);
            if (tmpl) {
              await base44.entities.QuestionnaireTemplate.update(qId, {
                assigned_athletes: (tmpl.assigned_athletes || []).filter(e => e !== athleteEmail)
              });
            }
          }
          await base44.entities.Team.update(team.id, {
            athlete_emails: (team.athlete_emails || []).filter(e => e !== athleteEmail)
          });
        }
      }
      // Retirer des questionnaires de l'équipe principale
      for (const qId of (club.default_questionnaire_template_ids || [])) {
        const tmpl = templates.find(t => t.id === qId);
        if (tmpl) {
          await base44.entities.QuestionnaireTemplate.update(qId, {
            assigned_athletes: (tmpl.assigned_athletes || []).filter(e => e !== athleteEmail)
          });
        }
      }
      // Retirer du club
      await base44.entities.Club.update(club.id, {
        athlete_emails: (club.athlete_emails || []).filter(e => e !== athleteEmail)
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', club.id] });
      qc.invalidateQueries({ queryKey: ['club', club.id] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: ['all-users-club'] });
      toast.success('Athlète retiré du club');
    },
    onError: (err) => toast.error('Erreur : ' + err.message),
  });

  const getAthleteTeam = (athleteEmail) => teams.find(t => (t.athlete_emails || []).includes(athleteEmail)) || null;

  const mainQIds = club.default_questionnaire_template_ids || [];

  const allColumns = [
    { colId: '__main__', name: club.main_team_name || 'Équipe principale', isMain: true, athletes: mainTeamAthletes },
    ...teams.map(team => ({
      colId: team.id,
      name: team.name,
      isMain: false,
      team,
      athletes: athletes.filter(a => (team.athlete_emails || []).includes(a.email))
    }))
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Équipes du club
        </h2>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowNewTeam(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle équipe
        </Button>
      </div>

      {showNewTeam && (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="pt-4 flex gap-2">
            <Input
              placeholder="Nom de l'équipe..."
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newTeamName.trim() && createTeamMutation.mutate(newTeamName.trim())}
              autoFocus
            />
            <Button size="sm" onClick={() => newTeamName.trim() && createTeamMutation.mutate(newTeamName.trim())} disabled={createTeamMutation.isPending}>
              Créer
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowNewTeam(false); setNewTeamName(''); }}>
              Annuler
            </Button>
          </CardContent>
        </Card>
      )}

      {athletes.length > 0 && (
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Vue d'ensemble — tous les athlètes
              <Badge variant="secondary" className="text-xs">{athletes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="flex flex-wrap gap-2">
              {athletes.map(athlete => {
                const currentTeam = getAthleteTeam(athlete.email);
                return (
                  <div key={athlete.email} className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 border border-slate-200 shadow-sm text-xs">
                    <span className="font-medium text-slate-700">{athlete.full_name || athlete.email}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">{currentTeam ? currentTeam.name : (club.main_team_name || 'Équipe principale')}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {athletes.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
            <GripVertical className="w-3 h-3" />
            Glissez-déposez les athlètes pour les assigner à une équipe
          </p>
          <DragDropContext onDragEnd={onDragEnd} onDragStart={() => setIsDragging(true)}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allColumns.map(col => (
                <TeamColumn
                  key={col.colId}
                  col={col}
                  coaches={coaches}
                  teams={teams}
                  activeTemplates={activeTemplates}
                  isDragging={isDragging}
                  mainQIds={mainQIds}
                  onToggleMainQuestionnaire={toggleMainTeamQuestionnaire}
                  editingTeamId={editingTeamId}
                  editingTeamName={editingTeamName}
                  editingMainTeamName={editingMainTeamName}
                  mainTeamNameValue={mainTeamNameValue}
                  onMainTeamNameChange={setMainTeamNameValue}
                  onSaveMainTeamName={saveMainTeamName}
                  onStartEditMainName={() => { setMainTeamNameValue(club.main_team_name || 'Équipe principale'); setEditingMainTeamName(true); }}
                  onCancelEditMainName={() => setEditingMainTeamName(false)}
                  onStartEdit={(team) => { setEditingTeamId(team.id); setEditingTeamName(team.name); }}
                  onEditNameChange={setEditingTeamName}
                  onSaveRename={(team) => renameTeamMutation.mutate({ id: team.id, name: editingTeamName.trim() })}
                  onCancelEdit={() => setEditingTeamId(null)}
                  onDelete={(team) => { if (confirm(`Supprimer l'équipe "${team.name}" ?`)) deleteTeamMutation.mutate(team); }}
                  canEditName={canEditName}
                  onToggleQuestionnaire={toggleTeamQuestionnaire}
                  onUpdateCoaches={(team, coachEmails) =>
                    base44.entities.Team.update(team.id, { coach_emails: coachEmails })
                      .then(() => qc.invalidateQueries({ queryKey: ['teams', club.id] }))
                  }
                  isAdmin={isAdmin}
                  onRemoveAthlete={(athleteEmail) => {
                    if (confirm('Retirer cet athlète du club ?')) removeAthleteMutation.mutate(athleteEmail);
                  }}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      {athletes.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">Aucun athlète dans ce club</p>
      )}
    </div>
  );
}

function TeamColumn({ col, coaches, teams, activeTemplates, isDragging, mainQIds, canEditName, onToggleMainQuestionnaire, editingTeamId, editingTeamName, editingMainTeamName, mainTeamNameValue, onMainTeamNameChange, onSaveMainTeamName, onStartEditMainName, onCancelEditMainName, onStartEdit, onEditNameChange, onSaveRename, onCancelEdit, onDelete, onToggleQuestionnaire, onUpdateCoaches, isAdmin, onRemoveAthlete }) {
  const [showQuestionnaires, setShowQuestionnaires] = useState(false);
  const { colId, name, isMain, team, athletes } = col;
  const isEditingName = isMain ? editingMainTeamName : editingTeamId === team?.id;
  const selectedQIds = isMain ? (mainQIds || []) : (team?.questionnaire_template_ids || []);

  const selectedQNames = activeTemplates.filter(t => selectedQIds.includes(t.id)).map(t => t.name);

  return (
    <Card className={`border shadow-sm flex flex-col transition-all ${isDragging ? 'border-slate-300 shadow-md' : 'border-slate-200'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {isMain && <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />}
            {isEditingName ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={isMain ? mainTeamNameValue : editingTeamName}
                  onChange={e => isMain ? onMainTeamNameChange(e.target.value) : onEditNameChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') isMain ? onSaveMainTeamName() : onSaveRename(team);
                    if (e.key === 'Escape') isMain ? onCancelEditMainName() : onCancelEdit();
                  }}
                  className="h-6 text-xs"
                  autoFocus
                />
                <button onClick={() => isMain ? onSaveMainTeamName() : onSaveRename(team)} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => isMain ? onCancelEditMainName() : onCancelEdit()} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <span className="font-medium text-slate-700 truncate">{name}</span>
            )}
          </span>
          {!isEditingName && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant="secondary" className="text-xs">{athletes.length}</Badge>
              {canEditName && (
                <button onClick={() => isMain ? onStartEditMainName() : onStartEdit(team)} className="text-slate-300 hover:text-slate-600 transition p-0.5">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => setShowQuestionnaires(v => !v)} className="text-slate-300 hover:text-slate-600 transition p-0.5" title="Questionnaires">
                    📋
                  </button>
              {!isMain && (
                <>
                  <button onClick={() => onDelete(team)} className="text-slate-300 hover:text-red-500 transition p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          )}
        </CardTitle>

        {selectedQNames.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedQNames.map(n => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}
          </div>
        )}
      </CardHeader>

      {showQuestionnaires && (
        <div className="px-4 pb-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 my-2">Questionnaires :</p>
          <div className="space-y-1">
            {activeTemplates.map(t => {
              const isSelected = selectedQIds.includes(t.id);
              return (
                <button key={t.id} onClick={() => isMain ? onToggleMainQuestionnaire(t.id) : onToggleQuestionnaire(team, t.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left text-xs transition-all ${isSelected ? 'border-slate-700 bg-slate-50 font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded flex-shrink-0 border-2 flex items-center justify-center ${isSelected ? 'border-slate-700 bg-slate-700' : 'border-slate-300'}`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {coaches.length > 0 && !isMain && (
        <div className="px-4 pb-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-1.5 mt-2 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Entraîneurs :</p>
          <div className="flex flex-wrap gap-1">
            {coaches.map(coach => {
              const assigned = (team?.coach_emails || []).includes(coach.email);
              return (
                <button key={coach.email}
                  onClick={() => {
                    const current = team?.coach_emails || [];
                    onUpdateCoaches(team, assigned ? current.filter(e => e !== coach.email) : [...current, coach.email]);
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-all ${assigned ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                >
                  {coach.full_name || coach.email}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Droppable droppableId={colId}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-20 pt-2 pb-2 transition-colors rounded-b-xl ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
          >
            {athletes.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-slate-300 text-center py-3">Déposez ici</p>
            )}
            {athletes.map((athlete, index) => (
              <Draggable key={athlete.email} draggableId={athlete.email} index={index}>
                {(dragProvided, dragSnapshot) => {
                  const child = (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      style={dragProvided.draggableProps.style}
                      className={`flex items-center gap-2 px-3 py-2 mb-1 rounded-lg border select-none ${
                        dragSnapshot.isDragging
                          ? 'bg-white shadow-lg border-slate-300'
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{athlete.full_name || athlete.email}</p>
                        <p className="text-xs text-slate-400 truncate">{athlete.email}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveAthlete(athlete.email); }}
                          className="text-slate-300 hover:text-red-500 transition flex-shrink-0"
                          title="Retirer du club"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                  if (dragSnapshot.isDragging) {
                    return ReactDOM.createPortal(child, document.body);
                  }
                  return child;
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
}
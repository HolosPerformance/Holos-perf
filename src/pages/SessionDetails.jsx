import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit2, Clock, Calendar as CalendarIcon, Users, FileText, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SessionDetails() {
  const { user } = useAuth();
  const [eventId, setEventId] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResponsesDialog, setShowResponsesDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [athletes, setAthletes] = useState([]);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setEventId(urlParams.get('id'));
  }, []);

  const sessionCategories = [
    { value: 'seance_terrain', label: 'Séance terrain', defaultColor: '#f97316' },
    { value: 'seance_salle', label: 'Séance en salle', defaultColor: '#a855f7' },
    { value: 'recuperation', label: 'Récupération', defaultColor: '#3b82f6' },
    { value: 'soins', label: 'Soins', defaultColor: '#22c55e' },
    { value: 'seance_specifique', label: 'Séance spécifique', defaultColor: '#eab308' },
    { value: 'competition', label: 'Compétition', defaultColor: '#ef4444' }
  ];

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => base44.entities.Event.get(eventId),
    enabled: !!eventId,
  });

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0];
    },
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (coachGroup?.athlete_emails) {
      const loadAthletes = async () => {
        const athleteProfiles = await base44.entities.AthleteProfile.list();
        const athleteList = athleteProfiles
          .filter(profile => coachGroup.athlete_emails.includes(profile.athlete_email))
          .map(profile => ({
            email: profile.athlete_email,
            name: profile.athlete_name
          }));
        setAthletes(athleteList);
      };
      loadAthletes();
    }
  }, [coachGroup]);

  const { data: questionnaireResponses = [] } = useQuery({
    queryKey: ['questionnaire-responses', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const responses = await base44.entities.QuestionnaireResponse.filter({
        event_id: eventId
      });
      return responses;
    },
    enabled: !!eventId,
  });

  const { data: questionnaireTemplate } = useQuery({
    queryKey: ['questionnaire-template', event?.questionnaire_template_id],
    queryFn: () => base44.entities.QuestionnaireTemplate.get(event.questionnaire_template_id),
    enabled: !!event?.questionnaire_template_id,
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['coach-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEditDialog(false);
      setEditingEvent(null);
      toast.success('Séance mise à jour');
    },
  });

  const deleteResponseMutation = useMutation({
    mutationFn: (responseId) => base44.entities.QuestionnaireResponse.delete(responseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-responses'] });
      toast.success('Réponse supprimée - le questionnaire est de nouveau disponible pour l\'athlète');
    },
  });

  const toggleEditAthleteAssignment = (athleteEmail) => {
    const current = editingEvent.assigned_athletes || [];
    if (current.includes(athleteEmail)) {
      setEditingEvent({
        ...editingEvent,
        assigned_athletes: current.filter(e => e !== athleteEmail)
      });
    } else {
      setEditingEvent({
        ...editingEvent,
        assigned_athletes: [...current, athleteEmail]
      });
    }
  };

  const handleUpdateEvent = () => {
    if (!editingEvent.title || !editingEvent.start_time || !editingEvent.duration_minutes) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const startTime = editingEvent.start_time;
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = startMinutes + parseInt(editingEvent.duration_minutes);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    updateEventMutation.mutate({
      id: editingEvent.id,
      data: {
        ...editingEvent,
        end_time: endTime
      }
    });
  };

  const handleDeleteResponse = (responseId) => {
    if (confirm('Supprimer cette réponse ? L\'athlète pourra répondre à nouveau au questionnaire.')) {
      deleteResponseMutation.mutate(responseId);
    }
  };

  if (!user || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  const isAdmin = user.user_status === 'admin';
  const isCoach = user.user_status === 'coach' || user.user_status === 'coach_pro';
  const assignedAthletes = event.assigned_athletes || [];
  const responseCount = questionnaireResponses.length;
  const responsePercentage = assignedAthletes.length > 0 
    ? Math.round((responseCount / assignedAthletes.length) * 100) 
    : 0;

  const categoryInfo = sessionCategories.find(c => c.value === event.session_category);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link to={createPageUrl('CalendarPage')}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour au calendrier
            </Button>
          </Link>
          <Button 
            onClick={() => {
              setEditingEvent(event);
              setShowEditDialog(true);
            }}
            className="gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Modifier la séance
          </Button>
        </div>

        {/* Informations de la séance */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{event.title}</CardTitle>
                {event.theme && (
                  <p className="text-slate-600 mt-1">Thème: {event.theme}</p>
                )}
              </div>
              <div 
                className="px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: event.session_color || '#6366f1' }}
              >
                {categoryInfo?.label || event.session_category}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="font-medium">
                    {format(parseISO(event.event_date), 'EEEE d MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Horaire</p>
                  <p className="font-medium">
                    {event.start_time} - {event.end_time} ({event.duration_minutes} min)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Athlètes assignés</p>
                  <p className="font-medium">{assignedAthletes.length} athlète(s)</p>
                </div>
              </div>
              {event.description && (
                <div className="md:col-span-2">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-slate-500 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-500 mb-1">Description</p>
                      <p className="text-slate-700">{event.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Questionnaire associé */}
        {event.questionnaire_template_id && questionnaireTemplate && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Questionnaire associé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{questionnaireTemplate.name}</p>
                    <p className="text-sm text-slate-600">{questionnaireTemplate.questions?.length || 0} questions</p>
                  </div>
                  <div className="text-center">
                    <div 
                      className={`text-3xl font-bold ${
                        responsePercentage >= 80 ? 'text-green-600' :
                        responsePercentage >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}
                    >
                      {responsePercentage}%
                    </div>
                    <p className="text-sm text-slate-500">
                      {responseCount} / {assignedAthletes.length} réponses
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowResponsesDialog(true)}
                  className="w-full mt-4"
                  variant="outline"
                >
                  Voir les réponses individuelles
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Liste des athlètes assignés */}
        <Card>
          <CardHeader>
            <CardTitle>Athlètes assignés à cette séance</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedAthletes.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Aucun athlète assigné</p>
            ) : (
              <div className="space-y-2">
                {assignedAthletes.map((athleteEmail) => {
                  const athlete = athletes.find(a => a.email === athleteEmail);
                  const hasResponded = questionnaireResponses.some(r => r.athlete_email === athleteEmail && r.event_id === event.id);
                  
                  return (
                    <div 
                      key={athleteEmail}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${hasResponded ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <div>
                          <p className="font-medium">{athlete?.name || athleteEmail}</p>
                          <p className="text-sm text-slate-500">{athleteEmail}</p>
                        </div>
                      </div>
                      {hasResponded ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">A répondu</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm">En attente</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de modification */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la séance d'entraînement</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Date de la séance *</Label>
                <Input
                  type="date"
                  value={editingEvent.event_date}
                  onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Titre de la séance *</Label>
                <Input
                  placeholder="Ex: Séance de fractionné"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Thème</Label>
                <Input
                  placeholder="Ex: Endurance, Vitesse, Technique..."
                  value={editingEvent.theme || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, theme: e.target.value })}
                />
              </div>

              <div>
                <Label>Type de séance</Label>
                <div className="space-y-2">
                  {sessionCategories.map((category) => (
                    <div
                      key={category.value}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        editingEvent.session_category === category.value
                          ? 'border-slate-400 bg-slate-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setEditingEvent({
                          ...editingEvent,
                          session_category: category.value,
                          session_color: editingEvent.session_category === category.value ? editingEvent.session_color : category.defaultColor
                        });
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
                          {editingEvent.session_category === category.value && (
                            <div className="w-2 h-2 rounded-full bg-slate-700" />
                          )}
                        </div>
                        <span className="text-sm">{category.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingEvent.session_category === category.value ? editingEvent.session_color : category.defaultColor}
                          onChange={(e) => {
                            if (editingEvent.session_category === category.value) {
                              setEditingEvent({ ...editingEvent, session_color: e.target.value });
                            }
                          }}
                          className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Heure de début *</Label>
                  <Input
                    type="time"
                    value={editingEvent.start_time}
                    onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Durée (minutes) *</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 90"
                    value={editingEvent.duration_minutes}
                    onChange={(e) => setEditingEvent({ ...editingEvent, duration_minutes: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Description de la séance</Label>
                <Textarea
                  placeholder="Détails de la séance, exercices prévus..."
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <Label className="mb-3 block">Athlètes assignés</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                  {athletes.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Aucun athlète dans votre groupe
                    </p>
                  ) : (
                    athletes.map((athlete) => (
                      <div key={athlete.email} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded">
                        <Checkbox
                          id={`edit-athlete-${athlete.email}`}
                          checked={(editingEvent.assigned_athletes || []).includes(athlete.email)}
                          onCheckedChange={() => toggleEditAthleteAssignment(athlete.email)}
                        />
                        <Label
                          htmlFor={`edit-athlete-${athlete.email}`}
                          className="flex-1 cursor-pointer"
                        >
                          {athlete.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Annuler
                </Button>
                <Button onClick={handleUpdateEvent}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog des réponses */}
      <Dialog open={showResponsesDialog} onOpenChange={setShowResponsesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Réponses au questionnaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {questionnaireResponses.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Aucune réponse pour le moment</p>
            ) : (
              questionnaireResponses.map((response) => {
                const athlete = athletes.find(a => a.email === response.athlete_email);
                return (
                  <Card key={response.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{response.athlete_name}</CardTitle>
                          <p className="text-sm text-slate-500">{response.athlete_email}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Soumis le {format(new Date(response.submitted_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteResponse(response.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {questionnaireTemplate?.questions.map((question, idx) => {
                          const answer = response.responses?.[question.id];
                          return (
                            <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                              <p className="font-medium text-sm text-slate-700 mb-1">
                                {question.label}
                              </p>
                              <p className="text-slate-900">
                                {answer !== undefined && answer !== null ? answer.toString() : 'Non répondu'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
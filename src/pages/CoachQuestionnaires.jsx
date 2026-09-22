import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ClipboardList, Users, Calendar, CheckCircle2, Plus, Edit2, Trash2, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import CoachQuestionnaireAssignment from '../components/questionnaire/CoachQuestionnaireAssignment';
import QuestionnaireEditorFull from '../components/questionnaire/QuestionnaireEditorFull';

export default function CoachQuestionnaires() {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pendingMasterTemplate, setPendingMasterTemplate] = useState(null);
  const queryClient = useQueryClient();

  const isCoachPro = user?.user_status === 'coach_pro';

  const isIndividualView = localStorage.getItem('coachView') === 'individual';

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['coach-questionnaire-templates', user?.email, isIndividualView],
    queryFn: async () => {
      const [allTemplates, clubs, groups] = await Promise.all([
        base44.entities.QuestionnaireTemplate.list(),
        base44.entities.Club.list(),
        base44.entities.Group.list()
      ]);

      const coachClubs = isIndividualView ? [] : clubs.filter(c => (c.coach_emails || []).includes(user.email));
      const clubTemplateIds = new Set(
        coachClubs.flatMap(c =>
          c.default_questionnaire_template_ids?.length
            ? c.default_questionnaire_template_ids
            : c.default_questionnaire_template_id ? [c.default_questionnaire_template_id] : []
        )
      );

      const coachGroups = groups.filter(g => g.coach_email === user.email);
      const individualAthleteEmails = new Set(coachGroups.flatMap(g => g.athlete_emails || []));

      const clubAthleteEmails = new Set(
        coachClubs.flatMap(c => c.athlete_emails || [])
      );

      // IDs des masters pour lesquels le coach a déjà une copie personnalisée
      const coachCopyParentIds = new Set(
        allTemplates
          .filter(t => t.is_master_template === false && t.assigned_to_coach_email === user.email)
          .map(t => t.parent_master_template_id)
          .filter(Boolean)
      );

      return allTemplates.filter(t => {
        if (!t.is_active) return false;
        if (isIndividualView) {
          return t.created_by_email === user.email
            || t.assigned_to_coach_email === user.email
            || (t.assigned_athletes || []).some(e => individualAthleteEmails.has(e));
        }
        // Vue club : ne pas montrer les masters si le coach a déjà une copie personnalisée
        if (t.is_master_template !== false && coachCopyParentIds.has(t.id)) return false;
        return t.created_by_email === user.email
          || t.assigned_to_coach_email === user.email
          || (t.assigned_coaches || []).includes(user.email)
          || clubTemplateIds.has(t.id);
      });
    },
    enabled: !!user
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['questionnaire-responses'],
    queryFn: () => base44.entities.QuestionnaireResponse.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QuestionnaireTemplate.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coach-questionnaire-templates'] }); toast.success('Questionnaire créé'); setView('list'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuestionnaireTemplate.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coach-questionnaire-templates'] }); toast.success('Questionnaire mis à jour'); setView('list'); setSelectedTemplate(null); },
  });

  // Ouvre l'éditeur sans créer de copie immédiatement
  const handleEdit = (template) => {
    const isMasterNotOwned = template.is_master_template !== false && template.created_by_email !== user.email;
    if (isMasterNotOwned) {
      // Stocker le master original — la copie sera créée uniquement si le contenu change
      setPendingMasterTemplate(template);
      setSelectedTemplate({ ...template }); // édition locale sans sauvegarder
    } else {
      setPendingMasterTemplate(null);
      setSelectedTemplate(template);
    }
    setView('edit');
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuestionnaireTemplate.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coach-questionnaire-templates'] }); toast.success('Questionnaire supprimé'); },
  });

  const duplicateMutation = useMutation({
    mutationFn: (template) => {
      const d = { ...template, name: `${template.name} (copie)`, created_by_email: user.email };
      delete d.id; delete d.created_date; delete d.updated_date; delete d.created_by;
      return base44.entities.QuestionnaireTemplate.create(d);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coach-questionnaire-templates'] }); toast.success('Questionnaire dupliqué'); },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  // Compare deux questionnaires pour détecter de vraies modifications
  const hasRealChanges = (original, newData) => {
    const fields = ['name', 'description', 'questions', 'style'];
    for (const field of fields) {
      if (JSON.stringify(original[field]) !== JSON.stringify(newData[field])) return true;
    }
    return false;
  };

  if (view === 'create' || view === 'edit') {
    return (
      <QuestionnaireEditorFull
        user={user}
        template={selectedTemplate}
        onSave={async (data) => {
          if (view === 'edit') {
            if (pendingMasterTemplate) {
              // Vérifier si le coach a vraiment modifié quelque chose
              if (!hasRealChanges(pendingMasterTemplate, data)) {
                toast.info('Aucune modification détectée.');
                setView('list');
                setSelectedTemplate(null);
                setPendingMasterTemplate(null);
                return;
              }
              // Récupérer les athlètes gérés par l'entraîneur (groupes + clubs)
              const [allGroups, allClubs] = await Promise.all([
                base44.entities.Group.list(),
                base44.entities.Club.list()
              ]);
              const coachGroups = allGroups.filter(g => g.coach_email === user.email);
              const coachClubs = allClubs.filter(c => (c.coach_emails || []).includes(user.email));
              const coachAthleteEmails = new Set([
                ...coachGroups.flatMap(g => g.athlete_emails || []),
                ...coachClubs.flatMap(c => c.athlete_emails || [])
              ]);

              // Athlètes de l'entraîneur parmi ceux du master
              const masterAthletes = pendingMasterTemplate.assigned_athletes || [];
              const coachOwnedAthletes = masterAthletes.filter(e => coachAthleteEmails.has(e));

              // Créer la copie avec uniquement les athlètes de l'entraîneur
              await base44.entities.QuestionnaireTemplate.create({
                name: data.name ?? pendingMasterTemplate.name,
                description: data.description ?? pendingMasterTemplate.description,
                questions: data.questions,
                is_active: pendingMasterTemplate.is_active,
                style: data.style ?? pendingMasterTemplate.style,
                created_by_email: user.email,
                assigned_athletes: coachOwnedAthletes,
                assigned_coaches: [user.email],
                is_master_template: false,
                parent_master_template_id: pendingMasterTemplate.id,
                assigned_to_coach_email: user.email,
                last_modified_by_email: user.email
              });

              // Désassigner les athlètes de l'entraîneur du master original
              if (coachOwnedAthletes.length > 0) {
                const updatedMasterAthletes = masterAthletes.filter(e => !coachAthleteEmails.has(e));
                await base44.entities.QuestionnaireTemplate.update(pendingMasterTemplate.id, {
                  assigned_athletes: updatedMasterAthletes
                });
              }

              // Mettre à jour le master pour inclure ce coach
              const prevCoaches = pendingMasterTemplate.assigned_coaches || [];
              if (!prevCoaches.includes(user.email)) {
                await base44.entities.QuestionnaireTemplate.update(pendingMasterTemplate.id, {
                  assigned_coaches: [...prevCoaches, user.email]
                });
              }
              queryClient.invalidateQueries({ queryKey: ['coach-questionnaire-templates'] });
              toast.success('Questionnaire mis à jour');
              setView('list');
              setSelectedTemplate(null);
              setPendingMasterTemplate(null);
            } else {
              updateMutation.mutate({ id: selectedTemplate.id, data });
              setPendingMasterTemplate(null);
            }
          } else {
            createMutation.mutate({ ...data, created_by_email: user.email });
          }
        }}
        onCancel={() => { setView('list'); setSelectedTemplate(null); setPendingMasterTemplate(null); }}
      />
    );
  }

  // Statistiques par template
  const templateStats = templates.map(template => {
    const templateResponses = responses.filter(r => r.template_id === template.id);
    const last7Days = templateResponses.filter(r => {
      const responseDate = new Date(r.submitted_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return responseDate >= weekAgo;
    });
    return {
      ...template,
      totalResponses: templateResponses.length,
      responsesLast7Days: last7Days.length,
      lastResponseDate: templateResponses.length > 0
        ? new Date(Math.max(...templateResponses.map(r => new Date(r.submitted_date))))
        : null
    };
  });

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link to={isIndividualView ? createPageUrl('CoachHomeIndividual') : createPageUrl('CoachHome')}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Mes Questionnaires</h1>
            <p className="text-slate-600">Questionnaires créés ou assignés à votre compte</p>
          </div>
          {isCoachPro && (
            <Button onClick={() => { setSelectedTemplate(null); setView('create'); }} className="gap-2">
              <Plus className="w-4 h-4" />Nouveau questionnaire
            </Button>
          )}
        </div>

        {loadingTemplates || loadingResponses ? (
          <div className="flex items-center justify-center py-12">
            <ClipboardList className="w-8 h-8 animate-pulse text-slate-400" />
          </div>
        ) : templateStats.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun questionnaire actif</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">

            {/* Liste des questionnaires */}
            <div className="space-y-4">
              {templateStats.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-xl">{template.name}</CardTitle>
                            <Badge className="bg-green-100 text-green-700">Actif</Badge>
                            {template.created_by_email === user.email && (
                              <Badge variant="outline" className="text-xs">Créé par moi</Badge>
                            )}
                            {template.is_master_template === false && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Version personnalisée</Badge>
                            )}
                            </div>
                            {template.description && (
                            <CardDescription>{template.description}</CardDescription>
                            )}
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                              {user?.can_edit_assigned_questionnaires !== false && (
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleEdit(template)}>
                                <Edit2 className="w-3.5 h-3.5" />Modifier
                              </Button>
                              )}
                              {template.created_by_email === user.email && (
                                <>
                                  <Button variant="outline" size="icon" className="text-blue-600 hover:bg-blue-50" onClick={() => duplicateMutation.mutate(template)} title="Dupliquer">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button variant="outline" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => { if (confirm('Supprimer ce questionnaire ?')) deleteMutation.mutate(template.id); }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                            </div>
                            </CardHeader>

                            <CoachQuestionnaireAssignment template={template} coachEmail={user.email} />
                            <div className="px-6 pb-4">
                              {template.is_master_template !== false ? (
                                <p className="text-xs text-slate-400 italic">Créé par Admin</p>
                              ) : (() => {
                                const modifierEmail = template.last_modified_by_email || template.created_by_email;
                                const modifierUser = allUsers.find(u => u.email === modifierEmail);
                                const modifierName = modifierUser?.full_name || modifierEmail;
                                const isModified = !!template.last_modified_by_email;
                                return (
                                  <p className="text-xs text-slate-400 italic">
                                    {isModified ? `Modifié par ${modifierName}` : `Créé par ${modifierName}`}
                                  </p>
                                );
                              })()}
                            </div>
                            </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
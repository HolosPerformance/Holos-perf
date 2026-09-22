import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Plus, Edit2, Trash2, BarChart3, Calendar, Copy, ClipboardList, Star } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import QuestionnaireAssignmentCard from '../components/questionnaire/QuestionnaireAssignmentCard';
import QuestionnaireEditorFull from '../components/questionnaire/QuestionnaireEditorFull';
import { useAuth } from '@/lib/AuthContext';

export default function Questionnaires() {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // ── Correction : utiliser user_status au lieu de role ─────────────────────
  const isAdmin   = user?.user_status === 'admin';
  const isCoachPro = user?.user_status === 'coach_pro';
  const isCoach   = user?.user_status === 'coach' || user?.user_status === 'coach_pro';
  const canCreateQuestionnaire = isAdmin || isCoachPro;

  const { data: appSettings = [] } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSetting.list(),
    enabled: !!user,
  });

  const defaultQuestionnaireSetting = appSettings.find(s => s.key === 'default_athlete_questionnaire_id');
  const defaultQuestionnaireId = defaultQuestionnaireSetting?.value;

  const setDefaultMutation = useMutation({
    mutationFn: async (templateId) => {
      if (defaultQuestionnaireSetting) {
        return base44.entities.AppSetting.update(defaultQuestionnaireSetting.id, { value: templateId });
      } else {
        return base44.entities.AppSetting.create({ key: 'default_athlete_questionnaire_id', value: templateId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Questionnaire par défaut mis à jour');
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['questionnaire-templates'],
    queryFn: () => base44.entities.QuestionnaireTemplate.list('-created_at', 100),
    enabled: !!user,
  });

  const accessibleTemplates = templates.filter(template => {
    if (isAdmin) return true;
    if (isCoach) {
      return template.created_by_email === user?.email ||
        (template.assigned_coaches || []).includes(user?.email);
    }
    return template.assigned_athletes?.includes(user?.email);
  });

  const filteredTemplates = accessibleTemplates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QuestionnaireTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] });
      toast.success('Questionnaire créé');
      setView('list');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuestionnaireTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] });
      toast.success('Questionnaire mis à jour');
      setView('list');
      setSelectedTemplate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuestionnaireTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] });
      toast.success('Questionnaire supprimé');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (template) => {
      const d = { ...template, name: `${template.name} (copie)`, created_by_email: user.email };
      delete d.id; delete d.created_at; delete d.updated_at;
      return base44.entities.QuestionnaireTemplate.create(d);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] });
      toast.success('Questionnaire dupliqué');
    },
  });

  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-500">Chargement...</p></div>;

  if (view === 'create' || view === 'edit') {
    return (
      <QuestionnaireEditorFull
        user={user}
        template={selectedTemplate}
        onSave={(data) => {
          if (view === 'edit') {
            updateMutation.mutate({ id: selectedTemplate.id, data });
          } else {
            createMutation.mutate({ ...data, created_by_email: user.email });
          }
        }}
        onCancel={() => { setView('list'); setSelectedTemplate(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl(isAdmin ? 'AdminHome' : isCoach ? 'CoachHome' : 'AthleteHome')}>
            <Button variant="outline" className="gap-2 mb-4"><ArrowLeft className="w-4 h-4" />Retour à l'accueil</Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Bibliothèque</h1>
              <p className="text-slate-600 text-sm md:text-base">Questionnaires types adaptés aux différentes disciplines</p>
            </div>
            {canCreateQuestionnaire && (
              <div className="flex gap-2">
                {isAdmin && (
                  <Link to={createPageUrl('QuestionBank')}>
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                      <ClipboardList className="w-4 h-4" />Banque de questions
                    </Button>
                  </Link>
                )}
                <Button onClick={() => setView('create')} className="gap-2 w-full sm:w-auto">
                  <Plus className="w-4 h-4" />Nouveau questionnaire
                </Button>
              </div>
            )}
          </div>
          {canCreateQuestionnaire && templates.length > 0 && (
            <div className="mt-4">
              <Input placeholder="Rechercher un questionnaire..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {filteredTemplates.map((template, index) => (
            <motion.div key={template.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg md:text-xl">{template.name}</CardTitle>
                        <CardDescription className="text-sm">{template.questions?.length || 0} questions</CardDescription>
                        {isAdmin && template.created_by_email && (
                          <p className="text-xs text-slate-400 mt-1">Par {template.created_by_email}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={template.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-700 border-slate-200"}>
                      {template.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600 line-clamp-2">{template.description || 'Aucune description'}</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {canCreateQuestionnaire && (
                        <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={() => { setSelectedTemplate(template); setView('edit'); }}>
                          <Edit2 className="w-4 h-4" />Modifier
                        </Button>
                      )}
                      {isAdmin && (
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
                    {isAdmin && (
                      <Button
                        variant={defaultQuestionnaireId === template.id ? 'default' : 'outline'}
                        className={`w-full gap-2 text-sm ${defaultQuestionnaireId === template.id ? 'bg-yellow-500 hover:bg-yellow-600 border-yellow-500 text-white' : 'text-yellow-600 border-yellow-300 hover:bg-yellow-50'}`}
                        onClick={() => setDefaultMutation.mutate(template.id)}
                        disabled={defaultQuestionnaireId === template.id}
                      >
                        <Star className={`w-4 h-4 ${defaultQuestionnaireId === template.id ? 'fill-white' : ''}`} />
                        {defaultQuestionnaireId === template.id ? 'Questionnaire par défaut' : 'Définir comme questionnaire par défaut'}
                      </Button>
                    )}
                  </div>
                </CardContent>
                {isAdmin && <QuestionnaireAssignmentCard template={template} allTemplates={templates} onEditCopy={(copy) => { setSelectedTemplate(copy); setView('edit'); }} />}
              </Card>
            </motion.div>
          ))}

          {filteredTemplates.length === 0 && templates.length > 0 && (
            <div className="lg:col-span-2">
              <Card><CardContent className="py-12 text-center"><p className="text-slate-500 text-sm">Aucun questionnaire ne correspond à votre recherche</p></CardContent></Card>
            </div>
          )}

          {templates.length === 0 && (
            <div className="lg:col-span-1">
              <Card><CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">{canCreateQuestionnaire ? 'Créez votre premier questionnaire' : 'Aucun questionnaire disponible'}</p>
              </CardContent></Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

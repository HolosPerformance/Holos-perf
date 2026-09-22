import React, { useState, useMemo } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, CheckCircle, ChevronRight, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import CustomQuestionnaireForm from '@/components/questionnaire/CustomQuestionnaireForm';

const today = format(new Date(), 'yyyy-MM-dd');

export default function CoachFillAthleteQuestionnaire() {
  const { user: coachUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(window.location.search);
  const athleteEmail = params.get('athleteEmail') || '';

  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [filledTemplateIds, setFilledTemplateIds] = useState(new Set());

  // Charger la fiche de l'athlète
  const { data: athleteUser, isLoading: loadingAthlete } = useQuery({
    queryKey: ['athlete-user', athleteEmail],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.find(u => u.email === athleteEmail) || { email: athleteEmail, full_name: athleteEmail };
    },
    enabled: !!athleteEmail
  });

  // Charger tous les templates actifs assignés à cet athlète
  const { data: assignedTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['athlete-assigned-templates', athleteEmail],
    queryFn: async () => {
      const templates = await base44.entities.QuestionnaireTemplate.list();
      return templates.filter(t =>
        t.is_active && (t.assigned_athletes || []).includes(athleteEmail)
      );
    },
    enabled: !!athleteEmail
  });

  // Charger les réponses d'aujourd'hui pour cet athlète
  const { data: todayResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['athlete-today-responses', athleteEmail, today],
    queryFn: async () => {
      const all = await base44.entities.QuestionnaireResponse.filter({ athlete_email: athleteEmail });
      return all.filter(r => r.submitted_date?.startsWith(today));
    },
    enabled: !!athleteEmail
  });

  const respondedTemplateIds = useMemo(
    () => new Set([...todayResponses.map(r => r.template_id), ...filledTemplateIds]),
    [todayResponses, filledTemplateIds]
  );

  const responseByTemplateId = useMemo(
    () => Object.fromEntries(todayResponses.map(r => [r.template_id, r])),
    [todayResponses]
  );

  const pendingTemplates = useMemo(
    () => assignedTemplates.filter(t => !respondedTemplateIds.has(t.id)),
    [assignedTemplates, respondedTemplateIds]
  );

  const doneTemplates = useMemo(
    () => assignedTemplates.filter(t => respondedTemplateIds.has(t.id)),
    [assignedTemplates, respondedTemplateIds]
  );

  // Auto-sélectionner le premier questionnaire en attente
  const activeTemplateId = selectedTemplateId ?? pendingTemplates[0]?.id ?? null;
  const activeTemplate = assignedTemplates.find(t => t.id === activeTemplateId);
  const existingResponseId = responseByTemplateId[activeTemplateId]?.id ?? null;

  const handleSuccess = () => {
    setFilledTemplateIds(prev => {
      const next = new Set(prev);
      next.add(activeTemplateId);
      return next;
    });
    setSelectedTemplateId(null);
    queryClient.invalidateQueries({ queryKey: ['today-responses-daily'] });
    queryClient.invalidateQueries({ queryKey: ['athlete-today-responses', athleteEmail] });
  };

  const isLoading = loadingAthlete || loadingTemplates || loadingResponses;

  if (!coachUser) return null;

  const allDone = pendingTemplates.length === 0 && !selectedTemplateId;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {isLoading ? 'Chargement...' : athleteUser?.full_name || athleteEmail}
              </h1>
              <p className="text-slate-500 text-sm capitalize">
                {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <ClipboardList className="w-8 h-8 animate-pulse text-slate-300" />
          </div>
        ) : assignedTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun questionnaire assigné à cet athlète</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Sélecteur si plusieurs questionnaires */}
            {assignedTemplates.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Questionnaires</p>
                <div className="space-y-2">
                  {assignedTemplates.map(t => {
                    const done = respondedTemplateIds.has(t.id);
                    const isActive = t.id === activeTemplateId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={[
                          'w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors',
                          done
                            ? 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer'
                            : isActive
                            ? 'bg-indigo-50 border-indigo-300 cursor-pointer'
                            : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                        ].join(' ')}
                      >
                        <span className={`font-medium text-sm ${done ? 'text-green-700' : isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {t.name}
                        </span>
                        {done
                          ? <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-xs text-green-600 flex items-center gap-1"><Pencil className="w-3 h-3" />Modifier</span>
                            </div>
                          : isActive
                          ? <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">En cours</Badge>
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tous remplis */}
            {allDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="py-10 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-green-800 text-lg">
                      Tous les questionnaires ont été remplis !
                    </p>
                    <p className="text-green-600 text-sm mt-1">
                      {athleteUser?.full_name || athleteEmail} a répondu à l'ensemble des questionnaires du jour.
                    </p>
                    <div className="mt-6 flex flex-col items-center gap-3">
                      {doneTemplates.map(t => (
                        <Button
                          key={t.id}
                          variant="outline"
                          className="gap-2 border-green-300 text-green-700 hover:bg-green-100"
                          onClick={() => setSelectedTemplateId(t.id)}
                        >
                          <Pencil className="w-4 h-4" />
                          Modifier : {t.name}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        className="gap-2 mt-2"
                        onClick={() => navigate(-1)}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Retour à la liste
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Formulaire du questionnaire actif */}
            {activeTemplate && athleteUser && !allDone && (
              <motion.div
                key={activeTemplateId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CustomQuestionnaireForm
                  questionnaire={activeTemplate}
                  user={athleteUser}
                  onSuccess={handleSuccess}
                  existingResponseId={existingResponseId}
                />
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

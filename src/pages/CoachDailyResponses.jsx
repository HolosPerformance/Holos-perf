import React, { useMemo } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import ResponseTable from '@/components/questionnaire/ResponseTable';

const today = format(new Date(), 'yyyy-MM-dd');

export default function CoachDailyResponses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isIndividualView = localStorage.getItem('coachView') === 'individual';

  const { data: clubData, isLoading: loadingClub } = useQuery({
    queryKey: ['coach-club-group-responses', user?.email, isIndividualView],
    queryFn: async () => {
      const [clubs, groups] = await Promise.all([
        base44.entities.Club.list(),
        base44.entities.Group.list()
      ]);
      const club = isIndividualView ? null : clubs.find(c => (c.coach_emails || []).includes(user.email));
      const coachGroups = groups.filter(g => g.coach_email === user.email);
      return { club, coachGroups };
    },
    enabled: !!user
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['club-teams-responses', clubData?.club?.id],
    queryFn: () => base44.entities.Team.filter({ club_id: clubData.club.id }),
    enabled: !!clubData?.club?.id
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-responses'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['active-templates-responses'],
    queryFn: async () => {
      const templates = await base44.entities.QuestionnaireTemplate.list();
      return templates.filter(t => t.is_active);
    },
    enabled: !!user
  });

  const { data: todayResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['today-responses-view', today],
    queryFn: async () => {
      const all = await base44.entities.QuestionnaireResponse.list();
      return all.filter(r => r.submitted_date?.startsWith(today));
    },
    enabled: !!user
  });

  // Tous les emails d'athlètes du coach
  const allAthleteEmails = useMemo(() => {
    if (!clubData) return new Set();
    const { club, coachGroups } = clubData;
    const emails = new Set();
    if (club && !isIndividualView) {
      (club.athlete_emails || []).forEach(e => emails.add(e));
    }
    coachGroups.forEach(g => (g.athlete_emails || []).forEach(e => emails.add(e)));
    return emails;
  }, [clubData, isIndividualView]);

  // Regrouper les templates par athlètes du coach
  const templateGroups = useMemo(() => {
    const result = [];
    allTemplates.forEach(template => {
      const assigned = (template.assigned_athletes || []).filter(e => allAthleteEmails.has(e));
      if (assigned.length === 0) return;
      const athletes = assigned.map(email => {
        const u = allUsers.find(u => u.email === email);
        return { email, name: u?.full_name || email };
      }).sort((a, b) => a.name.localeCompare(b.name));
      result.push({ template, athletes });
    });
    return result;
  }, [allTemplates, allAthleteEmails, allUsers]);

  const isLoading = loadingClub || loadingTemplates || loadingResponses;

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Réponses du jour</h1>
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
        ) : templateGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun questionnaire assigné à vos athlètes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {templateGroups.map(({ template, athletes }, i) => {
              const respondedCount = athletes.filter(a =>
                todayResponses.some(r => r.athlete_email === a.email && r.template_id === template.id)
              ).length;

              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">{template.name}</h2>
                      {template.description && (
                        <p className="text-sm text-slate-500">{template.description}</p>
                      )}
                    </div>
                    <Badge
                      className={`${
                        respondedCount === athletes.length
                          ? 'bg-green-100 text-green-700'
                          : respondedCount === 0
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-orange-100 text-orange-700'
                      } border-0`}
                    >
                      {respondedCount}/{athletes.length} réponses
                    </Badge>
                  </div>
                  <ResponseTable
                    template={template}
                    athletes={athletes}
                    responses={todayResponses}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

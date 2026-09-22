import React, { useMemo, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, ClipboardList, User, ChevronRight, AlertCircle, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const today = format(new Date(), 'yyyy-MM-dd');

export default function CoachDailyQuestionnaire() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isIndividualView = localStorage.getItem('coachView') === 'individual';

  const { data: clubData, isLoading: loadingClub } = useQuery({
    queryKey: ['coach-club-group-daily', user?.email, isIndividualView],
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

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['club-teams-daily', clubData?.club?.id],
    queryFn: () => base44.entities.Team.filter({ club_id: clubData.club.id }),
    enabled: !!clubData?.club?.id
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-daily'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['active-templates-daily'],
    queryFn: async () => {
      const templates = await base44.entities.QuestionnaireTemplate.list();
      return templates.filter(t => t.is_active);
    },
    enabled: !!user
  });

  const { data: todayResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['today-responses-daily', today],
    queryFn: async () => {
      const all = await base44.entities.QuestionnaireResponse.list();
      return all.filter(r => r.submitted_date?.startsWith(today));
    },
    enabled: !!user
  });

  // Construit la liste des athlètes avec leur groupe
  const groupedAthletes = useMemo(() => {
    if (!clubData) return {};
    const { club, coachGroups } = clubData;
    const groups = {};

    if (club && !isIndividualView) {
      // Vue club : regrouper par équipe
      const mainTeamName = club.main_team_name || 'Équipe principale';
      const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

      const assignedToTeam = new Set(teams.flatMap(t => t.athlete_emails || []));

      // Athlètes dans des équipes
      teams.forEach(team => {
        if (!groups[team.name]) groups[team.name] = [];
        (team.athlete_emails || []).forEach(email => {
          const u = allUsers.find(u => u.email === email);
          groups[team.name].push({ email, name: u?.full_name || email });
        });
      });

      // Athlètes du club sans équipe
      (club.athlete_emails || []).forEach(email => {
        if (!assignedToTeam.has(email)) {
          const u = allUsers.find(u => u.email === email);
          if (!groups[mainTeamName]) groups[mainTeamName] = [];
          groups[mainTeamName].push({ email, name: u?.full_name || email });
        }
      });
    } else {
      // Vue individuelle : regrouper par groupe
      coachGroups.forEach(g => {
        if (!groups[g.name || 'Mon groupe']) groups[g.name || 'Mon groupe'] = [];
        (g.athlete_emails || []).forEach(email => {
          const u = allUsers.find(u => u.email === email);
          groups[g.name || 'Mon groupe'].push({ email, name: u?.full_name || email });
        });
      });
    }

    return groups;
  }, [clubData, teams, allUsers, isIndividualView]);

  // Enrichit chaque athlète avec son statut de réponse
  const enrichedGroups = useMemo(() => {
    const respondedByEmail = {};
    todayResponses.forEach(r => {
      if (!respondedByEmail[r.athlete_email]) respondedByEmail[r.athlete_email] = new Set();
      respondedByEmail[r.athlete_email].add(r.template_id);
    });

    return Object.fromEntries(
      Object.entries(groupedAthletes).map(([groupName, athletes]) => {
        const enriched = athletes.map(athlete => {
          const assigned = allTemplates.filter(t =>
            (t.assigned_athletes || []).includes(athlete.email)
          );
          const responded = respondedByEmail[athlete.email] || new Set();
          const pending = assigned.filter(t => !responded.has(t.id));
          return {
            ...athlete,
            assigned,
            pending,
            hasAllResponded: assigned.length > 0 && pending.length === 0,
            hasNoQuestionnaire: assigned.length === 0
          };
        });
        return [groupName, enriched];
      })
    );
  }, [groupedAthletes, allTemplates, todayResponses]);

  const totalAthletes = Object.values(enrichedGroups).flat().filter(a => !a.hasNoQuestionnaire).length;
  const totalResponded = Object.values(enrichedGroups).flat().filter(a => a.hasAllResponded).length;

  const handleAthleteClick = (athlete) => {
    if (athlete.hasNoQuestionnaire) return;
    navigate(`/CoachFillAthleteQuestionnaire?athleteEmail=${encodeURIComponent(athlete.email)}`);
  };

  const isLoading = loadingClub || loadingTemplates || loadingResponses;

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Répondre au questionnaire</h1>
              <p className="text-slate-500 text-sm capitalize">
                {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
          {!isLoading && totalAthletes > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${totalAthletes > 0 ? (totalResponded / totalAthletes) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-600">
                {totalResponded}/{totalAthletes} ont répondu
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <ClipboardList className="w-8 h-8 animate-pulse text-slate-300" />
          </div>
        ) : Object.keys(enrichedGroups).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun athlète trouvé</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(enrichedGroups).map(([groupName, athletes], gi) => (
              <motion.div
                key={groupName}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.05 }}
              >
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  {groupName}
                </h2>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {athletes.map((athlete, ai) => {
                      const clickable = !athlete.hasNoQuestionnaire;
                      return (
                        <div
                          key={athlete.email}
                          onClick={() => handleAthleteClick(athlete)}
                          className={[
                            'flex items-center justify-between p-4 transition-colors',
                            ai < athletes.length - 1 ? 'border-b border-slate-100' : '',
                            clickable ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100' : 'cursor-default',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              athlete.hasAllResponded
                                ? 'bg-green-100'
                                : athlete.hasNoQuestionnaire
                                ? 'bg-slate-100'
                                : 'bg-indigo-100'
                            }`}>
                              {athlete.hasAllResponded
                                ? <CheckCircle className="w-4 h-4 text-green-600" />
                                : <User className="w-4 h-4 text-slateigo-600" />
                              }
                            </div>
                            <div>
                              <span className={`font-medium ${
                                athlete.hasAllResponded || athlete.hasNoQuestionnaire
                                  ? 'text-slate-400'
                                  : 'text-slate-800'
                              }`}>
                                {athlete.name}
                              </span>
                              {athlete.assigned.length > 1 && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {athlete.assigned.length - athlete.pending.length}/{athlete.assigned.length} questionnaires remplis
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {athlete.hasNoQuestionnaire ? (
                              <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
                                Pas de questionnaire
                              </Badge>
                            ) : athlete.hasAllResponded ? (
                              <>
                                <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                                  A répondu
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Pencil className="w-3 h-3" />
                                  Modifier
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </>
                            ) : (
                              <>
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                                  {athlete.pending.length > 1
                                    ? `${athlete.pending.length} en attente`
                                    : 'En attente'}
                                </Badge>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

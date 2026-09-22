import React, { useMemo, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import ResponseTable from '@/components/questionnaire/ResponseTable';

export default function ClubResponses() {
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get('id');

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: club, isLoading: loadingClub } = useQuery({
    queryKey: ['club-responses-club', clubId],
    queryFn: () => base44.entities.Club.filter({ id: clubId }).then(r => r[0] || null),
    enabled: !!clubId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-club-responses'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!clubId,
  });

  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['active-templates-club-responses'],
    queryFn: async () => {
      const templates = await base44.entities.QuestionnaireTemplate.list();
      return templates.filter(t => t.is_active);
    },
    enabled: !!clubId,
  });

  const { data: dayResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['club-responses-day', clubId, selectedDate],
    queryFn: async () => {
      const all = await base44.entities.QuestionnaireResponse.list();
      return all.filter(r => r.submitted_date?.startsWith(selectedDate));
    },
    enabled: !!clubId,
  });

  const clubAthleteEmails = useMemo(() => new Set(club?.athlete_emails || []), [club]);

  const templateGroups = useMemo(() => {
    const result = [];
    allTemplates.forEach(template => {
      const assigned = (template.assigned_athletes || []).filter(e => clubAthleteEmails.has(e));
      if (assigned.length === 0) return;
      const athletes = assigned.map(email => {
        const u = allUsers.find(u => u.email === email);
        return { email, name: u?.full_name || email };
      }).sort((a, b) => a.name.localeCompare(b.name));
      result.push({ template, athletes });
    });
    return result;
  }, [allTemplates, clubAthleteEmails, allUsers]);

  const isLoading = loadingClub || loadingTemplates || loadingResponses;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to={clubId ? `${createPageUrl('ClubDetails')}?id=${clubId}` : createPageUrl('ClubManagement')}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Réponses {club?.name ? `— ${club.name}` : 'du club'}
              </h1>
              <p className="text-slate-500 text-sm capitalize">
                {format(new Date(selectedDate + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="club-responses-date" className="text-xs text-slate-500">Jour consulté</Label>
            <Input
              id="club-responses-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
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
              <p className="text-slate-500">Aucun questionnaire assigné aux athlètes de ce club</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {templateGroups.map(({ template, athletes }, i) => {
              const respondedCount = athletes.filter(a =>
                dayResponses.some(r => r.athlete_email === a.email && r.template_id === template.id)
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
                    responses={dayResponses}
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

import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, FileDown, Calendar, Users, ArrowLeft, Shield, Search, X } from 'lucide-react';
import { format, parseISO, getWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

const LARGE_EXPORT_THRESHOLD = 3000;

export default function DataExport() {
  // ── Utiliser useAuth() au lieu de recharger l'utilisateur ─────────────────
  const { user, isAdmin, isCoach } = useAuth();

  const [scopeTab, setScopeTab] = useState('athletes'); // 'athletes' | 'groups' | 'clubs'
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedClubIds, setSelectedClubIds] = useState([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0] || null;
    },
    enabled: isCoach && !!user?.email,
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club-export', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: isCoach && !!user?.email,
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ['all-groups-export'],
    queryFn: () => base44.entities.Group.list(),
    enabled: isAdmin && !!user,
  });

  const { data: allClubs = [] } = useQuery({
    queryKey: ['all-clubs-export'],
    queryFn: () => base44.entities.Club.list(),
    enabled: isAdmin && !!user,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-export'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && (isAdmin || isCoach),
  });

  const { data: allLogs = [] } = useQuery({
    queryKey: ['all-logs-export'],
    queryFn: () => base44.entities.TrainingLog.list('-training_date', 5000),
    enabled: !!user
  });

  const { data: allResponses = [] } = useQuery({
    queryKey: ['all-responses-export'],
    queryFn: () => base44.entities.QuestionnaireResponse.list('-submitted_date', 5000),
    enabled: !!user
  });

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['all-templates-export'],
    queryFn: () => base44.entities.QuestionnaireTemplate.list(),
    enabled: !!user
  });

  const coachAthleteEmailSet = new Set([
    ...(coachGroup?.athlete_emails || []),
    ...(coachClub?.athlete_emails || []),
  ]);

  const userFilteredLogs = (() => {
    if (isAdmin) return allLogs;
    if (isCoach && coachAthleteEmailSet.size > 0) return allLogs.filter(log => coachAthleteEmailSet.has(log.athlete_email));
    return allLogs;
  })();

  const userFilteredResponses = (() => {
    if (isAdmin) return allResponses;
    if (isCoach && coachAthleteEmailSet.size > 0) return allResponses.filter(resp => coachAthleteEmailSet.has(resp.athlete_email));
    return allResponses;
  })();

  // ── Liste canonique des joueurs sélectionnables ────────────────────────────
  // Basée sur les comptes "athlète" (pour ne pas dépendre de la présence de données),
  // complétée par les emails trouvés dans les séances/questionnaires (comptes historiques).
  const athletes = (() => {
    const map = new Map();
    allUsers.forEach(u => {
      if (u.user_status === 'athlete' && (!isCoach || coachAthleteEmailSet.has(u.email))) {
        map.set(u.email, u.full_name || u.email);
      }
    });
    if (isCoach) {
      coachAthleteEmailSet.forEach(email => {
        if (!map.has(email)) {
          const u = allUsers.find(x => x.email === email);
          map.set(email, u?.full_name || email);
        }
      });
    }
    userFilteredLogs.forEach(log => {
      if (!map.has(log.athlete_email)) map.set(log.athlete_email, log.athlete_name || log.athlete_email);
    });
    userFilteredResponses.forEach(resp => {
      if (!map.has(resp.athlete_email)) map.set(resp.athlete_email, resp.athlete_name || resp.athlete_email);
    });
    return [...map.entries()]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filteredAthletes = athletes.filter(a =>
    a.name.toLowerCase().includes(athleteSearch.toLowerCase()) || a.email.toLowerCase().includes(athleteSearch.toLowerCase())
  );

  const toggleEmail = (email) => {
    setSelectedEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };
  const toggleGroup = (id) => {
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };
  const toggleClub = (id) => {
    setSelectedClubIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const visibleAthleteEmails = filteredAthletes.map(a => a.email);
  const allVisibleAthletesSelected = visibleAthleteEmails.length > 0 && visibleAthleteEmails.every(e => selectedEmails.includes(e));
  const toggleSelectAllAthletes = () => {
    if (allVisibleAthletesSelected) {
      setSelectedEmails(prev => prev.filter(e => !visibleAthleteEmails.includes(e)));
    } else {
      setSelectedEmails(prev => [...new Set([...prev, ...visibleAthleteEmails])]);
    }
  };

  const allGroupIds = allGroups.map(g => g.id);
  const allGroupsSelected = allGroupIds.length > 0 && allGroupIds.every(id => selectedGroupIds.includes(id));
  const toggleSelectAllGroups = () => setSelectedGroupIds(allGroupsSelected ? [] : allGroupIds);

  const allClubIds = allClubs.map(c => c.id);
  const allClubsSelected = allClubIds.length > 0 && allClubIds.every(id => selectedClubIds.includes(id));
  const toggleSelectAllClubs = () => setSelectedClubIds(allClubsSelected ? [] : allClubIds);

  const clearSelection = () => {
    setSelectedEmails([]);
    setSelectedGroupIds([]);
    setSelectedClubIds([]);
  };

  // Union des joueurs sélectionnés individuellement, via groupe(s) ou via club(s)
  const effectiveEmailSet = (() => {
    const set = new Set(selectedEmails);
    selectedGroupIds.forEach(id => {
      const g = allGroups.find(x => x.id === id);
      (g?.athlete_emails || []).forEach(e => set.add(e));
    });
    selectedClubIds.forEach(id => {
      const c = allClubs.find(x => x.id === id);
      (c?.athlete_emails || []).forEach(e => set.add(e));
    });
    return set;
  })();

  const hasScopeSelection = effectiveEmailSet.size > 0;

  const filterData = () => {
    let filteredLogs = [...userFilteredLogs];
    let filteredResponses = [...userFilteredResponses];

    if (hasScopeSelection) {
      filteredLogs = filteredLogs.filter(log => effectiveEmailSet.has(log.athlete_email));
      filteredResponses = filteredResponses.filter(resp => effectiveEmailSet.has(resp.athlete_email));
    }
    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.training_date >= startDate);
      filteredResponses = filteredResponses.filter(resp => format(new Date(resp.submitted_date), 'yyyy-MM-dd') >= startDate);
    }
    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.training_date <= endDate);
      filteredResponses = filteredResponses.filter(resp => format(new Date(resp.submitted_date), 'yyyy-MM-dd') <= endDate);
    }

    return {
      logs: filteredLogs.sort((a, b) => new Date(b.training_date) - new Date(a.training_date)),
      responses: filteredResponses.sort((a, b) => new Date(b.submitted_date) - new Date(a.submitted_date))
    };
  };

  const exportFileLabel = (() => {
    if (!hasScopeSelection) return 'tous_athletes';
    if (effectiveEmailSet.size === 1) {
      const email = [...effectiveEmailSet][0];
      return (athletes.find(a => a.email === email)?.name || email).replace(/\s+/g, '_');
    }
    return `${effectiveEmailSet.size}_joueurs`;
  })();

  const exportToCSV = () => {
    const { logs, responses } = filterData();
    if (logs.length === 0 && responses.length === 0) { alert('Aucune donnée à exporter'); return; }

    const templateIds = new Set(responses.map(resp => resp.template_id).filter(Boolean));
    const allQuestionIds = new Set();
    const questionIdToLabel = {};
    const questionMap = {};
    allTemplates.forEach(template => {
      if (templateIds.has(template.id) && Array.isArray(template.questions)) {
        template.questions.forEach(q => {
          if (q.id) {
            allQuestionIds.add(q.id);
            questionIdToLabel[q.id] = q.label || q.athleteLabel || q.id;
            questionMap[q.id] = q;
          }
        });
      }
    });

    const questionLabels = Array.from(allQuestionIds).map(id => questionIdToLabel[id] || id);
    const baseHeaders = ['Date', 'Athlète', 'Email', 'Année', 'Mois', 'Semaine', 'Jour', 'Source'];
    const trainingLogHeaders = ['Type de séance', 'Durée (min)', 'Fatigue', 'Intensité', 'Sommeil', 'Plaisir', 'Harmonie proches', 'Maîtrise technique', 'Maîtrise tactique', 'Épanouissement', 'Commentaire'];
    const headers = [...baseHeaders, ...(logs.length > 0 ? trainingLogHeaders : []), ...questionLabels];

    const dayLabels = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

    const logRows = logs.map(log => {
      const date = parseISO(log.training_date);
      return [
        format(date, 'dd/MM/yyyy', { locale: fr }), log.athlete_name || '', log.athlete_email || '',
        format(date, 'yyyy'), format(date, 'yyMM'), `${format(date, 'yy')}${getWeek(date, { locale: fr }).toString().padStart(2, '0')}`,
        `${getDay(date) === 0 ? 7 : getDay(date)}${dayLabels[getDay(date)]}`, 'TrainingLog',
        log.session_type || '', log.duration_minutes || '', log.fatigue || '', log.intensite || '',
        log.sommeil || '', log.plaisir || '', log.harmonie_proches || '', log.maitrise_technique || '',
        log.maitrise_tactique || '', log.epanouissement || '', (log.commentaire || '').replace(/"/g, '""'),
        ...Array.from(allQuestionIds).map(() => '')
      ];
    });

    const responseRows = responses.map(resp => {
      const date = new Date(resp.submitted_date);
      return [
        format(date, 'dd/MM/yyyy', { locale: fr }), resp.athlete_name || '', resp.athlete_email || '',
        format(date, 'yyyy'), format(date, 'yyMM'), `${format(date, 'yy')}${getWeek(date, { locale: fr }).toString().padStart(2, '0')}`,
        `${getDay(date) === 0 ? 7 : getDay(date)}${dayLabels[getDay(date)]}`, 'Questionnaire',
        ...(logs.length > 0 ? ['', '', '', '', '', '', '', '', '', '', ''] : []),
        ...Array.from(allQuestionIds).map(questionId => {
          const value = resp.responses?.[questionId];
          if (value === undefined || value === null) return '';
          const question = questionMap[questionId];
          if (question?.type === 'select' && Array.isArray(value)) {
            const choices = question.selectOptions?.choices || [];
            const resolved = value.map(v => {
              const idx = parseInt(v, 10);
              return (!isNaN(idx) && choices[idx]) ? (choices[idx].label || v) : v;
            }).join('; ');
            return resolved.replace(/"/g, '""');
          }
          if (Array.isArray(value)) return value.join('; ').replace(/"/g, '""');
          return String(value).replace(/"/g, '""');
        })
      ];
    });

    const allRows = [...logRows, ...responseRows].sort((a, b) => b[0].split('/').reverse().join('').localeCompare(a[0].split('/').reverse().join('')));
    const csvContent = [headers.join(','), ...allRows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `donnees_${exportFileLabel}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const { logs, responses } = filterData();
    if (logs.length === 0 && responses.length === 0) { alert('Aucune donnée à exporter'); return; }
    const blob = new Blob([JSON.stringify({ training_logs: logs, questionnaire_responses: responses }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `donnees_${exportFileLabel}_${format(new Date(), 'yyyyMMdd')}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) return null;

  const { logs, responses } = filterData();
  const filteredCount = logs.length + responses.length;
  const isLargeExport = filteredCount > LARGE_EXPORT_THRESHOLD;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl(isAdmin ? 'AdminHome' : 'CoachHome')}>
              <Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" />Accueil</Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Export des données</h1>
          <p className="text-slate-500">Téléchargez les données d'entraînement et les réponses aux questionnaires</p>
        </div>

        <Card className="shadow-sm border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileDown className="w-5 h-5" />Configuration de l'export</CardTitle>
            <CardDescription>Sélectionnez les données à exporter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4" />Portée de l'export</Label>

              {isAdmin && (
                <div className="flex gap-2 flex-wrap pb-1">
                  <Button
                    type="button"
                    variant={scopeTab === 'athletes' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScopeTab('athletes')}
                    className={scopeTab === 'athletes' ? 'bg-slate-800 hover:bg-slate-700' : ''}
                  >
                    Joueurs
                  </Button>
                  {allGroups.length > 0 && (
                    <Button
                      type="button"
                      variant={scopeTab === 'groups' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScopeTab('groups')}
                      className={scopeTab === 'groups' ? 'bg-slate-800 hover:bg-slate-700' : ''}
                    >
                      Groupes
                    </Button>
                  )}
                  {allClubs.length > 0 && (
                    <Button
                      type="button"
                      variant={scopeTab === 'clubs' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScopeTab('clubs')}
                      className={scopeTab === 'clubs' ? 'bg-slate-800 hover:bg-slate-700' : ''}
                    >
                      Clubs
                    </Button>
                  )}
                </div>
              )}

              {/* Onglet Joueurs (coach et admin) */}
              {(!isAdmin || scopeTab === 'athletes') && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Rechercher un joueur..."
                        value={athleteSearch}
                        onChange={(e) => setAthleteSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllAthletes} disabled={visibleAthleteEmails.length === 0}>
                      {allVisibleAthletesSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Button>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-56 overflow-y-auto">
                    {filteredAthletes.length > 0 ? (
                      filteredAthletes.map(athlete => (
                        <div key={athlete.email} className="flex items-center gap-2 py-1">
                          <Checkbox
                            id={`athlete-${athlete.email}`}
                            checked={selectedEmails.includes(athlete.email)}
                            onCheckedChange={() => toggleEmail(athlete.email)}
                          />
                          <Label htmlFor={`athlete-${athlete.email}`} className="text-sm cursor-pointer font-normal">
                            {athlete.name}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-400 py-1">Aucun joueur trouvé</div>
                    )}
                  </div>
                </div>
              )}

              {/* Onglet Groupes (admin) */}
              {isAdmin && scopeTab === 'groups' && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllGroups} disabled={allGroups.length === 0}>
                      {allGroupsSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Button>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-56 overflow-y-auto">
                    {allGroups.map(group => (
                      <div key={group.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                        <Label htmlFor={`group-${group.id}`} className="text-sm cursor-pointer font-normal">
                          {group.name} ({(group.athlete_emails || []).length} joueur{(group.athlete_emails || []).length !== 1 ? 's' : ''})
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Onglet Clubs (admin) */}
              {isAdmin && scopeTab === 'clubs' && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllClubs} disabled={allClubs.length === 0}>
                      {allClubsSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Button>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-56 overflow-y-auto">
                    {allClubs.map(club => (
                      <div key={club.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`club-${club.id}`}
                          checked={selectedClubIds.includes(club.id)}
                          onCheckedChange={() => toggleClub(club.id)}
                        />
                        <Label htmlFor={`club-${club.id}`} className="text-sm cursor-pointer font-normal flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-400" />
                          {club.name} ({(club.athlete_emails || []).length} joueur{(club.athlete_emails || []).length !== 1 ? 's' : ''})
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Récapitulatif de la sélection */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-slate-600">
                    {hasScopeSelection
                      ? `${effectiveEmailSet.size} joueur${effectiveEmailSet.size !== 1 ? 's' : ''} sélectionné${effectiveEmailSet.size !== 1 ? 's' : ''}`
                      : 'Tous les joueurs accessibles'}
                  </Badge>
                  {selectedGroupIds.length > 0 && (
                    <Badge variant="outline" className="text-slate-500">{selectedGroupIds.length} groupe{selectedGroupIds.length !== 1 ? 's' : ''}</Badge>
                  )}
                  {selectedClubIds.length > 0 && (
                    <Badge variant="outline" className="text-slate-500">{selectedClubIds.length} club{selectedClubIds.length !== 1 ? 's' : ''}</Badge>
                  )}
                </div>
                {hasScopeSelection && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection} className="gap-1 text-slate-500 h-7 px-2">
                    <X className="w-3.5 h-3.5" />Réinitialiser
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />Période</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Date de début</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Date de fin</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Format d'export</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800"><span className="font-semibold">{filteredCount}</span> entrée{filteredCount !== 1 ? 's' : ''} à exporter</p>
            </div>
            {isLargeExport && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-sm text-amber-800">Export volumineux ({filteredCount} entrées) : le téléchargement peut prendre quelques instants. Vous pouvez restreindre la période ou la sélection pour l'accélérer.</p>
              </div>
            )}
            <Button onClick={exportFormat === 'csv' ? exportToCSV : exportToJSON} className="w-full bg-slate-800 hover:bg-slate-700 gap-2" size="lg" disabled={filteredCount === 0}>
              <Download className="w-5 h-5" />
              Télécharger ({exportFormat.toUpperCase()})
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

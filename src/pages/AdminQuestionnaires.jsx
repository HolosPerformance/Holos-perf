import React, { useMemo, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ClipboardCheck, ClipboardList, AlertCircle, CheckCircle, User, ChevronRight,
  Pencil, Shield, Users, Search, X,
} from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { questionnaireDay, responseDay, responseTime, DAY_START_HOUR } from '@/lib/questionnaireDay';
import { createPageUrl } from '@/utils';
import ResponseTable from '@/components/questionnaire/ResponseTable';

// Suivi des questionnaires pour les administrateurs : équivalent du
// « Questionnaire du jour » des entraîneurs, sur tous les clubs, groupes et
// athlètes. On choisit un périmètre (un club, un groupe d'entraîneur
// indépendant ou un athlète) puis :
// - « Qui a répondu » : statut de chaque athlète, et, pour le jour même,
//   saisie des réponses à sa place (page CoachFillAthleteQuestionnaire) ;
// - « Réponses » : tableau des réponses du jour consulté, par questionnaire.
// Le périmètre est gardé dans l'adresse, pour que « Retour » après une saisie
// ramène au même endroit.

const SCOPES = [
  { value: 'club', label: 'Clubs', icon: Shield },
  { value: 'group', label: 'Groupes', icon: Users },
  { value: 'athlete', label: 'Athlète', icon: User },
];

// Bornes (ISO) d'une journée de questionnaire : de 5h à 5h le lendemain
function dayBounds(day) {
  const start = new Date(`${day}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00`);
  const end = new Date(addDays(start, 1).getTime() - 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

const byName = (a, b) => a.name.localeCompare(b.name, 'fr');

export default function AdminQuestionnaires() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.user_status === 'admin';
  const today = questionnaireDay();

  const [params, setParams] = useSearchParams();
  const scope = SCOPES.some(s => s.value === params.get('scope')) ? params.get('scope') : 'club';
  const view = params.get('view') === 'responses' ? 'responses' : 'status';
  const clubId = params.get('club') || '';
  const groupId = params.get('group') || '';
  const athleteEmail = params.get('athlete') || '';
  const selectedDate = params.get('date') || today;
  const isToday = selectedDate === today;
  const [athleteSearch, setAthleteSearch] = useState('');

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value); else next.delete(key);
    });
    setParams(next, { replace: true });
  };

  const enabled = !!user && isAdmin;

  const { data: clubs = [], isLoading: loadingClubs } = useQuery({
    queryKey: ['admin-q-clubs'],
    queryFn: () => base44.entities.Club.list(),
    enabled,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['admin-q-teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled,
  });
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['admin-q-groups'],
    queryFn: () => base44.entities.Group.list(),
    enabled,
  });
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-q-users'],
    queryFn: () => base44.entities.User.list(),
    enabled,
  });
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['admin-q-templates'],
    queryFn: async () => (await base44.entities.QuestionnaireTemplate.list()).filter(t => t.is_active),
    enabled,
  });

  const userByEmail = useMemo(() => Object.fromEntries(allUsers.map(u => [u.email, u])), [allUsers]);
  const athleteOf = (email) => ({ email, name: userByEmail[email]?.full_name || email });

  const sortedClubs = useMemo(() => [...clubs].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr')), [clubs]);
  // Groupes des entraîneurs indépendants, avec le nom de l'entraîneur
  const groupOptions = useMemo(() => groups
    .map(g => ({ ...g, label: `${g.name || 'Groupe sans nom'} — ${userByEmail[g.coach_email]?.full_name || g.coach_email || 'sans entraîneur'}` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr')), [groups, userByEmail]);
  const athletes = useMemo(() => allUsers
    .filter(u => u.user_status === 'athlete')
    .map(u => ({ email: u.email, name: u.full_name || u.email }))
    .sort(byName), [allUsers]);

  // Sections affichées : équipes du club, le groupe, ou l'athlète seul
  const sections = useMemo(() => {
    if (scope === 'club') {
      const club = clubs.find(c => c.id === clubId);
      if (!club) return [];
      const clubTeams = teams.filter(t => t.club_id === club.id).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
      const inTeam = new Set(clubTeams.flatMap(t => t.athlete_emails || []));
      const result = clubTeams.map(t => ({ name: t.name || 'Équipe', athletes: (t.athlete_emails || []).map(athleteOf).sort(byName) }));
      const others = (club.athlete_emails || []).filter(e => !inTeam.has(e));
      if (others.length > 0) {
        result.unshift({ name: club.main_team_name || 'Équipe principale', athletes: others.map(athleteOf).sort(byName) });
      }
      return result.filter(s => s.athletes.length > 0);
    }
    if (scope === 'group') {
      const group = groups.find(g => g.id === groupId);
      if (!group) return [];
      return [{ name: group.name || 'Groupe', athletes: (group.athlete_emails || []).map(athleteOf).sort(byName) }]
        .filter(s => s.athletes.length > 0);
    }
    return athleteEmail ? [{ name: 'Athlète', athletes: [athleteOf(athleteEmail)] }] : [];
  }, [scope, clubId, groupId, athleteEmail, clubs, teams, groups, userByEmail]);

  const scopeEmails = useMemo(
    () => [...new Set(sections.flatMap(s => s.athletes.map(a => a.email)))].sort(),
    [sections]
  );

  // Réponses du jour consulté, limitées au périmètre et filtrées côté serveur
  // (la base plafonne chaque lecture à 1000 lignes)
  const { data: dayResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['admin-questionnaire-responses', selectedDate, scopeEmails.join('|')],
    queryFn: async () => {
      const { from, to } = dayBounds(selectedDate);
      const rows = await base44.entities.QuestionnaireResponse.filterIn(
        'athlete_email', scopeEmails, '-submitted_date', { column: 'submitted_date', from, to }
      );
      return rows.filter(r => responseDay(r) === selectedDate);
    },
    enabled: enabled && scopeEmails.length > 0,
  });

  // Statut de chaque athlète : questionnaires assignés, remplis, en attente
  const enrichedSections = useMemo(() => {
    const responsesByEmail = {};
    dayResponses.forEach(r => {
      (responsesByEmail[r.athlete_email] ||= []).push(r);
    });
    return sections.map(section => ({
      ...section,
      athletes: section.athletes.map(athlete => {
        const assigned = templates.filter(t => (t.assigned_athletes || []).includes(athlete.email));
        const responses = responsesByEmail[athlete.email] || [];
        const respondedIds = new Set(responses.map(r => r.template_id));
        const pending = assigned.filter(t => !respondedIds.has(t.id));
        // Heure de la dernière réponse du jour
        const times = responses.map(responseTime).filter(Boolean).sort();
        return {
          ...athlete,
          assigned,
          pending,
          lastTime: times[times.length - 1] || null,
          hasAllResponded: assigned.length > 0 && pending.length === 0,
          hasNoQuestionnaire: assigned.length === 0,
        };
      }),
    }));
  }, [sections, templates, dayResponses]);

  // Vue « Réponses » : un tableau par questionnaire assigné dans le périmètre
  const templateGroups = useMemo(() => {
    const inScope = new Set(scopeEmails);
    return templates
      .map(template => ({
        template,
        athletes: (template.assigned_athletes || []).filter(e => inScope.has(e)).map(athleteOf).sort(byName),
      }))
      .filter(g => g.athletes.length > 0)
      .sort((a, b) => (a.template.name || '').localeCompare(b.template.name || '', 'fr'));
  }, [templates, scopeEmails, userByEmail]);

  const tracked = enrichedSections.flatMap(s => s.athletes).filter(a => !a.hasNoQuestionnaire);
  const totalTracked = new Set(tracked.map(a => a.email)).size;
  const totalResponded = new Set(tracked.filter(a => a.hasAllResponded).map(a => a.email)).size;

  const athleteMatches = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return [];
    return athletes.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)).slice(0, 20);
  }, [athleteSearch, athletes]);

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Page réservée aux administrateurs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loadingScope = loadingClubs || loadingGroups || loadingUsers || loadingTemplates;
  const isLoading = loadingScope || (scopeEmails.length > 0 && loadingResponses);
  const hasScope = scope === 'club' ? !!clubId : scope === 'group' ? !!groupId : !!athleteEmail;
  const selectedAthlete = athleteEmail ? athleteOf(athleteEmail) : null;

  const openFill = (athlete) => {
    if (athlete.hasNoQuestionnaire || !isToday) return;
    navigate(`/CoachFillAthleteQuestionnaire?athleteEmail=${encodeURIComponent(athlete.email)}`);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl('AdminHome')}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
        </div>

        {/* En-tête : titre et jour consulté */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Suivi des questionnaires</h1>
              <p className="text-slate-500 text-sm capitalize">
                {format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: fr })}
                {isToday && <span className="normal-case"> · aujourd&apos;hui</span>}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-q-date" className="text-xs text-slate-500">Jour consulté</Label>
            <div className="flex items-center gap-2">
              <Input
                id="admin-q-date"
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => setParam({ date: e.target.value && e.target.value !== today ? e.target.value : '' })}
                className="w-44"
              />
              {!isToday && (
                <Button variant="outline" size="sm" onClick={() => setParam({ date: '' })}>
                  Aujourd&apos;hui
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Choix du périmètre */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <Tabs value={scope} onValueChange={(v) => setParam({ scope: v === 'club' ? '' : v })}>
              <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid">
                {SCOPES.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-2">
                    <Icon className="w-4 h-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {scope === 'club' && (
              <Select value={clubId} onValueChange={(v) => setParam({ club: v })}>
                <SelectTrigger className="w-full sm:w-96"><SelectValue placeholder="Choisir un club" /></SelectTrigger>
                <SelectContent>
                  {sortedClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {scope === 'group' && (
              groupOptions.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun groupe d&apos;entraîneur indépendant.</p>
              ) : (
                <Select value={groupId} onValueChange={(v) => setParam({ group: v })}>
                  <SelectTrigger className="w-full sm:w-96"><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
                  <SelectContent>
                    {groupOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )
            )}

            {scope === 'athlete' && (
              selectedAthlete ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm py-1 px-3 gap-2">
                    <User className="w-3.5 h-3.5" />
                    {selectedAthlete.name}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setParam({ athlete: '' })} className="gap-1 text-slate-500">
                    <X className="w-4 h-4" />
                    Changer
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative w-full sm:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={athleteSearch}
                      onChange={(e) => setAthleteSearch(e.target.value)}
                      placeholder="Rechercher un athlète (nom ou email)"
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  {athleteSearch.trim() && (
                    athleteMatches.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucun athlète trouvé.</p>
                    ) : (
                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto w-full sm:w-96">
                        {athleteMatches.map(a => (
                          <button
                            key={a.email}
                            type="button"
                            onClick={() => { setParam({ athlete: a.email }); setAthleteSearch(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50"
                          >
                            <span className="block text-sm font-medium text-slate-800">{a.name}</span>
                            <span className="block text-xs text-slate-500">{a.email}</span>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {!hasScope ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {scope === 'club' ? 'Choisissez un club.' : scope === 'group' ? 'Choisissez un groupe.' : 'Recherchez un athlète.'}
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <ClipboardList className="w-8 h-8 animate-pulse text-slate-300" />
          </div>
        ) : sections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun athlète dans ce périmètre.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Vue et progression */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Tabs value={view} onValueChange={(v) => setParam({ view: v === 'status' ? '' : v })}>
                <TabsList>
                  <TabsTrigger value="status">Qui a répondu</TabsTrigger>
                  <TabsTrigger value="responses">Réponses</TabsTrigger>
                </TabsList>
              </Tabs>
              {totalTracked > 0 && (
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${(totalResponded / totalTracked) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                    {totalResponded}/{totalTracked} ont répondu
                  </span>
                </div>
              )}
            </div>

            {view === 'status' ? (
              <div className="space-y-6">
                {!isToday && (
                  <p className="text-xs text-slate-500">
                    Jour passé : consultation seule. La saisie à la place d&apos;un athlète se fait le jour même.
                  </p>
                )}
                {enrichedSections.map(section => (
                  <div key={section.name}>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                      {section.name}
                    </h2>
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        {section.athletes.map((athlete, ai) => {
                          const clickable = isToday && !athlete.hasNoQuestionnaire;
                          return (
                            <div
                              key={athlete.email}
                              onClick={() => openFill(athlete)}
                              className={[
                                'flex items-center justify-between gap-3 p-4 transition-colors',
                                ai < section.athletes.length - 1 ? 'border-b border-slate-100' : '',
                                clickable ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100' : 'cursor-default',
                              ].join(' ')}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                  athlete.hasAllResponded ? 'bg-green-100' : athlete.hasNoQuestionnaire ? 'bg-slate-100' : 'bg-indigo-100'
                                }`}>
                                  {athlete.hasAllResponded
                                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                                    : <User className="w-4 h-4 text-indigo-600" />}
                                </div>
                                <div className="min-w-0">
                                  <span className={`font-medium ${athlete.hasNoQuestionnaire ? 'text-slate-400' : 'text-slate-800'}`}>
                                    {athlete.name}
                                  </span>
                                  {(athlete.assigned.length > 1 || athlete.lastTime) && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {athlete.assigned.length > 1 && `${athlete.assigned.length - athlete.pending.length}/${athlete.assigned.length} questionnaires remplis`}
                                      {athlete.assigned.length > 1 && athlete.lastTime && ' · '}
                                      {athlete.lastTime && `dernière réponse à ${athlete.lastTime}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {athlete.hasNoQuestionnaire ? (
                                  <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
                                    Pas de questionnaire
                                  </Badge>
                                ) : athlete.hasAllResponded ? (
                                  <>
                                    <Badge className="bg-green-100 text-green-700 border-0 text-xs">A répondu</Badge>
                                    {isToday && (
                                      <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
                                        <Pencil className="w-3 h-3" />
                                        Modifier
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                                      {athlete.pending.length > 1 ? `${athlete.pending.length} en attente` : isToday ? 'En attente' : 'Pas répondu'}
                                    </Badge>
                                    {isToday && <span className="hidden sm:inline text-xs text-slate-500">Remplir</span>}
                                  </>
                                )}
                                {clickable && <ChevronRight className="w-4 h-4 text-slate-400" />}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            ) : templateGroups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucun questionnaire assigné dans ce périmètre.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-10">
                {templateGroups.map(({ template, athletes: assignedAthletes }) => {
                  const respondedCount = assignedAthletes.filter(a =>
                    dayResponses.some(r => r.athlete_email === a.email && r.template_id === template.id)
                  ).length;
                  return (
                    <div key={template.id}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-800">{template.name}</h2>
                          {template.description && <p className="text-sm text-slate-500">{template.description}</p>}
                        </div>
                        <Badge
                          className={`${
                            respondedCount === assignedAthletes.length
                              ? 'bg-green-100 text-green-700'
                              : respondedCount === 0
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-orange-100 text-orange-700'
                          } border-0 shrink-0`}
                        >
                          {respondedCount}/{assignedAthletes.length} réponses
                        </Badge>
                      </div>
                      <ResponseTable template={template} athletes={assignedAthletes} responses={dayResponses} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

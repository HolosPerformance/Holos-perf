import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, HeartPulse, Search, User, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/medical/StatusBadge';
import InjuryForm from '@/components/medical/InjuryForm';
import MedicalAthleteSheet from '@/components/medical/MedicalAthleteSheet';
import MarkerTrendsTable from '@/components/medical/MarkerTrendsTable';
import PainReports from '@/components/medical/PainReports';
import { extractMarkerData, athleteTrends, shiftDay, TRENDS_LOOKBACK_DAYS } from '@/lib/markerTrends';
import { questionnaireDay } from '@/lib/questionnaireDay';
import {
  INJURY_STATUSES, AVAILABLE_STATUS, INJURY_TYPES, BODY_LOCATIONS,
  labelOf, formatDate, daysBetween,
} from '@/lib/medical';

const STATUS_FILTERS = [AVAILABLE_STATUS, ...INJURY_STATUSES];

export default function MedicalPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.user_status === 'admin';
  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';
  const isStaff = isAdmin || isCoach;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | club:<id> | group:<id>
  const [excludedTeamIds, setExcludedTeamIds] = useState([]); // équipes décochées (aucune = toutes)
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [formState, setFormState] = useState(null); // { injury?: object, prefill?: object }
  const [tab, setTab] = useState('list'); // 'list' | 'markers'
  const [focusMarker, setFocusMarker] = useState(null); // marqueur affiché à l'ouverture de la fiche
  const today = questionnaireDay();

  // ─── Périmètre : clubs, équipes et groupes (tous pour l'admin, encadrés pour un coach) ──
  const { data: scopes = { clubs: [], teams: [], groups: [] } } = useQuery({
    queryKey: ['medical-scopes', user?.email, isAdmin],
    queryFn: async () => {
      const [clubs, teams, groups] = await Promise.all([
        base44.entities.Club.list('name'),
        base44.entities.Team.list('name'),
        isAdmin ? base44.entities.Group.list('name') : base44.entities.Group.filter({ coach_email: user.email }, 'name'),
      ]);
      const mine = (c) => isAdmin || (c.coach_emails || []).includes(user.email);
      const myClubs = clubs.filter(mine);
      const myClubIds = new Set(myClubs.map(c => c.id));
      // Coach : équipes qu'il encadre directement + toutes celles de ses clubs
      const myTeams = teams.filter(t => mine(t) || myClubIds.has(t.club_id));
      // L'équipe principale d'un club n'existe pas en base : ce sont les
      // athlètes du club rattachés à aucune de ses équipes (cf. ClubTeamsSection)
      const mainTeams = myClubs
        .filter(c => myTeams.some(t => t.club_id === c.id))
        .map(c => {
          const inTeams = new Set(teams.filter(t => t.club_id === c.id).flatMap(t => t.athlete_emails || []));
          return {
            id: `main:${c.id}`, club_id: c.id, label: c.main_team_name || 'Équipe principale',
            emails: (c.athlete_emails || []).filter(e => !inTeams.has(e)),
          };
        });
      return {
        clubs: myClubs.map(c => ({ key: `club:${c.id}`, id: c.id, label: `Club · ${c.name}`, emails: c.athlete_emails || [] })),
        teams: [
          ...mainTeams,
          ...myTeams.map(t => ({ id: t.id, club_id: t.club_id, label: t.name, emails: t.athlete_emails || [] })),
        ],
        groups: groups.map(g => ({ key: `group:${g.id}`, id: g.id, label: `Groupe · ${g.name}`, emails: g.athlete_emails || [] })),
      };
    },
    enabled: isStaff && !!user?.email,
  });

  // Menu club / groupe : toujours pour l'admin, pour un coach seulement s'il a
  // plusieurs clubs ou plusieurs groupes
  const scopeOptions = [...scopes.clubs, ...scopes.groups];
  const showScopeSelect = isAdmin
    ? scopeOptions.length > 0
    : scopes.clubs.length > 1 || scopes.groups.length > 1;
  const selectedScope = scopeOptions.find(s => s.key === scopeFilter) || null;

  // Filtre équipes (à cocher) : équipes du club choisi ; sans club choisi,
  // toutes les équipes du coach (l'admin doit d'abord choisir un club)
  const teamOptions = selectedScope?.key.startsWith('club:')
    ? scopes.teams.filter(t => t.club_id === selectedScope.id)
    : !selectedScope && !isAdmin ? scopes.teams : [];
  const showTeamFilter = teamOptions.length > 1;
  const selectedTeams = teamOptions.filter(t => !excludedTeamIds.includes(t.id));
  const allTeamsSelected = selectedTeams.length === teamOptions.length;
  const selectedTeamEmails = new Set(selectedTeams.flatMap(t => t.emails));

  const toggleTeam = (id) => setExcludedTeamIds(prev =>
    prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const toggleAllTeams = () => setExcludedTeamIds(allTeamsSelected ? teamOptions.map(t => t.id) : []);
  const changeScope = (value) => { setScopeFilter(value); setExcludedTeamIds([]); };

  const { data: users = [] } = useQuery({
    queryKey: ['medical-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isStaff,
  });

  const { data: athleteProfiles = [] } = useQuery({
    queryKey: ['medical-athlete-profiles'],
    queryFn: () => base44.entities.AthleteProfile.list(),
    enabled: isStaff,
  });

  const { data: injuries = [], isLoading: loadingInjuries } = useQuery({
    queryKey: ['injuries'],
    queryFn: () => base44.entities.Injury.list('-injury_date'),
    enabled: isStaff,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['medical-templates'],
    queryFn: () => base44.entities.QuestionnaireTemplate.list(),
    enabled: isStaff,
  });

  // ─── Athlètes visibles ────────────────────────────────────────────────────────
  const athletes = useMemo(() => {
    const usersByEmail = new Map(users.map(u => [u.email, u]));
    const profilesByEmail = new Map(athleteProfiles.map(p => [p.athlete_email, p]));
    const emails = isAdmin
      ? users.filter(u => u.user_status === 'athlete').map(u => u.email)
      : [...new Set([...scopes.clubs, ...scopes.teams, ...scopes.groups].flatMap(s => s.emails))];

    return emails.map(email => {
      const u = usersByEmail.get(email) || {};
      const profile = profilesByEmail.get(email);
      const name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ')
        || profile?.athlete_name || email;
      const athleteInjuries = injuries.filter(i => i.athlete_email === email);
      return {
        email, name, profile, avatar_url: u.avatar_url, birth_date: u.birth_date,
        injuries: athleteInjuries,
        current: athleteInjuries.find(i => !i.end_date) || null,
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [users, athleteProfiles, injuries, scopes, isAdmin]);

  // ─── Questionnaires récents de tous les athlètes visibles (suivi des marqueurs, douleurs) ──
  const athleteEmailsKey = athletes.map(a => a.email).sort().join(',');
  const { data: recentRaw, isLoading: loadingRecent } = useQuery({
    queryKey: ['medical-recent-questionnaires', athleteEmailsKey, today],
    queryFn: async () => {
      const emails = athleteEmailsKey.split(',');
      const from = shiftDay(today, -TRENDS_LOOKBACK_DAYS);
      const [responses, trainingLogs] = await Promise.all([
        base44.entities.QuestionnaireResponse.filterIn('athlete_email', emails, '-submitted_date', { column: 'submitted_date', from }),
        base44.entities.TrainingLog.filterIn('athlete_email', emails, '-training_date', { column: 'training_date', from }),
      ]);
      return { responses, trainingLogs };
    },
    enabled: isStaff && athletes.length > 0,
  });
  const recentData = useMemo(
    () => extractMarkerData({ ...(recentRaw || {}), templates }),
    [recentRaw, templates]
  );
  const trends = useMemo(() => {
    const out = {};
    for (const a of athletes) out[a.email] = athleteTrends(recentData.series.get(a.email), recentData.markers, today);
    return out;
  }, [athletes, recentData, today]);

  // Historique complet de l'athlète ouvert (graphiques de la fiche)
  const { data: selectedRaw, isLoading: loadingSelected } = useQuery({
    queryKey: ['medical-athlete-questionnaires', selectedEmail],
    queryFn: async () => {
      const [responses, trainingLogs] = await Promise.all([
        base44.entities.QuestionnaireResponse.filterIn('athlete_email', [selectedEmail], '-submitted_date'),
        base44.entities.TrainingLog.filterIn('athlete_email', [selectedEmail], '-training_date'),
      ]);
      return { responses, trainingLogs };
    },
    enabled: isStaff && !!selectedEmail,
  });
  const selectedMarkerData = useMemo(
    () => (selectedRaw ? extractMarkerData({ ...selectedRaw, templates }) : null),
    [selectedRaw, templates]
  );

  const openSheet = (email, markerKey = null) => { setFocusMarker(markerKey); setSelectedEmail(email); };
  const createFromPain = (email, zone) => {
    openSheet(email);
    setFormState({
      prefill: {
        body_location: zone.location,
        side: zone.side,
        notes: `Douleur signalée par l'athlète : ${zone.fullLabel}${zone.intensity != null ? ` (${zone.intensity}/10)` : ''}`,
      },
    });
  };

  // Athlètes du club / groupe / équipes sélectionnés : base des compteurs et de la liste
  // (toutes les équipes cochées : pas de restriction, athlètes sans équipe compris)
  const scoped = athletes.filter(a =>
    (!selectedScope || selectedScope.emails.includes(a.email))
    && (!showTeamFilter || allTeamsSelected || selectedTeamEmails.has(a.email)));

  const counts = Object.fromEntries(STATUS_FILTERS.map(s => [s.value, 0]));
  for (const a of scoped) counts[a.current?.status || AVAILABLE_STATUS.value]++;

  const q = search.trim().toLowerCase();
  const filtered = scoped.filter(a => {
    if (statusFilter !== 'all' && (a.current?.status || AVAILABLE_STATUS.value) !== statusFilter) return false;
    if (q && !a.name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false;
    return true;
  });

  const selected = athletes.find(a => a.email === selectedEmail) || null;

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['injuries'] });
  const onError = (e) => toast.error(e.message);

  const saveInjury = useMutation({
    mutationFn: async ({ id, payload }) => {
      if (id) return base44.entities.Injury.update(id, payload);
      return base44.entities.Injury.create({
        ...payload,
        athlete_email: selectedEmail,
        created_by: user.email,
        status_history: [{ status: payload.status, date: payload.injury_date }],
      });
    },
    onSuccess: (_, { id }) => {
      toast.success(id ? 'Blessure mise à jour' : 'Fiche blessure créée');
      setFormState(null);
      invalidate();
    },
    onError,
  });

  const updateInjury = useMutation({
    mutationFn: ({ id, payload }) => base44.entities.Injury.update(id, payload),
    onSuccess: () => { toast.success('Fiche mise à jour'); invalidate(); },
    onError,
  });

  const deleteInjury = useMutation({
    mutationFn: (id) => base44.entities.Injury.delete(id),
    onSuccess: () => { toast.success('Blessure supprimée'); invalidate(); },
    onError,
  });

  const handleChangeStatus = (injury, status, date, note) => {
    const entry = { status, date, ...(note ? { note } : {}) };
    updateInjury.mutate({
      id: injury.id,
      payload: { status, status_history: [...(injury.status_history || []), entry] },
    });
  };

  const handleCloseInjury = (injury, endDate) => {
    updateInjury.mutate({
      id: injury.id,
      payload: {
        end_date: endDate,
        status_history: [...(injury.status_history || []), { status: AVAILABLE_STATUS.value, date: endDate }],
      },
    });
  };

  const handleDeleteInjury = (injury) => {
    if (window.confirm('Supprimer définitivement cette blessure et son historique ?')) deleteInjury.mutate(injury.id);
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 animate-pulse text-slate-400" />
      </div>
    );
  }
  if (!isStaff) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Médical</h1>
            <p className="text-slate-500 text-sm">Suivi des blessures et de la disponibilité des athlètes</p>
          </div>
        </div>

        {/* Compteurs par statut (cliquables pour filtrer) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STATUS_FILTERS.map(s => (
            <button key={s.value} type="button"
              onClick={() => setStatusFilter(f => (f === s.value ? 'all' : s.value))}
              className={`text-left rounded-xl border bg-white p-4 shadow-sm transition ${statusFilter === s.value ? 'ring-2 ring-slate-800' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-1">{counts[s.value] || 0}</p>
            </button>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Rechercher un athlète…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {showScopeSelect && (
            <Select value={scopeFilter} onValueChange={changeScope}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAdmin ? 'Tous les athlètes' : 'Tous mes athlètes'}</SelectItem>
                {scopeOptions.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUS_FILTERS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Équipes affichées (à cocher / décocher) */}
        {showTeamFilter && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 mr-1">Équipes :</span>
            <button type="button" onClick={toggleAllTeams}
              className={`px-3 py-1.5 rounded-full border text-sm transition ${allTeamsSelected ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Toutes
            </button>
            {teamOptions.map(t => {
              const on = !excludedTeamIds.includes(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggleTeam(t.id)} aria-pressed={on}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition ${on ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {on && <Check className="w-3.5 h-3.5" />}{t.label}
                </button>
              );
            })}
          </div>
        )}

        <PainReports athletes={scoped} pains={recentData.pains} today={today}
          onCreate={createFromPain} onOpen={(email) => openSheet(email)} />

        {/* Onglets */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          {[['list', 'Liste médicale'], ['markers', 'Suivi des marqueurs']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setTab(value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'markers' ? (
          <MarkerTrendsTable athletes={filtered} markers={recentData.markers} trends={trends}
            loading={loadingRecent} onOpen={openSheet} />
        ) : (
        /* Liste des athlètes */
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {loadingInjuries ? (
              <div className="p-8 flex justify-center"><Activity className="w-6 h-6 animate-pulse text-slate-400" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-slate-500">Aucun athlète.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Athlète</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Blessure</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Début</th>
                      <th className="text-left px-4 py-3 hidden lg:table-cell">Retour prévu</th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">Jours</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(a => (
                      <tr key={a.email} className="hover:bg-slate-50 cursor-pointer" onClick={() => openSheet(a.email)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {a.profile?.photo_url || a.avatar_url ? (
                              <img src={a.profile?.photo_url || a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <span className="font-medium text-slate-800">{a.name}</span>
                            {trends[a.email]?.alerts > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-700 text-xs font-semibold"
                                title="Marqueurs à surveiller (voir « Suivi des marqueurs »)">
                                <AlertTriangle className="w-3.5 h-3.5" />{trends[a.email].alerts}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={a.current?.status} /></td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                          {a.current ? `${labelOf(INJURY_TYPES, a.current.injury_type)} · ${labelOf(BODY_LOCATIONS, a.current.body_location)}` : '—'}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-slate-600">{a.current ? formatDate(a.current.injury_date) : '—'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{a.current ? formatDate(a.current.expected_return_date) : '—'}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-right text-slate-600">{a.current ? `${daysBetween(a.current.injury_date)} j` : '—'}</td>
                        <td className="px-2 py-3 text-slate-400"><ChevronRight className="w-4 h-4" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      <MedicalAthleteSheet
        key={`${selectedEmail || 'none'}|${focusMarker || ''}`}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelectedEmail(null); }}
        athlete={selected}
        injuries={selected?.injuries || []}
        saving={updateInjury.isPending}
        onNewInjury={() => setFormState({})}
        onEditInjury={(injury) => setFormState({ injury })}
        onChangeStatus={handleChangeStatus}
        onCloseInjury={handleCloseInjury}
        onDeleteInjury={handleDeleteInjury}
        markerData={selectedMarkerData}
        loadingMarkers={loadingSelected}
        focusMarker={focusMarker}
      />

      {formState && (
        <InjuryForm
          open
          onOpenChange={(o) => { if (!o) setFormState(null); }}
          injury={formState.injury}
          prefill={formState.prefill}
          athleteName={selected?.name}
          saving={saveInjury.isPending}
          onSubmit={(payload) => saveInjury.mutate({ id: formState.injury?.id, payload })}
        />
      )}
    </div>
  );
}

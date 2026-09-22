import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Filter } from 'lucide-react';
import EventCalendar from '../components/calendar/EventCalendar';
import CoachCalendar from '../components/calendar/CoachCalendar';
import { useAuth } from '@/lib/AuthContext';

export default function CalendarPage() {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [filterValue, setFilterValue] = useState('');

  const isAdmin  = user?.user_status === 'admin';
  const isCoach  = user?.user_status === 'coach' || user?.user_status === 'coach_pro';

  // Admin et coachs ont accès au CoachCalendar
  const hasCoachAccess = isAdmin || isCoach;

  // Groupes et clubs pour le filtre admin
  const { data: allGroups = [] } = useQuery({
    queryKey: ['admin-groups-calendar'],
    queryFn: () => base44.entities.Group.list(),
    enabled: !!user?.email && isAdmin,
  });

  const { data: allClubs = [] } = useQuery({
    queryKey: ['admin-clubs-calendar'],
    queryFn: () => base44.entities.Club.list(),
    enabled: !!user?.email && isAdmin,
  });

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0] || null;
    },
    enabled: !!user?.email && isCoach,
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club-calendar', user?.email],
    queryFn: async () => {
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: !!user?.email && isCoach,
  });

  // Groupes propres du coach (hors "Groupe Principal"), pour la sélection rapide lors de l'assignation d'athlètes
  const { data: coachOwnGroups = [] } = useQuery({
    queryKey: ['coach-own-groups', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups.filter(g => g.name !== 'Groupe Principal');
    },
    enabled: !!user?.email && isCoach,
  });

  // Charger tous les utilisateurs pour résoudre les noms réels
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-calendar'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user?.email && hasCoachAccess,
  });

  const athletes = (() => {
    if (!hasCoachAccess) return [];

    if (isAdmin) {
      return allUsers
        .filter(u => u.user_status === 'athlete')
        .map(u => ({ email: u.email, name: u.full_name || u.email }));
    }

    // Coach : selon la vue sélectionnée
    const coachView = localStorage.getItem('coachView') || 'club';
    let emails = [];
    if (coachView === 'club' && coachClub) {
      emails = coachClub.athlete_emails || [];
    } else {
      emails = coachGroup?.athlete_emails || [];
    }
    return emails.map(email => {
      const u = allUsers.find(u => u.email === email);
      return { email, name: u?.full_name || email };
    });
  })();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  const homeUrl = isAdmin ? 'AdminHome' : isCoach ? 'CoachHome' : 'AthleteHome';

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl(homeUrl)}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">
            {hasCoachAccess ? 'Calendrier des Séances' : 'Mon Calendrier'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isAdmin
              ? 'Toutes les séances créées sur l\'application, filtrables par groupe, club ou athlète'
              : hasCoachAccess ? 'Planifiez et gérez les séances de vos athlètes' : 'Gérez vos événements personnels'}
          </p>
        </div>

        {isAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Filtrer par</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex border rounded-lg overflow-hidden">
                  {['all', 'group', 'club', 'athlete'].map(type => (
                    <button
                      key={type}
                      onClick={() => { setFilterType(type); setFilterValue(''); }}
                      className={`px-3 py-1.5 text-sm transition-colors ${filterType === type ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                    >
                      {type === 'all' ? 'Tous' : type === 'group' ? 'Groupe' : type === 'club' ? 'Club' : 'Athlète'}
                    </button>
                  ))}
                </div>
                {filterType === 'group' && (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-52"><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
                    <SelectContent>{allGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {filterType === 'club' && (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-52"><SelectValue placeholder="Choisir un club" /></SelectTrigger>
                    <SelectContent>{allClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {filterType === 'athlete' && (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-52"><SelectValue placeholder="Choisir un athlète" /></SelectTrigger>
                    <SelectContent>{athletes.map(a => <SelectItem key={a.email} value={a.email}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {hasCoachAccess ? (
          <CoachCalendar
            coachEmail={user.email}
            athletes={athletes}
            isAdmin={isAdmin}
            filterType={filterType}
            filterValue={filterValue}
            allGroups={allGroups}
            allClubs={allClubs}
            coachClub={coachClub}
            coachOwnGroups={coachOwnGroups}
          />
        ) : (
          <EventCalendar userEmail={user.email} />
        )}
      </div>
    </div>
  );
}

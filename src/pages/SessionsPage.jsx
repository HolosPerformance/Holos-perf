import React, { useState, useMemo, useEffect } from 'react';
import SessionDetailModal from '../components/sessions/SessionDetailModal';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChevronLeft, ChevronDown, ChevronUp, Users, Filter } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createPageUrl } from '@/utils';

const PAGE_SIZE = 5;

const SESSION_CATEGORY_LABELS = {
  seance_terrain: 'Terrain',
  seance_salle: 'Salle',
  recuperation: 'Récupération',
  soins: 'Soins',
  seance_specifique: 'Spécifique',
  competition: 'Compétition',
};

function SessionCard({ event, onClick }) {
  const date = parseISO(event.event_date);
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-lg hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: event.session_color || '#6366f1' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-800 truncate">{event.title}</h3>
          {event.session_category && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {SESSION_CATEGORY_LABELS[event.session_category] || event.session_category}
            </Badge>
          )}
        </div>
        {event.theme && <p className="text-sm text-slate-500 mt-0.5">Thème : {event.theme}</p>}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}{event.duration_minutes ? ` (${event.duration_minutes} min)` : ''}
          </span>
          {event.assigned_athletes?.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {event.assigned_athletes.length} athlète(s)
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description}</p>
        )}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterValue, setFilterValue] = useState('');

  const isAdmin = user?.user_status === 'admin';

  const [visibleFutureCount, setVisibleFutureCount] = useState(PAGE_SIZE);
  const [visiblePastCount, setVisiblePastCount] = useState(PAGE_SIZE);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && isAdmin,
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => base44.entities.Group.list(),
    enabled: !!user && isAdmin,
  });

  const { data: allClubs = [] } = useQuery({
    queryKey: ['admin-clubs'],
    queryFn: () => base44.entities.Club.list(),
    enabled: !!user && isAdmin,
  });

  const coaches = useMemo(() => allUsers.filter(u => u.user_status === 'coach' || u.user_status === 'coach_pro'), [allUsers]);
  const athletes = useMemo(() => allUsers.filter(u => u.user_status === 'athlete'), [allUsers]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['all-sessions', user?.email, user?.user_status],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return base44.entities.Event.list();
      if (user.user_status === 'coach' || user.user_status === 'coach_pro') {
        // Charger toutes les séances du coach
        const coachEvents = await base44.entities.Event.filter({ user_email: user.email });
        const coachView = localStorage.getItem('coachView') || 'club';
        if (coachView === 'individual') {
          // Vue individuelle : séances assignées aux athlètes des groupes personnels du coach
          const groups = await base44.entities.Group.list();
          const myGroups = groups.filter(g => g.coach_email === user.email);
          const individualEmails = new Set(myGroups.flatMap(g => g.athlete_emails || []));
          return coachEvents.filter(e =>
            !e.assigned_athletes?.length || e.assigned_athletes.some(email => individualEmails.has(email))
          );
        } else {
          // Vue club : toutes les séances du coach (dont celles du club)
          return coachEvents;
        }
      }
      const [ownEvents, allEvents, groups] = await Promise.all([
        base44.entities.Event.filter({ user_email: user.email }),
        base44.entities.Event.list(),
        base44.entities.Group.list(),
      ]);
      const athleteGroup = groups.find(g => g.athlete_emails?.includes(user.email));
      const coachEmail = athleteGroup?.coach_email;
      const coachSessions = coachEmail
        ? allEvents.filter(e => e.user_email === coachEmail && e.assigned_athletes?.includes(user.email))
        : [];
      const map = new Map();
      [...ownEvents, ...coachSessions].forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    },
    enabled: !!user,
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  const filteredEvents = useMemo(() => {
    if (!isAdmin || filterType === 'all' || !filterValue) return events;
    if (filterType === 'coach') return events.filter(e => e.user_email === filterValue);
    if (filterType === 'athlete') return events.filter(e => e.user_email === filterValue || e.assigned_athletes?.includes(filterValue));
    if (filterType === 'group') {
      const group = allGroups.find(g => g.id === filterValue);
      if (!group) return events;
      return events.filter(e =>
        group.athlete_emails?.some(email => e.user_email === email || e.assigned_athletes?.includes(email)) ||
        e.user_email === group.coach_email
      );
    }
    if (filterType === 'club') {
      const club = allClubs.find(c => c.id === filterValue);
      if (!club) return events;
      const clubEmails = [...(club.coach_emails || []), ...(club.athlete_emails || [])];
      return events.filter(e =>
        clubEmails.includes(e.user_email) ||
        e.assigned_athletes?.some(email => clubEmails.includes(email))
      );
    }
    return events;
  }, [events, isAdmin, filterType, filterValue, allGroups, allClubs]);

  const pastSessions = filteredEvents.filter(e => e.event_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date));
  const futureSessions = filteredEvents.filter(e => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));

  useEffect(() => {
    setVisibleFutureCount(PAGE_SIZE);
    setVisiblePastCount(PAGE_SIZE);
  }, [filterType, filterValue]);

  const visibleFutureSessions = futureSessions.slice(0, visibleFutureCount);
  const visiblePastSessions = pastSessions.slice(0, visiblePastCount);

  const backUrl = user?.user_status === 'athlete' ? createPageUrl('AthleteHome') :
                  user?.user_status === 'admin' ? createPageUrl('AdminHome') :
                  createPageUrl('CoachHome');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Link to={backUrl}>
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">
          {isAdmin ? 'Toutes les séances' : 'Mes séances'}
        </h1>
      </div>

      {/* Filtres admin */}
      {isAdmin && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filtrer par</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex border rounded-lg overflow-hidden">
                {['all', 'club', 'coach', 'athlete', 'group'].map(type => (
                  <button
                    key={type}
                    onClick={() => { setFilterType(type); setFilterValue(''); }}
                    className={`px-3 py-1.5 text-sm transition-colors ${filterType === type ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    {type === 'all' ? 'Tous' : type === 'club' ? 'Club' : type === 'coach' ? 'Entraîneur' : type === 'athlete' ? 'Athlète' : 'Groupe'}
                  </button>
                ))}
              </div>
              {filterType === 'club' && (
                <Select value={filterValue} onValueChange={setFilterValue}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Choisir un club" /></SelectTrigger>
                  <SelectContent>{allClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {filterType === 'coach' && (
                <Select value={filterValue} onValueChange={setFilterValue}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Choisir un entraîneur" /></SelectTrigger>
                  <SelectContent>{coaches.map(c => <SelectItem key={c.email} value={c.email}>{c.full_name || c.email}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {filterType === 'group' && (
                <Select value={filterValue} onValueChange={setFilterValue}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
                  <SelectContent>{allGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          <section>
            <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Séances à venir ({futureSessions.length})
            </h2>
            {futureSessions.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">Aucune séance à venir</p>
            ) : (
              <>
                <div className="space-y-3">
                  {visibleFutureSessions.map(event => <SessionCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)}
                </div>
                {(visibleFutureCount < futureSessions.length || visibleFutureCount > PAGE_SIZE) && (
                  <div className="flex justify-center mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-slate-600"
                      onClick={() => {
                        if (visibleFutureCount < futureSessions.length) {
                          setVisibleFutureCount(c => Math.min(c + PAGE_SIZE, futureSessions.length));
                        } else {
                          setVisibleFutureCount(PAGE_SIZE);
                        }
                      }}
                    >
                      {visibleFutureCount < futureSessions.length ? (
                        <>Voir plus ({futureSessions.length - visibleFutureCount} restante{futureSessions.length - visibleFutureCount > 1 ? 's' : ''}) <ChevronDown className="w-4 h-4 ml-1" /></>
                      ) : (
                        <>Voir moins <ChevronUp className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              Séances passées ({pastSessions.length})
            </h2>
            {pastSessions.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">Aucune séance passée</p>
            ) : (
              <>
                <div className="space-y-3">
                  {visiblePastSessions.map(event => <SessionCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)}
                </div>
                {(visiblePastCount < pastSessions.length || visiblePastCount > PAGE_SIZE) && (
                  <div className="flex justify-center mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-slate-600"
                      onClick={() => {
                        if (visiblePastCount < pastSessions.length) {
                          setVisiblePastCount(c => Math.min(c + PAGE_SIZE, pastSessions.length));
                        } else {
                          setVisiblePastCount(PAGE_SIZE);
                        }
                      }}
                    >
                      {visiblePastCount < pastSessions.length ? (
                        <>Voir plus ({pastSessions.length - visiblePastCount} restante{pastSessions.length - visiblePastCount > 1 ? 's' : ''}) <ChevronDown className="w-4 h-4 ml-1" /></>
                      ) : (
                        <>Voir moins <ChevronUp className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <SessionDetailModal
        event={selectedEvent}
        user={user}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
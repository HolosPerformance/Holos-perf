import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  LayoutDashboard, 
  Users, 
  User, 
  MessageCircle, 
  Download,
  Activity,
  TrendingUp,
  Calendar,
  CalendarDays,
  ClipboardList,
  Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import EventCalendar from '../components/calendar/EventCalendar';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQuery } from '@tanstack/react-query';

function getBrandColor() {
  return document.documentElement.style.getPropertyValue('--brand-color') || null;
}

function getBrandSecondaryColor() {
  return document.documentElement.style.getPropertyValue('--brand-secondary-color') || null;
}

export default function AdminHome() {
  const { user } = useAuth();
  const [brandColor, setBrandColor] = useState(null);
  const [brandSecondaryColor, setBrandSecondaryColor] = useState(null);
  const [calendarSelectionMode, setCalendarSelectionMode] = useState('all');
  const [calendarSelectedAthletes, setCalendarSelectedAthletes] = useState([]);
  const [calendarSelectedGroups, setCalendarSelectedGroups] = useState([]);
  const [calendarSelectedClubs, setCalendarSelectedClubs] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const color = getBrandColor();
      const secondary = getBrandSecondaryColor();
      if (color) setBrandColor(color);
      if (secondary) setBrandSecondaryColor(secondary);
      if (color && secondary) clearInterval(interval);
    }, 300);
    setTimeout(() => clearInterval(interval), 5000);
    return () => clearInterval(interval);
  }, []);

  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';
  const isAdmin = user?.user_status === 'admin';

  // Charger tous les utilisateurs
  const { data: allUsersData = [] } = useQuery({
    queryKey: ['all-users-for-filter'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin && !!user
  });

  // Tous les utilisateurs de l'app (pour les filtres calendrier et stats)
  const athletes = allUsersData
    .map(u => ({ 
      email: u.email, 
      name: u.full_name || u.first_name || u.email,
      status: u.user_status
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Charger tous les groupes
  const { data: allGroups = [] } = useQuery({
    queryKey: ['all-groups-stats'],
    queryFn: () => base44.entities.Group.list(),
    enabled: isAdmin && !!user
  });

  // Charger tous les clubs
  const { data: allClubs = [] } = useQuery({
    queryKey: ['all-clubs-calendar'],
    queryFn: () => base44.entities.Club.list(),
    enabled: isAdmin && !!user
  });

  // Emails (athlètes + coachs) à utiliser pour filtrer le calendrier selon le mode choisi
  const calendarSelectedAthleteEmails = (() => {
    if (calendarSelectionMode === 'athletes') return calendarSelectedAthletes;
    if (calendarSelectionMode === 'groups') {
      return [...new Set(calendarSelectedGroups.flatMap(id => allGroups.find(g => g.id === id)?.athlete_emails || []))];
    }
    if (calendarSelectionMode === 'clubs') {
      return [...new Set(calendarSelectedClubs.flatMap(id => {
        const club = allClubs.find(c => c.id === id);
        return [...(club?.athlete_emails || []), ...(club?.coach_emails || [])];
      }))];
    }
    return [];
  })();

  const menuItems = [
    {
      title: 'Séances',
      description: 'Toutes les séances passées et à venir',
      icon: Activity,
      href: '/Sessions',
      color: 'from-violet-500 to-purple-600',
      hex: '#7c3aed'
    },
    {
      title: 'Dashboard',
      description: 'Vue d\'ensemble des données et graphiques',
      icon: LayoutDashboard,
      href: createPageUrl('CoachDashboard'),
      color: 'from-blue-500 to-blue-600',
      hex: '#3b82f6'
    },
    ...(!isCoach ? [{
      title: 'Utilisateurs & Groupes',
      description: 'Gérer les utilisateurs et les groupes d\'athlètes',
      icon: Users,
      href: createPageUrl('UserManagement'),
      color: 'from-pink-500 to-rose-600',
      hex: '#ec4899'
    }] : []),
    {
      title: 'Fiches Athlètes',
      description: 'Consulter et modifier les profils',
      icon: User,
      href: createPageUrl('AthleteProfile'),
      color: 'from-green-500 to-emerald-600',
      hex: '#22c55e'
    },
    {
      title: 'Messages',
      description: 'Communication avec les athlètes',
      icon: MessageCircle,
      href: createPageUrl('Messages'),
      color: 'from-amber-400 to-orange-500',
      hex: '#f59e0b'
    },
    {
      title: 'Export des données',
      description: 'Télécharger les données d\'entraînement',
      icon: Download,
      href: createPageUrl('DataExport'),
      color: 'from-red-500 to-rose-600',
      hex: '#ef4444'
    },
    {
      title: 'Bibliothèque',
      description: 'Questionnaires types par discipline et expertise',
      icon: ClipboardList,
      href: createPageUrl('Questionnaires'),
      color: 'from-indigo-500 to-indigo-700',
      hex: '#6366f1'
    },
    ...(!isCoach ? [{
      title: 'Clubs',
      description: 'Créer et gérer les clubs, inviter des membres',
      icon: Shield,
      href: createPageUrl('ClubManagement'),
      color: 'from-teal-500 to-cyan-600',
      hex: '#14b8a6'
    }] : []),
    {
      title: 'Calendrier',
      description: 'Voir le calendrier complet',
      icon: CalendarDays,
      href: createPageUrl('CalendarPage'),
      color: 'from-sky-500 to-blue-400',
      hex: '#0ea5e9'
    }
  ];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            {isCoach ? 'Espace Entraîneur' : 'Panneau d\'Administration'}
          </h1>
          <p className="text-slate-500 text-lg">
            Bienvenue, {user.first_name || user.full_name} 👋
          </p>
        </div>

        {/* Menu Cards */}
        <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={item.href}>
                  <Card className="group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden h-full cursor-pointer">
                    <div className={`h-2 bg-gradient-to-r ${item.color}`} />
                    <CardHeader className="pb-4">
                      <div
                        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <CardTitle className="text-xl group-hover:text-slate-900 transition-colors">
                        {item.title}
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-slate-600 group-hover:text-slate-800 font-medium">
                        Accéder
                        <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
        </div>

        {/* Calendrier */}
        <div className="mt-12 max-w-7xl mx-auto">
          {isAdmin && (
            <Card className="shadow-lg border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-purple-900">
                  📅 Sélection de calendrier
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-4">
                  {/* Mode de sélection */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <Label className="text-sm font-medium text-slate-700">Calendrier à afficher :</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={calendarSelectionMode === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCalendarSelectionMode('all')}
                        className={calendarSelectionMode === 'all' ? 'bg-purple-600' : ''}
                      >
                        Toutes les séances
                      </Button>
                      {allClubs.length > 0 && (
                        <Button
                          variant={calendarSelectionMode === 'clubs' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCalendarSelectionMode('clubs')}
                          className={calendarSelectionMode === 'clubs' ? 'bg-purple-600' : ''}
                        >
                          Clubs
                        </Button>
                      )}
                      {allGroups.length > 0 && (
                        <Button
                          variant={calendarSelectionMode === 'groups' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCalendarSelectionMode('groups')}
                          className={calendarSelectionMode === 'groups' ? 'bg-purple-600' : ''}
                        >
                          Groupes
                        </Button>
                      )}
                      <Button
                        variant={calendarSelectionMode === 'athletes' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCalendarSelectionMode('athletes')}
                        className={calendarSelectionMode === 'athletes' ? 'bg-purple-600' : ''}
                      >
                        Athlètes
                      </Button>
                      <Button
                        variant={calendarSelectionMode === 'my' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCalendarSelectionMode('my')}
                        className={calendarSelectionMode === 'my' ? 'bg-purple-600' : ''}
                      >
                        Mon calendrier
                      </Button>
                    </div>
                  </div>

                  {/* Sélection de clubs */}
                  {calendarSelectionMode === 'clubs' && (
                    <div className="flex items-start gap-4">
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-3">
                        Clubs :
                      </Label>
                      <div className="flex-1 space-y-2">
                        <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                          {allClubs.length > 0 ? (
                            allClubs.map((club) => (
                              <div key={club.id} className="flex items-center gap-2 py-1">
                                <Checkbox
                                  id={`cal-club-${club.id}`}
                                  checked={calendarSelectedClubs.includes(club.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCalendarSelectedClubs([...calendarSelectedClubs, club.id]);
                                    } else {
                                      setCalendarSelectedClubs(calendarSelectedClubs.filter(id => id !== club.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`cal-club-${club.id}`} className="text-sm cursor-pointer">
                                  {club.name} ({(club.athlete_emails || []).length} athlètes)
                                </Label>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-amber-700">
                              Aucun club disponible
                            </div>
                          )}
                        </div>
                        {calendarSelectedClubs.length > 0 && (
                          <div className="text-sm text-purple-700 font-medium">
                            ✓ {calendarSelectedClubs.length} club(s) sélectionné(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sélection de groupes */}
                  {calendarSelectionMode === 'groups' && (
                    <div className="flex items-start gap-4">
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-3">
                        Groupes :
                      </Label>
                      <div className="flex-1 space-y-2">
                        <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                          {allGroups.length > 0 ? (
                            allGroups.map((group) => (
                              <div key={group.id} className="flex items-center gap-2 py-1">
                                <Checkbox
                                  id={`cal-group-${group.id}`}
                                  checked={calendarSelectedGroups.includes(group.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCalendarSelectedGroups([...calendarSelectedGroups, group.id]);
                                    } else {
                                      setCalendarSelectedGroups(calendarSelectedGroups.filter(id => id !== group.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`cal-group-${group.id}`} className="text-sm cursor-pointer">
                                  {group.name} ({(group.athlete_emails || []).length} athlètes)
                                </Label>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-amber-700">
                              Aucun groupe disponible
                            </div>
                          )}
                        </div>
                        {calendarSelectedGroups.length > 0 && (
                          <div className="text-sm text-purple-700 font-medium">
                            ✓ {calendarSelectedGroups.length} groupe(s) sélectionné(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sélection d'athlètes */}
                  {calendarSelectionMode === 'athletes' && (
                    <div className="flex items-start gap-4">
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-3">
                        Athlètes :
                      </Label>
                      <div className="flex-1 space-y-2">
                        <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                          {athletes.length > 0 ? (
                            athletes.map((athlete) => (
                              <div key={athlete.email} className="flex items-center gap-2 py-1">
                                <Checkbox
                                  id={`cal-athlete-${athlete.email}`}
                                  checked={calendarSelectedAthletes.includes(athlete.email)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCalendarSelectedAthletes([...calendarSelectedAthletes, athlete.email]);
                                    } else {
                                      setCalendarSelectedAthletes(calendarSelectedAthletes.filter(e => e !== athlete.email));
                                    }
                                  }}
                                />
                                <Label htmlFor={`cal-athlete-${athlete.email}`} className="text-sm cursor-pointer">
                                  {athlete.name}
                                </Label>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-amber-700">
                              Aucun athlète disponible
                            </div>
                          )}
                        </div>
                        {calendarSelectedAthletes.length > 0 && (
                          <div className="text-sm text-purple-700 font-medium">
                            ✓ {calendarSelectedAthletes.length} athlète(s) sélectionné(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <EventCalendar
            userEmail={user.email}
            showAllEvents={calendarSelectionMode === 'all'}
            selectedAthleteEmails={calendarSelectionMode === 'my' ? [] : calendarSelectedAthleteEmails}
          />
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm overflow-hidden" style={brandSecondaryColor ? { borderLeft: `4px solid ${brandSecondaryColor}` } : {}}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Statut</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {isCoach ? 'Entraîneur' : 'Administrateur'}
                  </p>
                </div>
                <div className={`w-12 h-12 ${isCoach ? 'bg-purple-100' : 'bg-amber-100'} rounded-full flex items-center justify-center`}>
                  <User className={`w-6 h-6 ${isCoach ? 'text-purple-600' : 'text-amber-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Accès</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {isCoach ? 'Groupe' : 'Complet'}
                  </p>
                </div>
                <div className={`w-12 h-12 ${isCoach ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                  {isCoach ? (
                    <Users className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Activity className="w-6 h-6 text-green-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Aujourd'hui</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
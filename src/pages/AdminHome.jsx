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
  BarChart3,
  Loader2,
  Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import EventCalendar from '../components/calendar/EventCalendar';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [responseLimit, setResponseLimit] = useState(100);
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectionMode, setSelectionMode] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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

  const handleGenerateStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      let athlete_emails = undefined;
      
      if (selectionMode === 'athlete' && selectedAthleteEmail !== 'all') {
        athlete_emails = [selectedAthleteEmail];
      } else if (selectionMode === 'group' && selectedGroupId) {
        const group = allGroups.find(g => g.id === selectedGroupId);
        if (group) {
          athlete_emails = group.athlete_emails;
        }
      }

      const response = await base44.functions.invoke('statisticsAnalysis', { 
        limit: responseLimit,
        athlete_emails: athlete_emails,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      if (response.data.error) {
        setStatsError(response.data.error);
      } else {
        setStatsData(response.data);
      }
    } catch (error) {
      setStatsError(error.message || 'Erreur lors de la génération des statistiques');
    } finally {
      setStatsLoading(false);
    }
  };

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

        {/* Statistiques Avancées - Admin uniquement */}
        {isAdmin && (
          <div className="mt-12 max-w-7xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Statistiques Avancées</CardTitle>
                      <CardDescription>
                        Analyses psychométriques des réponses aux questionnaires
                      </CardDescription>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateStats}
                    disabled={statsLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                  >
                    {statsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyse en cours...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        Générer les analyses
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                  {/* Mode de sélection */}
                  <div className="flex items-center gap-3 flex-wrap pb-3 border-b border-slate-200">
                    <Label className="text-sm font-medium text-slate-700">Données à analyser :</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={selectionMode === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSelectionMode('all');
                          setSelectedAthleteEmail('all');
                          setSelectedGroupId(null);
                        }}
                        disabled={statsLoading}
                        className={selectionMode === 'all' ? 'bg-indigo-600' : ''}
                      >
                        Tous
                      </Button>
                      <Button
                        variant={selectionMode === 'athlete' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSelectionMode('athlete');
                          setSelectedGroupId(null);
                        }}
                        disabled={statsLoading}
                        className={selectionMode === 'athlete' ? 'bg-indigo-600' : ''}
                      >
                        Athlète
                      </Button>
                      {allGroups.length > 0 && (
                        <Button
                          variant={selectionMode === 'group' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setSelectionMode('group');
                            setSelectedAthleteEmail('all');
                          }}
                          disabled={statsLoading}
                          className={selectionMode === 'group' ? 'bg-indigo-600' : ''}
                        >
                          Groupe
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Filtres */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Sélection Athlète ou Groupe */}
                    {selectionMode === 'athlete' && (
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600">Athlète</Label>
                        <Select 
                          value={selectedAthleteEmail} 
                          onValueChange={setSelectedAthleteEmail}
                          disabled={statsLoading}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Sélectionner un athlète</SelectItem>
                            {athletes.map(athlete => (
                              <SelectItem key={athlete.email} value={athlete.email}>
                                {athlete.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectionMode === 'group' && allGroups.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600">Groupe</Label>
                        <Select 
                          value={selectedGroupId || 'none'} 
                          onValueChange={(v) => setSelectedGroupId(v === 'none' ? null : v)}
                          disabled={statsLoading}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sélectionner un groupe</SelectItem>
                            {allGroups.map(group => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name} ({group.athlete_emails?.length || 0} athlètes)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Nombre de réponses max</Label>
                      <Select 
                        value={responseLimit.toString()} 
                        onValueChange={(val) => setResponseLimit(parseInt(val))}
                        disabled={statsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                          <SelectItem value="500">500</SelectItem>
                          <SelectItem value="1000">1000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Date de début</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={statsLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Date de fin</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={statsLoading}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              {statsError && (
                <CardContent>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {statsError}
                  </div>
                </CardContent>
              )}
              {statsData && (
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Taille de l'échantillon</p>
                      <p className="text-3xl font-bold text-slate-800">{statsData.sampleSize}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Nombre de questions</p>
                      <p className="text-3xl font-bold text-slate-800">{statsData.numberOfQuestions}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Analyses réalisées</p>
                      <p className="text-3xl font-bold text-slate-800">3</p>
                    </div>
                  </div>

                  {/* Analyse de Fiabilité */}
                  <div className="border border-slate-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      1. Cohérence Interne (Cronbach's Alpha)
                      <Badge variant="outline" className="ml-auto">α = {statsData.reliability.alpha}</Badge>
                    </h3>
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Coefficient Alpha</span>
                        <span className="font-semibold">{statsData.reliability.alpha}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Interprétation</span>
                        <Badge className={
                          statsData.reliability.alpha >= 0.8 ? 'bg-green-100 text-green-700' :
                          statsData.reliability.alpha >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }>{statsData.reliability.interpretation}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Nombre d'items</span>
                        <span className="font-semibold">{statsData.reliability.numberOfItems}</span>
                      </div>
                    </div>
                    
                    {statsData.reliability.itemAnalysis && statsData.reliability.itemAnalysis.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-700 mb-3">Analyse item par item</h4>
                        <div className="space-y-2">
                          {statsData.reliability.itemAnalysis.map((item, idx) => (
                            <div key={idx} className={`flex justify-between items-center p-3 rounded ${
                              item.shouldDelete ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                            }`}>
                              <div className="flex-1">
                                <span className="text-slate-700 font-medium">{item.label}</span>
                                {item.shouldDelete && (
                                  <Badge className="ml-2 bg-amber-100 text-amber-700 text-xs">
                                    À supprimer
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-slate-500">α si supprimé: {item.alphaIfDeleted}</div>
                                <div className={`text-sm font-semibold ${
                                  item.improvement > 0 ? 'text-green-600' : 'text-slate-500'
                                }`}>
                                  {item.improvement > 0 ? '+' : ''}{item.improvement}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {statsData.reliability.itemAnalysis.some(i => i.shouldDelete) && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                            💡 Suggestion : Supprimer les items marqués pourrait améliorer la cohérence de votre questionnaire
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accord Inter-Juges */}
                  {statsData.interRaterAgreement && (
                    <div className="border border-slate-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        2. Accord entre Joueurs
                        <Badge variant="outline" className="ml-auto">
                          {(statsData.interRaterAgreement.globalAgreement * 100).toFixed(0)}% d'accord
                        </Badge>
                      </h3>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Accord global</span>
                          <span className="font-semibold">{statsData.interRaterAgreement.globalAgreement}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Interprétation</span>
                          <Badge className={
                            statsData.interRaterAgreement.globalAgreement >= 0.8 ? 'bg-green-100 text-green-700' :
                            statsData.interRaterAgreement.globalAgreement >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }>{statsData.interRaterAgreement.interpretation}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Nombre d'évaluateurs</span>
                          <span className="font-semibold">{statsData.interRaterAgreement.numberOfRaters}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-700 mb-3">Accord par question</h4>
                        <div className="space-y-2">
                          {statsData.interRaterAgreement.questionAgreements.map((qa, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50 rounded p-3">
                              <span className="text-slate-700">{qa.label}</span>
                              <div className="text-right">
                                <Badge className={
                                  qa.agreementRate >= 0.8 ? 'bg-green-100 text-green-700' :
                                  qa.agreementRate >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }>
                                  {(qa.agreementRate * 100).toFixed(0)}%
                                </Badge>
                                <div className="text-xs text-slate-500 mt-1">
                                  {qa.numberOfDates} éval., {qa.numberOfComparisons} comparaisons
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                        ℹ️ {statsData.interRaterAgreement.description}
                      </div>
                    </div>
                  )}

                  {/* Analyse Factorielle */}
                  <div className="border border-slate-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">
                      {statsData.interRaterAgreement ? '3' : '2'}. Analyse Factorielle Exploratoire
                    </h3>
                    <div className="mb-4 flex justify-between items-center">
                      <span className="text-slate-600">Nombre de facteurs identifiés</span>
                      <Badge className="bg-blue-100 text-blue-700">{statsData.factorial.numberOfFactors}</Badge>
                    </div>
                    <div className="space-y-4">
                      {statsData.factorial.factors.map((factor, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-700 mb-3">{factor.name}</h4>
                          <div className="space-y-2">
                            {factor.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">{item.label}</span>
                                <span className="font-mono text-slate-800">{item.loading}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Analyse Réseau */}
                  <div className="border border-slate-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">
                      {statsData.interRaterAgreement ? '4' : '3'}. Analyse Réseau
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-500">Nombre de nœuds</p>
                        <p className="text-2xl font-bold text-slate-800">{statsData.network.numberOfNodes}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-500">Nombre de connexions</p>
                        <p className="text-2xl font-bold text-slate-800">{statsData.network.numberOfEdges}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-500">Densité du réseau</p>
                        <p className="text-2xl font-bold text-slate-800">{statsData.network.density}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-500">Interprétation</p>
                        <p className="text-sm font-semibold text-slate-800">{statsData.network.interpretation}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-700">Nœuds les plus centraux</h4>
                      <div className="space-y-2">
                        {statsData.network.nodes.slice(0, 5).map((node, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 rounded p-3">
                            <span className="text-slate-700">{node.id}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-500">Degré: {node.degree}</span>
                              <Badge variant="outline">Centralité: {node.centrality}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>

                      {statsData.network.edges.length > 0 && (
                        <>
                          <h4 className="font-semibold text-slate-700 mt-6">Connexions principales</h4>
                          <div className="space-y-2">
                            {statsData.network.edges.slice(0, 10).map((edge, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-50 rounded p-3 text-sm">
                                <span className="text-slate-700">{edge.source} ↔ {edge.target}</span>
                                <Badge className={edge.weight > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {edge.weight}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}

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
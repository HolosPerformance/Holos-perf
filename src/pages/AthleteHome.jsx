import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useBrandColors } from '@/hooks/useBranding';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  User, 
  MessageCircle,
  TrendingUp,
  Calendar,
  CalendarDays,
  BarChart3,
  Users,
  ArrowLeft,
  ClipboardList,
  Clock,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import DailyQuestionnaire from '../components/questionnaire/DailyQuestionnaire';
import CustomQuestionnaireForm from '../components/questionnaire/CustomQuestionnaireForm';
import { athleteLanguage, localizeTemplate } from '@/lib/questionnaireI18n';
import AthleteDataChart from '../components/dashboard/AthleteDataChart';
import EventCalendar from '../components/calendar/EventCalendar';
import PushNotificationPrompt from '../components/PushNotificationPrompt';
import { format, parseISO } from 'date-fns';
import { questionnaireDay, previousQuestionnaireDay, responseDay } from '@/lib/questionnaireDay';
import { SLOT_LABELS, clubMorningIds, clubEveningIds, teamMorningIds, teamEveningIds, currentSlot } from '@/lib/questionnaireSlots';
import { fr } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AthleteHome() {
  const { user } = useAuth();
  const [athleteFirstName, setAthleteFirstName] = useState(null);
  const [group, setGroup] = useState(null);
  const { primary: brandColor, secondary: brandSecondaryColor } = useBrandColors();

  const [view, setView] = useState('home'); // 'home', 'questionnaire', 'data'
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState(null);
  const [existingResponseId, setExistingResponseId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [questionnaireSlide, setQuestionnaireSlide] = useState(0); // 0 = aujourd'hui, 1 = hier
  const [selectedResponseDate, setSelectedResponseDate] = useState(null); // date ISO pour la réponse (null = aujourd'hui)
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.email) return;
    let isMounted = true;

    const loadData = async () => {
      try {
        // Charger le prénom depuis la fiche athlète
        try {
          const profiles = await base44.entities.AthleteProfile.filter({ athlete_email: user.email });
          if (!isMounted) return;
          if (profiles.length > 0 && profiles[0].athlete_name) {
            setAthleteFirstName(profiles[0].athlete_name.split(' ')[0]);
          } else {
            setAthleteFirstName(user.first_name || user.full_name?.split(' ')[0] || user.email);
          }
        } catch (_) {
          setAthleteFirstName(user.first_name || user.full_name?.split(' ')[0] || user.email);
        }

        const groups = await base44.entities.Group.list();
        if (!isMounted) return;
        const athleteGroup = groups.find(g => g.athlete_emails?.includes(user.email));
        setGroup(athleteGroup);
      } catch (error) {
        if (error.message !== 'Request aborted') {
          console.error('Error loading athlete data:', error);
        }
      }
    };
    loadData();

    return () => { isMounted = false; };
  }, [user?.email]);

  const { data: trainingLogs = [] } = useQuery({
    queryKey: ['athlete-logs', user?.email],
    queryFn: () => base44.entities.TrainingLog.filter({ athlete_email: user.email }, '-training_date', 30),
    enabled: !!user?.email
  });

  const todayLog = trainingLogs.find(
    log => log.training_date === questionnaireDay()
  );

  const { data: assignedQuestionnaires = [] } = useQuery({
    queryKey: ['assigned-questionnaires', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allTemplates = await base44.entities.QuestionnaireTemplate.list();
      // Retourner uniquement les questionnaires actifs assignés à cet athlète
      return allTemplates.filter(t =>
        t.is_active &&
        (t.assigned_athletes || []).includes(user.email)
      );
    },
    enabled: !!user,
  });

  // Créneau (matin / soir) de chaque questionnaire, d'après le club et
  // l'équipe de l'athlète. L'équipe l'emporte sur le club.
  const { data: questionnaireSlots = {} } = useQuery({
    queryKey: ['questionnaire-slots', user?.email],
    queryFn: async () => {
      const [clubs, teams] = await Promise.all([
        base44.entities.Club.list(),
        base44.entities.Team.list().catch(() => []),
      ]);
      const club = clubs.find(c => (c.athlete_emails || []).includes(user.email));
      const team = teams.find(t => (t.athlete_emails || []).includes(user.email));
      const slots = {};
      clubMorningIds(club).forEach(id => { slots[id] = 'morning'; });
      clubEveningIds(club).forEach(id => { slots[id] = 'evening'; });
      teamMorningIds(team).forEach(id => { slots[id] = 'morning'; });
      teamEveningIds(team).forEach(id => { slots[id] = 'evening'; });
      return slots;
    },
    enabled: !!user?.email,
  });

  const { data: todayEvents = [] } = useQuery({
    queryKey: ['today-events', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const today = questionnaireDay();
      const allEvents = await base44.entities.Event.list();
      return allEvents.filter(event => 
        event.event_date === today &&
        event.assigned_athletes?.includes(user.email)
      ).sort((a, b) => a.start_time.localeCompare(b.start_time));
    },
    enabled: !!user,
  });

  const { data: questionnaireResponses = [] } = useQuery({
    queryKey: ['questionnaire-responses', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const today = questionnaireDay();
      const yesterday = previousQuestionnaireDay();
      const allResponses = await base44.entities.QuestionnaireResponse.filter({
        athlete_email: user.email
      });
      return allResponses.filter(r => responseDay(r) === today || responseDay(r) === yesterday);
    },
    enabled: !!user,
  });

  const { data: allQuestionnaireResponses = [] } = useQuery({
    queryKey: ['all-questionnaire-responses', user?.email],
    queryFn: () => base44.entities.QuestionnaireResponse.filter({ athlete_email: user.email }),
    enabled: !!user,
  });

  const canAccessDashboard = user?.can_access_subjective_data_page !== false || user?.can_access_objective_data_page !== false;

  const menuItems = [
    {
      title: 'Mes Séances',
      description: 'Séances passées et à venir',
      icon: Calendar,
      href: '/Sessions',
      color: 'from-violet-500 to-violet-600'
    },
    canAccessDashboard && {
      title: 'Mon Dashboard',
      description: 'Mes statistiques personnelles',
      icon: TrendingUp,
      href: createPageUrl('PersonalDashboard'),
      color: 'from-green-500 to-green-600'
    },
    {
      title: 'Ma Fiche Athlète',
      description: 'Consulter et modifier mon profil',
      icon: User,
      href: createPageUrl('AthleteProfile'),
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Messages',
      description: 'Communication avec mon coach',
      icon: MessageCircle,
      href: createPageUrl('Messages'),
      color: 'from-amber-500 to-amber-600'
    },
    {
      title: 'Calendrier',
      description: 'Voir mon calendrier complet',
      icon: CalendarDays,
      href: createPageUrl('CalendarPage'),
      color: 'from-teal-500 to-teal-600'
    }
  ].filter(Boolean);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  // Vue Questionnaire
  if (view === 'questionnaire') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" onClick={() => {
              setView('home');
              setSelectedQuestionnaireId(null);
              setExistingResponseId(null);
            }} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Button>
          </div>
          <div className="space-y-6">
            {selectedQuestionnaireId && (
              <CustomQuestionnaireForm 
                templateId={selectedQuestionnaireId}
                userEmail={user.email}
                existingResponseId={existingResponseId}
                eventId={selectedEventId}
                forceDate={selectedResponseDate}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['questionnaire-responses'] });
                  queryClient.invalidateQueries({ queryKey: ['all-questionnaire-responses'] });
                  setView('home');
                  setSelectedQuestionnaireId(null);
                  setExistingResponseId(null);
                  setSelectedEventId(null);
                  setSelectedResponseDate(null);
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vue Données
  if (view === 'data') {
    const last30Days = trainingLogs.slice(0, 30).map(log => ({
      ...log,
      dateLabel: format(parseISO(log.training_date), 'dd/MM')
    }));

    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" onClick={() => setView('home')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Button>
          </div>
          
          <h1 className="text-3xl font-bold text-slate-800 mb-6">Mes Données</h1>
          
          <div className="space-y-6">
            <AthleteDataChart
              data={last30Days}
              selectedMetrics={['fatigue', 'intensite', 'sommeil', 'plaisir']}
              title="Évolution des 30 derniers jours"
            />
            
            <Card>
              <CardHeader>
                <CardTitle>Historique des séances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trainingLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">
                          {format(parseISO(log.training_date), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-sm text-slate-500">{log.contenu_seance}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">{log.duration_minutes} min</p>
                        <p className="text-xs text-slate-500">Intensité: {log.intensite}/100</p>
                      </div>
                    </div>
                  ))}
                  {trainingLogs.length === 0 && (
                    <p className="text-center text-slate-500 py-8">Aucune donnée pour le moment</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Vue Home
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
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Mon Espace Athlète
          </h1>
          <p className="text-slate-500 text-lg">
            Bienvenue, {athleteFirstName || user.full_name?.split(' ')[0]} 👋
          </p>
        </div>

        {/* Section Questionnaires */}
        {(() => {
          const today = questionnaireDay();
          const yesterday = previousQuestionnaireDay();
          const isYesterday = questionnaireSlide === 1;
          const activeDate = isYesterday ? yesterday : today;

          const todayResponsesOnly = questionnaireResponses.filter(r => responseDay(r) === today);
          const yesterdayResponsesOnly = questionnaireResponses.filter(r => responseDay(r) === yesterday);
          const activeResponses = isYesterday ? yesterdayResponsesOnly : todayResponsesOnly;

          // Questionnaires quotidiens pour la date active, groupés par créneau :
          // matin, puis soir, puis ceux sans créneau. Un questionnaire lié à une
          // séance du jour remplace ceux de l'après-séance (soir et sans créneau).
          const hasEventQuestionnaire = !isYesterday && todayEvents.some(e => !!e.questionnaire_template_id);
          const slotOf = (t) => questionnaireSlots[t.id] || 'other';
          const hasSlots = assignedQuestionnaires.some(t => slotOf(t) !== 'other');
          const highlightedSlot = isYesterday ? null : currentSlot();
          const dailyGroups = ['morning', 'evening', 'other']
            .filter(slot => slot === 'morning' || !hasEventQuestionnaire)
            .map(slot => ({ slot, templates: assignedQuestionnaires.filter(t => slotOf(t) === slot) }))
            .filter(group => group.templates.length > 0);
          const showDailyQuestionnaire = dailyGroups.length > 0;

          const hasAnyContent = assignedQuestionnaires.length > 0 || todayEvents.length > 0;

          return (
            <div className="mb-12">
              {/* Header avec navigation slider */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-800">
                  {isYesterday ? 'Questionnaires d\'hier' : 'Questionnaires du jour'}
                </h2>
                {hasAnyContent && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuestionnaireSlide(0)}
                      disabled={questionnaireSlide === 0}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setQuestionnaireSlide(0)}
                        className={`w-2 h-2 rounded-full transition-colors ${questionnaireSlide === 0 ? 'bg-blue-500' : 'bg-slate-300'}`}
                      />
                      <button
                        onClick={() => setQuestionnaireSlide(1)}
                        className={`w-2 h-2 rounded-full transition-colors ${questionnaireSlide === 1 ? 'bg-blue-500' : 'bg-slate-300'}`}
                      />
                    </div>
                    <button
                      onClick={() => setQuestionnaireSlide(1)}
                      disabled={questionnaireSlide === 1}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-sm text-slate-400 ml-1">
                      {isYesterday
                        ? format(parseISO(previousQuestionnaireDay()), 'dd MMM', { locale: fr })
                        : "Aujourd'hui"}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Questionnaires quotidiens : matin, soir, puis sans créneau */}
                {dailyGroups.map(({ slot, templates: slotTemplates }) => {
                  const isHighlighted = slot === highlightedSlot;
                  const isDimmed = !!highlightedSlot && slot !== 'other' && !isHighlighted;
                  return (
                  <motion.div
                    key={`daily-${slot}-${questionnaireSlide}`}
                    initial={{ opacity: 0, x: isYesterday ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {hasSlots && (
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-700">
                          {slot === 'other'
                            ? 'Autres questionnaires'
                            : `${SLOT_LABELS[slot].icon} Questionnaire du ${slot === 'morning' ? 'matin' : 'soir'}`}
                        </h3>
                        {slot !== 'other' && (
                          <span className="text-sm text-slate-400">· {SLOT_LABELS[slot].hint}</span>
                        )}
                        {isHighlighted && (
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">Maintenant</span>
                        )}
                      </div>
                    )}
                    {slotTemplates.map(template => {
                      const activeAlreadyAnswered = activeResponses.some(r => r.template_id === template.id && !r.event_id);
                      return (
                    <Card key={template.id} className={`border-2 ${isYesterday ? 'border-amber-200' : isDimmed ? 'border-slate-200' : 'border-blue-200'}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <ClipboardList className={`w-5 h-5 ${isYesterday ? 'text-amber-500' : 'text-blue-600'}`} />
                              {localizeTemplate(template, athleteLanguage(template, user?.email))?.name || 'Questionnaire Quotidien'}
                            </CardTitle>
                            <CardDescription>
                              {isYesterday
                                ? `Questionnaire du ${format(parseISO(previousQuestionnaireDay()), 'dd MMMM', { locale: fr })}`
                                : slot === 'other' ? "Questionnaire quotidien" : `Questionnaire du ${slot === 'morning' ? 'matin' : 'soir'}`}
                            </CardDescription>
                          </div>
                          {activeAlreadyAnswered ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                              <CheckCircle className="w-4 h-4" />
                              Répondu
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                              <Activity className="w-4 h-4" />
                              Non répondu
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => {
                            const existingResponse = activeResponses.find(r => r.template_id === template.id && !r.event_id);
                            setSelectedQuestionnaireId(template.id);
                            setExistingResponseId(existingResponse?.id || null);
                            setSelectedResponseDate(isYesterday ? yesterday : null);
                            setView('questionnaire');
                          }}
                          variant={isDimmed ? 'outline' : 'default'}
                          className={`w-full ${isYesterday ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                        >
                          {activeAlreadyAnswered ? 'Modifier ma réponse' : 'Répondre au questionnaire'}
                        </Button>
                      </CardContent>
                    </Card>
                      );
                    })}
                  </motion.div>
                  );
                })}

                {/* Séances du jour (seulement pour aujourd'hui) */}
                {!isYesterday && todayEvents.map((event) => {
                  const now = new Date();
                  let isEventFinished;
                  if (event.end_time) {
                    const eventEndDateTime = new Date(`${event.event_date}T${event.end_time}`);
                    isEventFinished = now > eventEndDateTime;
                  } else if (event.duration_minutes && event.start_time) {
                    const startMs = new Date(`${event.event_date}T${event.start_time}`).getTime();
                    const endMs = startMs + event.duration_minutes * 60000;
                    isEventFinished = now.getTime() > endMs;
                  } else {
                    isEventFinished = new Date(event.event_date) < now;
                  }
                  const linkedQuestionnaire = assignedQuestionnaires.find(q => q.id === event.questionnaire_template_id)
                    || (event.questionnaire_template_id ? { id: event.questionnaire_template_id, name: 'Questionnaire' } : null);
                  const hasResponded = linkedQuestionnaire && allQuestionnaireResponses.some(r => r.event_id === event.id);

                  return (
                    <Card key={event.id} className="border-2" style={{ borderColor: event.session_color || '#6366f1' }}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <Clock className="w-5 h-5" style={{ color: event.session_color || '#6366f1' }} />
                              {event.title}
                            </CardTitle>
                            <CardDescription>
                              {event.start_time} - {event.end_time} ({event.duration_minutes} min)
                              {event.theme && ` • ${event.theme}`}
                            </CardDescription>
                          </div>
                          {linkedQuestionnaire && (
                            hasResponded ? (
                              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                <CheckCircle className="w-4 h-4" />
                                Répondu
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                <Activity className="w-4 h-4" />
                                Non répondu
                              </div>
                            )
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {event.description && (
                          <p className="text-sm text-slate-600 mb-3">{event.description}</p>
                        )}
                        {linkedQuestionnaire && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-sm font-medium text-slate-700 mb-2">
                              Questionnaire lié: {localizeTemplate(linkedQuestionnaire, athleteLanguage(linkedQuestionnaire, user?.email)).name}
                            </p>
                            {isEventFinished ? (
                              <Button
                                onClick={() => {
                                  const existingResponse = allQuestionnaireResponses.find(r => r.event_id === event.id);
                                  setSelectedQuestionnaireId(linkedQuestionnaire.id);
                                  setExistingResponseId(existingResponse?.id || null);
                                  setSelectedEventId(event.id);
                                  setSelectedResponseDate(null);
                                  setView('questionnaire');
                                }}
                                className="w-full"
                              >
                                {hasResponded ? 'Modifier ma réponse' : 'Répondre au questionnaire'}
                              </Button>
                            ) : (
                              <p className="text-sm text-slate-500 italic">
                                Le questionnaire sera disponible après la fin de la séance
                              </p>
                            )}
                          </div>
                        )}
                        {!linkedQuestionnaire && (
                          <p className="text-sm text-slate-500 italic">Aucun questionnaire lié à cette séance</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Message si rien à afficher */}
                {isYesterday && !showDailyQuestionnaire && (
                  <Card className="border-slate-200">
                    <CardContent className="py-8 text-center text-slate-500">
                      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun questionnaire disponible pour hier</p>
                    </CardContent>
                  </Card>
                )}
                {!isYesterday && todayEvents.length === 0 && assignedQuestionnaires.length === 0 && (
                  <Card className="border-slate-200">
                    <CardContent className="py-8 text-center text-slate-500">
                      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun questionnaire disponible aujourd'hui</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          );
        })()}

        {/* Menu Cards */}
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
                {item.href ? (
                  <Link to={item.href}>
                    <Card className="group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden h-full cursor-pointer">
                    <div className={`h-2 bg-gradient-to-r ${item.color}`} style={brandColor ? { background: brandColor } : {}} />
                    <CardHeader className="pb-4">
                      <div
                        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                        style={brandColor ? { background: brandColor } : {}}
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
                ) : (
                  <div onClick={item.onClick}>
                    <Card className="group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden h-full cursor-pointer">
                      <div className={`h-2 bg-gradient-to-r ${item.color}`} />
                      <CardHeader className="pb-4">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
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
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <PushNotificationPrompt athleteEmail={user.email} />

        {/* Calendrier */}
        <div className="mt-12">
          <EventCalendar userEmail={user.email} />
        </div>

        {/* Quick Info */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Card className="border-0 shadow-sm overflow-hidden" style={brandSecondaryColor ? { borderLeft: `4px solid ${brandSecondaryColor}` } : {}}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Statut</p>
                  <p className="text-2xl font-bold text-slate-800">Athlète</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
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
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
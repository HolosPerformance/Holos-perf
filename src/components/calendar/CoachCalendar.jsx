import React, { useState, useMemo } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, Clock, Trash2, ChevronLeft, ChevronRight, Users, ChevronUp, ChevronDown, Edit, X } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, addWeeks, subWeeks, addYears } from 'date-fns';

const hexToLightBg = (hex) => {
  if (!hex || !hex.startsWith('#')) return '#e0e7ff';
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*0.18+255*0.82)},${Math.round(g*0.18+255*0.82)},${Math.round(b*0.18+255*0.82)})`;
};
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from '@/utils';
import AthleteAssignmentPicker from './AthleteAssignmentPicker';

export default function CoachCalendar({ coachEmail, athletes, isAdmin = false, filterType = 'all', filterValue = '', allGroups = [], allClubs = [], coachClub = null, coachOwnGroups = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [showEarlyHours, setShowEarlyHours] = useState(false);
  const [showLateHours, setShowLateHours] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    theme: '',
    session_category: 'seance_terrain',
    session_color: '#f97316',
    start_time: '',
    duration_minutes: '',
    description: '',
    assigned_athletes: [],
    event_date: format(new Date(), 'yyyy-MM-dd'),
    recurrence: 'none',
    recurrence_days: [],
    recurrence_end_date: ''
  });

  const sessionCategories = [
    { value: 'seance_terrain', label: 'Séance terrain', defaultColor: '#f97316' },
    { value: 'seance_salle', label: 'Séance en salle', defaultColor: '#a855f7' },
    { value: 'recuperation', label: 'Récupération', defaultColor: '#3b82f6' },
    { value: 'soins', label: 'Soins', defaultColor: '#22c55e' },
    { value: 'seance_specifique', label: 'Séance spécifique', defaultColor: '#eab308' },
    { value: 'competition', label: 'Compétition', defaultColor: '#ef4444' }
  ];
  
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['coach-events', isAdmin ? 'admin-all' : coachEmail],
    queryFn: async () => {
      if (isAdmin) {
        return base44.entities.Event.list();
      }
      const allEvents = await base44.entities.Event.filter({ user_email: coachEmail });
      return allEvents;
    }
  });

  // Pour l'admin : filtrage par club / groupe / athlète sélectionné en haut de page
  const filteredEvents = useMemo(() => {
    if (!isAdmin || filterType === 'all' || !filterValue) return events;
    if (filterType === 'athlete') {
      return events.filter(e => e.user_email === filterValue || e.assigned_athletes?.includes(filterValue));
    }
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

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => base44.entities.Event.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreateDialog(false);
      setNewSession({
        title: '',
        theme: '',
        session_category: 'seance_terrain',
        session_color: '#f97316',
        start_time: '',
        duration_minutes: '',
        description: '',
        assigned_athletes: [],
        event_date: format(new Date(), 'yyyy-MM-dd'),
        recurrence: 'none',
        recurrence_days: [],
        recurrence_end_date: ''
      });
      toast.success('Séance créée avec succès');
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId) => base44.entities.Event.delete(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEditDialog(false);
      setEditingEvent(null);
      toast.success('Événement supprimé');
    }
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEditDialog(false);
      setEditingEvent(null);
      toast.success('Séance mise à jour');
    }
  });

  const handleCreateSession = async () => {
    if (!newSession.title || !newSession.start_time || !newSession.duration_minutes) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (newSession.recurrence === 'weekly' && newSession.recurrence_days.length === 0) {
      toast.error('Veuillez sélectionner au moins un jour de récurrence');
      return;
    }
    if (newSession.recurrence === 'weekly' && !newSession.recurrence_end_date) {
      toast.error('Veuillez sélectionner une date de fin de récurrence');
      return;
    }

    const startTime = newSession.start_time;
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = startMinutes + parseInt(newSession.duration_minutes);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    let questionnaireTemplateId = null;
    try {
      const questionnaires = await base44.entities.QuestionnaireTemplate.list();
      const linkedQuestionnaire = questionnaires.find(q =>
        q.is_active &&
        q.assigned_coaches?.includes(coachEmail) &&
        newSession.assigned_athletes.some(athleteEmail => q.assigned_athletes?.includes(athleteEmail))
      );
      if (linkedQuestionnaire) questionnaireTemplateId = linkedQuestionnaire.id;
    } catch (error) {
      console.error('Erreur lors de la recherche du questionnaire:', error);
    }

    const baseData = {
      user_email: coachEmail,
      title: newSession.title,
      theme: newSession.theme,
      session_category: newSession.session_category,
      session_color: newSession.session_color,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: parseInt(newSession.duration_minutes),
      description: newSession.description,
      assigned_athletes: newSession.assigned_athletes,
      is_training_session: true,
      questionnaire_template_id: questionnaireTemplateId
    };

    if (newSession.recurrence === 'weekly') {
      const endDate = parseISO(newSession.recurrence_end_date);
      const dayMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
      const events = [];
      let current = parseISO(newSession.event_date);
      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (newSession.recurrence_days.includes(dayOfWeek)) {
          events.push({ ...baseData, event_date: format(current, 'yyyy-MM-dd') });
        }
        current = addDays(current, 1);
      }
      if (events.length === 0) {
        toast.error('Aucune occurrence trouvée avec ces paramètres');
        return;
      }
      try {
        await base44.entities.Event.bulkCreate(events);
        queryClient.invalidateQueries({ queryKey: ['coach-events'] });
        queryClient.invalidateQueries({ queryKey: ['events'] });
        setShowCreateDialog(false);
        setNewSession({ title: '', theme: '', session_category: 'seance_terrain', session_color: '#f97316', start_time: '', duration_minutes: '', description: '', assigned_athletes: [], event_date: format(new Date(), 'yyyy-MM-dd'), recurrence: 'none', recurrence_days: [], recurrence_end_date: '' });
        toast.success(`${events.length} séance(s) créée(s) avec succès`);
      } catch (e) {
        toast.error('Erreur lors de la création des séances');
      }
      return;
    }

    createSessionMutation.mutate({
      user_email: coachEmail,
      title: newSession.title,
      theme: newSession.theme,
      session_category: newSession.session_category,
      session_color: newSession.session_color,
      event_date: newSession.event_date,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: parseInt(newSession.duration_minutes),
      description: newSession.description,
      assigned_athletes: newSession.assigned_athletes,
      is_training_session: true,
      questionnaire_template_id: questionnaireTemplateId
    });
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    // Rediriger vers la page de détails de la séance
    window.location.href = createPageUrl('SessionDetails') + '?id=' + event.id;
  };

  const handleUpdateEvent = () => {
    if (!editingEvent.title || !editingEvent.start_time || !editingEvent.duration_minutes) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const startTime = editingEvent.start_time;
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = startMinutes + parseInt(editingEvent.duration_minutes);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    updateEventMutation.mutate({
      id: editingEvent.id,
      data: {
        ...editingEvent,
        end_time: endTime
      }
    });
  };

  const handleDragStart = (event, e) => {
    e.stopPropagation();
    setDraggedEvent(event);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (date, hour, minute, e) => {
    e.preventDefault();
    if (!draggedEvent) return;

    const newStartTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const startMinutes = hour * 60 + minute;
    const endMinutes = startMinutes + draggedEvent.duration_minutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    updateEventMutation.mutate({
      id: draggedEvent.id,
      data: {
        ...draggedEvent,
        event_date: format(date, 'yyyy-MM-dd'),
        start_time: newStartTime,
        end_time: newEndTime
      }
    });

    setDraggedEvent(null);
  };

  const getDisplayHours = () => {
    let startHour = 8;
    let endHour = 23;
    
    if (showEarlyHours) startHour = 0;
    if (showLateHours) endHour = 24;
    
    return { startHour, endHour };
  };

  const getViewDates = () => {
    if (view === 'day') {
      return [currentDate];
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { locale: fr });
      const end = endOfWeek(currentDate, { locale: fr });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startWeek = startOfWeek(start, { locale: fr });
      const endWeek = endOfWeek(end, { locale: fr });
      return eachDayOfInterval({ start: startWeek, end: endWeek });
    }
  };

  const navigateDate = (direction) => {
    if (view === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1));
    } else if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const viewDates = getViewDates();
  const eventsForSelectedDate = filteredEvents.filter(event =>
    isSameDay(parseISO(event.event_date), selectedDate)
  ).sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-6">
      {/* En-tête de navigation */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-[200px] text-center">
                <CardTitle>
                  {view === 'day' && format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  {view === 'week' && `Semaine du ${format(startOfWeek(currentDate, { locale: fr }), 'd MMM', { locale: fr })}`}
                  {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: fr })}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={view === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('day')}
                  className="rounded-none"
                >
                  Jour
                </Button>
                <Button
                  variant={view === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('week')}
                  className="rounded-none border-x"
                >
                  Semaine
                </Button>
                <Button
                  variant={view === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('month')}
                  className="rounded-none"
                >
                  Mois
                </Button>
              </div>
              
              <Button
                onClick={() => {
                  setNewSession({
                    ...newSession,
                    event_date: format(currentDate, 'yyyy-MM-dd')
                  });
                  setSelectedDate(currentDate);
                  setShowCreateDialog(true);
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Créer une séance
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Vue calendrier */}
      <Card>
        <CardContent className="p-6">
          {view === 'month' && (
            <div className="grid grid-cols-7 gap-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                <div key={day} className="text-center font-semibold text-slate-600 text-sm py-2">
                  {day}
                </div>
              ))}
              {viewDates.map((date, idx) => {
                const dayEvents = filteredEvents.filter(event =>
                  isSameDay(parseISO(event.event_date), date)
                );
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const isSelected = isSameDay(date, selectedDate);
                
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      min-h-[80px] p-2 border rounded-lg text-left hover:bg-slate-50 transition-colors
                      ${!isCurrentMonth ? 'opacity-40' : ''}
                      ${isSelected ? 'bg-slate-100 border-slate-400' : 'border-slate-200'}
                    `}
                  >
                    <div className="font-medium text-sm mb-1">{format(date, 'd')}</div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event, i) => (
                        <div
                          key={i}
                          className="text-xs px-2 py-1 rounded truncate border-l-2"
                          style={{ 
                            borderLeftColor: event.session_color || '#6366f1',
                            backgroundColor: hexToLightBg(event.session_color || '#6366f1')
                          }}
                        >
                          {event.start_time} {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-slate-500 pl-2">
                          +{dayEvents.length - 2} autre(s)
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {view === 'week' && (
            <div className="flex gap-2 overflow-x-auto">
              <div className="w-16 flex-shrink-0 pt-12">
                {showEarlyHours ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full mb-1"
                    onClick={() => setShowEarlyHours(false)}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full mb-1"
                    onClick={() => setShowEarlyHours(true)}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                )}
                {(() => {
                  const { startHour, endHour } = getDisplayHours();
                  return [...Array(endHour - startHour)].map((_, idx) => {
                    const hour = startHour + idx;
                    return (
                      <div key={hour} className="h-16 text-xs text-slate-500 pr-2 text-right flex items-start pt-0.5">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    );
                  });
                })()}
                {showLateHours ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full mt-1"
                    onClick={() => setShowLateHours(false)}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full mt-1"
                    onClick={() => setShowLateHours(true)}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {viewDates.map((date, idx) => {
                const dayEvents = filteredEvents.filter(event =>
                  isSameDay(parseISO(event.event_date), date)
                );
                const isSelected = isSameDay(date, selectedDate);
                const { startHour, endHour } = getDisplayHours();
                const displayHeight = (endHour - startHour) * 64;
                
                return (
                  <div key={idx} className={`flex-1 min-w-[120px] border rounded-lg ${isSelected ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}>
                    <button
                      onClick={() => setSelectedDate(date)}
                      className="w-full p-3 text-center border-b hover:bg-slate-50"
                    >
                      <div className="text-xs text-slate-500">{format(date, 'EEE', { locale: fr })}</div>
                      <div className="text-lg font-semibold">{format(date, 'd')}</div>
                    </button>
                    <div className="relative" style={{ height: `${displayHeight}px` }}>
                      {[...Array(endHour - startHour)].map((_, idx) => {
                        const hour = startHour + idx;
                        return (
                          <div key={hour}>
                            <div 
                              className="absolute w-full border-t border-slate-100 hover:bg-slate-50 transition-colors" 
                              style={{ top: `${idx * 64}px`, height: '64px' }}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(date, hour, 0, e)}
                            />
                            <div 
                              className="absolute w-full border-t border-slate-50 hover:bg-slate-100 transition-colors" 
                              style={{ top: `${idx * 64 + 32}px`, height: '32px' }}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(date, hour, 30, e)}
                            />
                          </div>
                        );
                      })}
                      {dayEvents.map((event, i) => {
                        const [eventHour, eventMin] = event.start_time.split(':').map(Number);
                        const topPosition = ((eventHour - startHour) * 64) + (eventMin / 60 * 64);
                        const height = event.duration_minutes ? (event.duration_minutes / 60 * 64) : 32;
                        
                        if (eventHour < startHour || eventHour >= endHour) return null;
                        
                        return (
                          <div
                            key={i}
                            draggable
                            onDragStart={(e) => handleDragStart(event, e)}
                            className="absolute w-[calc(100%-8px)] mx-1 text-xs px-2 py-1 rounded cursor-move shadow-sm overflow-hidden border-l-3 hover:shadow-lg hover:opacity-75 transition-all"
                            style={{ 
                              top: `${topPosition}px`,
                              height: `${Math.max(height, 24)}px`,
                              borderLeftWidth: '3px',
                              borderLeftColor: event.session_color || '#6366f1',
                              backgroundColor: hexToLightBg(event.session_color || '#6366f1'),
                              zIndex: 10
                            }}
                            onClick={(e) => handleEventClick(event, e)}
                          >
                            <div className="font-medium truncate">{event.start_time}</div>
                            <div className="truncate text-slate-700">{event.title}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'day' && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">
                  {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </h3>
              </div>
              <div className="flex gap-4">
                <div className="w-16 flex-shrink-0 pt-2">
                  {showEarlyHours ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full mb-1"
                      onClick={() => setShowEarlyHours(false)}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full mb-1"
                      onClick={() => setShowEarlyHours(true)}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  )}
                  {(() => {
                    const { startHour, endHour } = getDisplayHours();
                    return [...Array(endHour - startHour)].map((_, idx) => {
                      const hour = startHour + idx;
                      return (
                        <div key={hour} className="h-16 text-xs text-slate-500 pr-2 text-right flex items-start pt-0.5">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      );
                    });
                  })()}
                  {showLateHours ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full mt-1"
                      onClick={() => setShowLateHours(false)}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full mt-1"
                      onClick={() => setShowLateHours(true)}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex-1 border rounded-lg relative bg-white" style={{ height: `${(() => {
                  const { startHour, endHour } = getDisplayHours();
                  return (endHour - startHour) * 64;
                })()}px` }}>
                  {(() => {
                    const { startHour, endHour } = getDisplayHours();
                    return [...Array(endHour - startHour)].map((_, idx) => {
                      const hour = startHour + idx;
                      return (
                        <div key={hour}>
                          <div 
                            className="absolute w-full border-t border-slate-100 hover:bg-slate-50 transition-colors" 
                            style={{ top: `${idx * 64}px`, height: '64px' }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(currentDate, hour, 0, e)}
                          >
                            <div className="absolute top-0 left-0 right-0 h-px bg-slate-200" />
                          </div>
                          <div 
                            className="absolute w-full border-t border-slate-50 hover:bg-slate-100 transition-colors" 
                            style={{ top: `${idx * 64 + 32}px`, height: '32px' }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(currentDate, hour, 30, e)}
                          />
                        </div>
                      );
                    });
                  })()}
                  {eventsForSelectedDate.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <CalendarIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
                        <p>Aucun événement ce jour</p>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const { startHour } = getDisplayHours();
                      return eventsForSelectedDate.map((event) => {
                        const [eventHour, eventMin] = event.start_time.split(':').map(Number);
                        const topPosition = ((eventHour - startHour) * 64) + (eventMin / 60 * 64);
                        const height = event.duration_minutes ? (event.duration_minutes / 60 * 64) : 48;
                        
                        return (
                          <motion.div
                            key={event.id}
                            draggable
                            onDragStart={(e) => handleDragStart(event, e)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute w-[calc(100%-16px)] mx-2 rounded-lg p-3 shadow-md border-l-4 cursor-move hover:shadow-xl hover:opacity-75 transition-all"
                            style={{ 
                              top: `${topPosition}px`,
                              height: `${Math.max(height, 48)}px`,
                              borderLeftColor: event.session_color || '#6366f1',
                              backgroundColor: hexToLightBg(event.session_color || '#6366f1'),
                              zIndex: 20
                            }}
                            onClick={(e) => handleEventClick(event, e)}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-slate-800 truncate">{event.title}</h4>
                                {event.theme && (
                                  <p className="text-xs text-slate-600 truncate">Thème: {event.theme}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                              <Clock className="w-3 h-3" />
                              <span>{event.start_time} - {event.end_time}</span>
                              {event.duration_minutes && (
                                <span className="text-slate-500">({event.duration_minutes} min)</span>
                              )}
                            </div>
                            {event.description && height > 80 && (
                              <p className="text-xs text-slate-600 line-clamp-2">{event.description}</p>
                            )}
                            {event.assigned_athletes && event.assigned_athletes.length > 0 && height > 60 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-500">
                                  {event.assigned_athletes.length} athlète(s)
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'édition de séance */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la séance d'entraînement</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Date de la séance *</Label>
                <Input
                  type="date"
                  value={editingEvent.event_date}
                  onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Titre de la séance *</Label>
                <Input
                  placeholder="Ex: Séance de fractionné"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Thème</Label>
                <Input
                  placeholder="Ex: Endurance, Vitesse, Technique..."
                  value={editingEvent.theme || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, theme: e.target.value })}
                />
              </div>

              <div>
                <Label>Type de séance</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {sessionCategories.map((category) => (
                    <div
                      key={category.value}
                      className={`relative flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        editingEvent.session_category === category.value
                          ? 'border-slate-400 bg-slate-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setEditingEvent({
                          ...editingEvent,
                          session_category: category.value,
                          session_color: editingEvent.session_category === category.value ? editingEvent.session_color : category.defaultColor
                        });
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0"
                      >
                        {editingEvent.session_category === category.value && (
                          <div className="w-2 h-2 rounded-full bg-slate-700" />
                        )}
                      </div>
                      <div
                        className="w-6 h-6 rounded border border-slate-300 flex-shrink-0"
                        style={{
                          backgroundColor: editingEvent.session_category === category.value ? editingEvent.session_color : category.defaultColor
                        }}
                      />
                      <span className="text-sm flex-1">{category.label}</span>
                      {editingEvent.session_category === category.value && (
                        <input
                          type="color"
                          value={editingEvent.session_color}
                          onChange={(e) => setEditingEvent({ ...editingEvent, session_color: e.target.value })}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Heure de début *</Label>
                  <Input
                    type="time"
                    value={editingEvent.start_time}
                    onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Durée (minutes) *</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 90"
                    value={editingEvent.duration_minutes}
                    onChange={(e) => setEditingEvent({ ...editingEvent, duration_minutes: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Description de la séance</Label>
                <Textarea
                  placeholder="Détails de la séance, exercices prévus..."
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={4}
                />
              </div>

              <AthleteAssignmentPicker
                athletes={athletes}
                selected={editingEvent.assigned_athletes || []}
                onChange={(emails) => setEditingEvent({ ...editingEvent, assigned_athletes: emails })}
                isAdmin={isAdmin}
                coachClub={coachClub}
                allGroups={allGroups}
                allClubs={allClubs}
                coachOwnGroups={coachOwnGroups}
                idPrefix="edit-athlete"
                emptyLabel="Aucun athlète dans votre groupe"
              />

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button 
                  variant="destructive" 
                  onClick={() => deleteEventMutation.mutate(editingEvent.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Annuler
                </Button>
                <Button onClick={handleUpdateEvent}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de création de séance */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une séance d'entraînement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Date de la séance *</Label>
              <Input
                type="date"
                value={newSession.event_date}
                onChange={(e) => setNewSession({ ...newSession, event_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Titre de la séance *</Label>
              <Input
                placeholder="Ex: Séance de fractionné"
                value={newSession.title}
                onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Thème</Label>
              <Input
                placeholder="Ex: Endurance, Vitesse, Technique..."
                value={newSession.theme}
                onChange={(e) => setNewSession({ ...newSession, theme: e.target.value })}
              />
            </div>

            <div>
              <Label>Type de séance</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {sessionCategories.map((category) => (
                  <div
                    key={category.value}
                    className={`relative flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      newSession.session_category === category.value
                        ? 'border-slate-400 bg-slate-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setNewSession({
                        ...newSession,
                        session_category: category.value,
                        session_color: category.defaultColor
                      });
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0"
                    >
                      {newSession.session_category === category.value && (
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                      )}
                    </div>
                    <div
                      className="w-6 h-6 rounded border border-slate-300 flex-shrink-0"
                      style={{
                        backgroundColor: newSession.session_category === category.value ? newSession.session_color : category.defaultColor
                      }}
                    />
                    <span className="text-sm flex-1">{category.label}</span>
                    {newSession.session_category === category.value && (
                      <input
                        type="color"
                        value={newSession.session_color}
                        onChange={(e) => setNewSession({ ...newSession, session_color: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Heure de début *</Label>
                <Input
                  type="time"
                  value={newSession.start_time}
                  onChange={(e) => setNewSession({ ...newSession, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Durée (minutes) *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 90"
                  value={newSession.duration_minutes}
                  onChange={(e) => setNewSession({ ...newSession, duration_minutes: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Description de la séance</Label>
              <Textarea
                placeholder="Détails de la séance, exercices prévus..."
                value={newSession.description}
                onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
                rows={4}
              />
            </div>

            {/* Récurrence */}
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <Label className="font-semibold text-slate-700">Récurrence</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setNewSession({ ...newSession, recurrence: 'none' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${newSession.recurrence === 'none' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  Aucune
                </button>
                <button
                  type="button"
                  onClick={() => setNewSession({ ...newSession, recurrence: 'weekly' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${newSession.recurrence === 'weekly' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  Hebdomadaire
                </button>
              </div>

              {newSession.recurrence === 'weekly' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">Jours de répétition</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ label: 'Lun', value: 1 }, { label: 'Mar', value: 2 }, { label: 'Mer', value: 3 }, { label: 'Jeu', value: 4 }, { label: 'Ven', value: 5 }, { label: 'Sam', value: 6 }, { label: 'Dim', value: 0 }].map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const days = newSession.recurrence_days.includes(day.value)
                              ? newSession.recurrence_days.filter(d => d !== day.value)
                              : [...newSession.recurrence_days, day.value];
                            setNewSession({ ...newSession, recurrence_days: days });
                          }}
                          className={`w-12 h-10 rounded-lg text-sm font-medium border transition-colors ${
                            newSession.recurrence_days.includes(day.value)
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600 mb-1 block">Répéter jusqu'au</Label>
                    <Input
                      type="date"
                      value={newSession.recurrence_end_date}
                      min={newSession.event_date}
                      onChange={(e) => setNewSession({ ...newSession, recurrence_end_date: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <AthleteAssignmentPicker
              athletes={athletes}
              selected={newSession.assigned_athletes}
              onChange={(emails) => setNewSession({ ...newSession, assigned_athletes: emails })}
              isAdmin={isAdmin}
              coachClub={coachClub}
              allGroups={allGroups}
              allClubs={allClubs}
              coachOwnGroups={coachOwnGroups}
              idPrefix="athlete"
              emptyLabel="Aucun athlète dans votre groupe"
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateSession}>
                Créer la séance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
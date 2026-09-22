import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users, CheckCircle2, Plus, Info, FileText, XCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';

const hexToLightBg = (hex) => {
  if (!hex || !hex.startsWith('#')) return '#e0e7ff';
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*0.18+255*0.82)},${Math.round(g*0.18+255*0.82)},${Math.round(b*0.18+255*0.82)})`;
};
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import CustomQuestionnaireForm from '../questionnaire/CustomQuestionnaireForm';
import { cn } from "@/lib/utils";

// Colonne scrollable style drum roll
function ScrollColumn({ items, value, onChange, label }) {
  const ITEM_H = 44;
  const VISIBLE = 5;
  const containerRef = React.useRef(null);
  const isScrolling = React.useRef(false);
  const scrollTimer = React.useRef(null);

  // Scroll vers la valeur courante sans animation (init) ou avec (changement externe)
  const scrollToValue = React.useCallback((val, smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    const idx = items.indexOf(val);
    if (idx < 0) return;
    el.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
  }, [items]);

  // Init scroll position quand le popover s'ouvre (value change)
  React.useEffect(() => {
    // Petit délai pour laisser le DOM se rendre avant de scroller
    const timer = setTimeout(() => scrollToValue(value, false), 50);
    return () => clearTimeout(timer);
  }, [value, scrollToValue]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    // Snap : on attend la fin du scroll pour valider la valeur
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      // Snap scroll to nearest
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
      onChange(items[clamped]);
    }, 80);
  };

  const handleClick = (item) => {
    onChange(item);
    scrollToValue(item, true);
  };

  const containerHeight = ITEM_H * VISIBLE;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-slate-500 mb-1">{label}</span>
      <div className="relative" style={{ width: 64, height: containerHeight }}>
        {/* Highlight band au centre */}
        <div
          className="absolute left-0 right-0 pointer-events-none rounded-md border border-slate-200 bg-slate-100"
          style={{ top: ITEM_H * 2, height: ITEM_H, zIndex: 0 }}
        />
        {/* Fade haut */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: ITEM_H * 1.5, background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, transparent 100%)', zIndex: 2 }}
        />
        {/* Fade bas */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: ITEM_H * 1.5, background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, transparent 100%)', zIndex: 2 }}
        />
        {/* Liste scrollable */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            height: `${containerHeight}px`,
            overflowY: 'scroll',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ height: ITEM_H * 2 }} />
          {items.map((item) => (
            <div
              key={item}
              onClick={() => handleClick(item)}
              className="flex items-center justify-center cursor-pointer select-none"
              style={{ height: ITEM_H }}
            >
              <span className={item === value
                ? 'text-xl font-semibold text-slate-900'
                : 'text-base text-slate-400'
              }>
                {item}
              </span>
            </div>
          ))}
          <div style={{ height: ITEM_H * 2 }} />
        </div>
      </div>
    </div>
  );
}

// Composant sélecteur d'heure
function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tempHours, setTempHours] = useState('08');
  const [tempMinutes, setTempMinutes] = useState('00');

  const hourItems = [...Array(24)].map((_, i) => String(i).padStart(2, '0'));
  const minuteItems = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const handleOpen = (isOpen) => {
    if (isOpen) {
      const p = value ? value.split(':') : ['08', '00'];
      setTempHours(p[0] || '08');
      setTempMinutes(p[1] || '00');
    }
    setOpen(isOpen);
  };

  const handleConfirm = () => {
    onChange(`${tempHours}:${tempMinutes}`);
    setOpen(false);
  };

  const handleReset = () => {
    setTempHours('08');
    setTempMinutes('00');
  };

  const displayHours = value ? value.split(':')[0] : '08';
  const displayMinutes = value ? value.split(':')[1] : '00';

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal gap-2">
          <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {displayHours}:{displayMinutes}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="rounded-xl shadow-lg border border-slate-200 bg-white p-0 overflow-hidden"
        align="center"
        side="bottom"
        sideOffset={8}
        style={{ width: 220, position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-700 text-center">Sélectionner l'heure</p>
        </div>
        <div className="flex flex-col items-center gap-3 p-4">
          {/* Colonnes scrollables */}
          <div className="flex items-center gap-1">
            <ScrollColumn items={hourItems} value={tempHours} onChange={setTempHours} label="Heure" />
            <span className="text-2xl font-bold text-slate-400 mt-5 px-1">:</span>
            <ScrollColumn items={minuteItems} value={tempMinutes} onChange={setTempMinutes} label="Min" />
          </div>
          {/* Boutons */}
          <div className="flex items-center justify-between w-full gap-2 pt-1 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-500 text-xs">
              Réinitialiser
            </Button>
            <Button size="sm" onClick={handleConfirm} className="bg-slate-900 hover:bg-slate-700 text-white rounded-lg px-4">
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Composant sélecteur de date universel
function DatePickerButton({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          {value ? format(date, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
            initialFocus
            locale={fr}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function EventCalendar({ userEmail, selectedAthleteEmails = [], showAllEvents = false }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEarlyHours, setShowEarlyHours] = useState(false);
  const [showLateHours, setShowLateHours] = useState(false);
  const [selectedPastSession, setSelectedPastSession] = useState(null);
  const [showQuestionnaireDialog, setShowQuestionnaireDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editSession, setEditSession] = useState(null);

  const [newSession, setNewSession] = useState({
    title: '',
    theme: '',
    session_category: 'seance_terrain',
    session_color: '#f97316',
    start_time: '08:00',
    duration_minutes: '',
    description: '',
    event_date: format(new Date(), 'yyyy-MM-dd')
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
    queryKey: ['events', userEmail, selectedAthleteEmails, showAllEvents],
    queryFn: async () => {
      if (showAllEvents) {
        return base44.entities.Event.list();
      }
      if (selectedAthleteEmails.length > 0) {
        const allEvents = await base44.entities.Event.list();
        return allEvents.filter(event =>
          selectedAthleteEmails.includes(event.user_email) ||
          (event.assigned_athletes && event.assigned_athletes.some(email => selectedAthleteEmails.includes(email)))
        );
      }
      const userEvents = await base44.entities.Event.filter({ user_email: userEmail });
      const assignedEvents = await base44.entities.Event.list();
      const athleteAssignedEvents = assignedEvents.filter(event =>
        event.assigned_athletes && event.assigned_athletes.includes(userEmail)
      );
      return [...userEvents, ...athleteAssignedEvents];
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (eventId) => base44.entities.Event.delete(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEventDetailsDialog(false);
      setSelectedEvent(null);
      toast.success('Séance supprimée');
    }
  });

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => base44.entities.Event.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreateDialog(false);
      setNewSession({
        title: '',
        theme: '',
        session_category: 'seance_terrain',
        session_color: '#f97316',
        start_time: '08:00',
        duration_minutes: '',
        description: '',
        event_date: format(new Date(), 'yyyy-MM-dd')
      });
      toast.success('Séance créée avec succès');
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, sessionData }) => base44.entities.Event.update(id, sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEditDialog(false);
      setEditSession(null);
      toast.success('Séance modifiée avec succès');
    }
  });

  const handleCreateSession = async () => {
    if (!newSession.title || !newSession.start_time || !newSession.duration_minutes) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const startTime = newSession.start_time;
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = startMinutes + parseInt(newSession.duration_minutes);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    createSessionMutation.mutate({
      user_email: userEmail,
      title: newSession.title,
      theme: newSession.theme,
      session_category: newSession.session_category,
      session_color: newSession.session_color,
      event_date: newSession.event_date,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: parseInt(newSession.duration_minutes),
      description: newSession.description,
      assigned_athletes: [userEmail],
      ...(athleteQuestionnaire ? { questionnaire_template_id: athleteQuestionnaire.id } : {})
    });
  };

  const handleEditSession = async () => {
    if (!editSession.title || !editSession.start_time || !editSession.duration_minutes) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const startTime = editSession.start_time;
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = startMinutes + parseInt(editSession.duration_minutes);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    updateSessionMutation.mutate({
      id: editSession.id,
      sessionData: {
        title: editSession.title,
        theme: editSession.theme,
        session_category: editSession.session_category,
        session_color: editSession.session_color,
        event_date: editSession.event_date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: parseInt(editSession.duration_minutes),
        description: editSession.description,
      }
    });
  };

  const { data: questionnaireResponses = [] } = useQuery({
    queryKey: ['athlete-responses', userEmail],
    queryFn: () => base44.entities.QuestionnaireResponse.filter({ athlete_email: userEmail }),
  });

  const { data: athleteQuestionnaire } = useQuery({
    queryKey: ['athlete-questionnaire', userEmail],
    queryFn: async () => {
      const templates = await base44.entities.QuestionnaireTemplate.list();
      return templates.find(t => t.is_active && t.assigned_athletes?.includes(userEmail)) || null;
    },
    enabled: !!userEmail,
  });

  const eventsForSelectedDate = events.filter(event =>
    isSameDay(parseISO(event.event_date), selectedDate)
  ).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const datesWithEvents = events.map(event => parseISO(event.event_date));

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



  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventDetailsDialog(true);
  };

  const viewDates = getViewDates();

  return (
    <div className="space-y-6">
      {/* En-tête de navigation */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-4">
              <Button variant="outline" size="icon" onClick={() => navigateDate('prev')} className="flex-shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0 flex-1 text-center">
                <CardTitle className="text-base md:text-xl truncate">
                  {view === 'day' && format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  {view === 'week' && `Semaine du ${format(startOfWeek(currentDate, { locale: fr }), 'd MMM', { locale: fr })}`}
                  {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: fr })}
                </CardTitle>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateDate('next')} className="flex-shrink-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex border rounded-lg overflow-hidden">
                <Button variant={view === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setView('day')} className="rounded-none text-xs md:text-sm px-2 md:px-4">Jour</Button>
                <Button variant={view === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setView('week')} className="rounded-none border-x text-xs md:text-sm px-2 md:px-4">Semaine</Button>
                <Button variant={view === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setView('month')} className="rounded-none text-xs md:text-sm px-2 md:px-4">Mois</Button>
              </div>
              <Button
                onClick={() => {
                  setNewSession({ ...newSession, event_date: format(currentDate, 'yyyy-MM-dd') });
                  setShowCreateDialog(true);
                }}
                className="gap-2 text-xs md:text-sm" size="sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Créer une séance</span>
                <span className="sm:hidden">Créer</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Vue calendrier */}
      <Card>
        <CardContent className="p-2 md:p-6">
          {view === 'month' && (
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                <div key={idx} className="text-center font-semibold text-slate-600 text-xs md:text-sm py-1 md:py-2">
                  <span className="md:hidden">{day}</span>
                  <span className="hidden md:inline">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][idx]}</span>
                </div>
              ))}
              {viewDates.map((date, idx) => {
                const dayEvents = events.filter(event => isSameDay(parseISO(event.event_date), date));
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-[60px] md:min-h-[80px] p-1 md:p-2 border rounded-lg text-left active:bg-slate-100 transition-colors
                      ${!isCurrentMonth ? 'opacity-40' : ''}
                      ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'border-slate-200'}
                      ${isToday && !isSelected ? 'border-blue-300' : ''}`}
                  >
                    <div className={`font-medium text-xs md:text-sm mb-0.5 md:mb-1 ${isToday ? 'text-blue-600 font-bold' : ''}`}>{format(date, 'd')}</div>
                    <div className="space-y-0.5 md:space-y-1">
                      {dayEvents.slice(0, window.innerWidth < 768 ? 1 : 2).map((event, i) => (
                        <div key={i} className="text-[10px] md:text-xs px-1 md:px-2 py-0.5 md:py-1 rounded truncate border-l-2"
                          style={{ borderLeftColor: event.session_color || '#6366f1', backgroundColor: hexToLightBg(event.session_color || '#6366f1') }}>
                          <span className="hidden sm:inline">{event.start_time} </span>{event.title}
                        </div>
                      ))}
                      {dayEvents.length > (window.innerWidth < 768 ? 1 : 2) && (
                        <div className="text-[10px] md:text-xs text-slate-500 pl-1 md:pl-2">+{dayEvents.length - (window.innerWidth < 768 ? 1 : 2)}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {view === 'week' && (
            <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2">
              <div className="w-12 md:w-16 flex-shrink-0 pt-10 md:pt-12">
                {showEarlyHours ? (
                  <Button variant="ghost" size="sm" className="h-8 w-full mb-1" onClick={() => setShowEarlyHours(false)}><ChevronDown className="w-4 h-4" /></Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 w-full mb-1" onClick={() => setShowEarlyHours(true)}><ChevronUp className="w-4 h-4" /></Button>
                )}
                {(() => {
                  const { startHour, endHour } = getDisplayHours();
                  return [...Array(endHour - startHour)].map((_, idx) => {
                    const hour = startHour + idx;
                    return (
                      <div key={hour} className="h-12 md:h-16 text-[10px] md:text-xs text-slate-500 pr-1 md:pr-2 text-right flex items-start pt-0.5">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    );
                  });
                })()}
                {showLateHours ? (
                  <Button variant="ghost" size="sm" className="h-8 w-full mt-1" onClick={() => setShowLateHours(false)}><ChevronUp className="w-4 h-4" /></Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 w-full mt-1" onClick={() => setShowLateHours(true)}><ChevronDown className="w-4 h-4" /></Button>
                )}
              </div>
              {viewDates.map((date, idx) => {
                const dayEvents = events.filter(event => isSameDay(parseISO(event.event_date), date));
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                const { startHour, endHour } = getDisplayHours();
                const displayHeight = (endHour - startHour) * (window.innerWidth < 768 ? 48 : 64);
                return (
                  <div key={idx} className={`flex-1 min-w-[80px] md:min-w-[120px] border rounded-lg ${isSelected ? 'border-blue-400 bg-blue-50' : isToday ? 'border-blue-300' : 'border-slate-200'}`}>
                    <button onClick={() => setSelectedDate(date)} className="w-full p-2 md:p-3 text-center border-b active:bg-slate-100">
                      <div className="text-[10px] md:text-xs text-slate-500">{format(date, 'EEE', { locale: fr })}</div>
                      <div className={`text-base md:text-lg font-semibold ${isToday ? 'text-blue-600' : ''}`}>{format(date, 'd')}</div>
                    </button>
                    <div className="relative" style={{ height: `${displayHeight}px` }}>
                      {[...Array(endHour - startHour)].map((_, idx) => {
                        const hour = startHour + idx;
                        const hourHeight = window.innerWidth < 768 ? 48 : 64;
                        return (
                          <div key={hour}>
                            <div className="absolute w-full border-t border-slate-100" style={{ top: `${idx * hourHeight}px`, height: `${hourHeight}px` }} />
                            <div className="absolute w-full border-t border-slate-50" style={{ top: `${idx * hourHeight + hourHeight / 2}px`, height: `${hourHeight / 2}px` }} />
                          </div>
                        );
                      })}
                      {dayEvents.map((event, i) => {
                        const [eventHour, eventMin] = event.start_time.split(':').map(Number);
                        const hourHeight = window.innerWidth < 768 ? 48 : 64;
                        const topPosition = ((eventHour - startHour) * hourHeight) + (eventMin / 60 * hourHeight);
                        const height = event.duration_minutes ? (event.duration_minutes / 60 * hourHeight) : (hourHeight / 2);
                        if (eventHour < startHour || eventHour >= endHour) return null;
                        return (
                          <div
                            key={i}
                            className="absolute w-[calc(100%-4px)] md:w-[calc(100%-8px)] mx-0.5 md:mx-1 text-[10px] md:text-xs px-1 md:px-2 py-0.5 md:py-1 rounded shadow-sm overflow-hidden border-l-2 md:border-l-3 cursor-pointer active:scale-95 transition-all"
                            style={{ top: `${topPosition}px`, height: `${Math.max(height, 20)}px`, borderLeftColor: event.session_color || '#6366f1', backgroundColor: hexToLightBg(event.session_color || '#6366f1'), zIndex: 10 }}
                            onClick={() => handleEventClick(event)}
                          >
                            <div className="font-medium truncate">{event.start_time}</div>
                            <div className="truncate text-slate-700 hidden md:block">{event.title}</div>
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
                <h3 className="text-2xl font-bold text-slate-800">{format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}</h3>
              </div>
              <div className="flex gap-4">
                <div className="w-16 flex-shrink-0 pt-2">
                  {showEarlyHours ? (
                    <Button variant="ghost" size="sm" className="h-8 w-full mb-1" onClick={() => setShowEarlyHours(false)}><ChevronDown className="w-4 h-4" /></Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 w-full mb-1" onClick={() => setShowEarlyHours(true)}><ChevronUp className="w-4 h-4" /></Button>
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
                    <Button variant="ghost" size="sm" className="h-8 w-full mt-1" onClick={() => setShowLateHours(false)}><ChevronUp className="w-4 h-4" /></Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 w-full mt-1" onClick={() => setShowLateHours(true)}><ChevronDown className="w-4 h-4" /></Button>
                  )}
                </div>
                <div className="flex-1 border rounded-lg relative bg-white" style={{ height: `${(() => { const { startHour, endHour } = getDisplayHours(); return (endHour - startHour) * 64; })()}px` }}>
                  {(() => {
                    const { startHour, endHour } = getDisplayHours();
                    return [...Array(endHour - startHour)].map((_, idx) => {
                      const hour = startHour + idx;
                      return (
                        <div key={hour}>
                          <div className="absolute w-full border-t border-slate-100" style={{ top: `${idx * 64}px`, height: '64px' }}>
                            <div className="absolute top-0 left-0 right-0 h-px bg-slate-200" />
                          </div>
                          <div className="absolute w-full border-t border-slate-50" style={{ top: `${idx * 64 + 32}px`, height: '32px' }} />
                        </div>
                      );
                    });
                  })()}
                  {(() => {
                    const eventsForSelectedDate = events.filter(event =>
                      isSameDay(parseISO(event.event_date), currentDate)
                    ).sort((a, b) => a.start_time.localeCompare(b.start_time));
                    if (eventsForSelectedDate.length === 0) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                          <div className="text-center">
                            <CalendarIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
                            <p>Aucun événement ce jour</p>
                          </div>
                        </div>
                      );
                    }
                    const { startHour } = getDisplayHours();
                    return eventsForSelectedDate.map((event) => {
                      const [eventHour, eventMin] = event.start_time.split(':').map(Number);
                      const topPosition = ((eventHour - startHour) * 64) + (eventMin / 60 * 64);
                      const height = event.duration_minutes ? (event.duration_minutes / 60 * 64) : 48;
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute w-[calc(100%-16px)] mx-2 rounded-lg p-3 shadow-md border-l-4 cursor-pointer hover:shadow-xl transition-all"
                          style={{ top: `${topPosition}px`, height: `${Math.max(height, 48)}px`, borderLeftColor: event.session_color || '#6366f1', backgroundColor: hexToLightBg(event.session_color || '#6366f1'), zIndex: 20 }}
                          onClick={() => handleEventClick(event)}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-slate-800 truncate">{event.title}</h4>
                              {event.theme && <p className="text-xs text-slate-600 truncate">Thème: {event.theme}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                            <Clock className="w-3 h-3" />
                            <span>{event.start_time} - {event.end_time}</span>
                            {event.duration_minutes && <span className="text-slate-500">({event.duration_minutes} min)</span>}
                          </div>
                          {event.description && height > 80 && <p className="text-xs text-slate-600 line-clamp-2">{event.description}</p>}
                          {event.assigned_athletes && event.assigned_athletes.length > 0 && height > 60 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-500">{event.assigned_athletes.length} athlète(s)</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog des détails de la séance */}
      <Dialog open={showEventDetailsDialog} onOpenChange={setShowEventDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Détails de la séance</DialogTitle></DialogHeader>
          {selectedEvent && (() => {
            const eventDate = parseISO(selectedEvent.event_date);
            const now = new Date();
            let isPastSession;
            if (selectedEvent.end_time) {
              const eventEndDateTime = new Date(`${selectedEvent.event_date}T${selectedEvent.end_time}`);
              isPastSession = now > eventEndDateTime;
            } else {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              yesterday.setHours(0, 0, 0, 0);
              const eventDateOnly = new Date(eventDate);
              eventDateOnly.setHours(0, 0, 0, 0);
              isPastSession = eventDateOnly <= yesterday;
            }
            const hasQuestionnaire = !!selectedEvent.questionnaire_template_id;
            const hasResponded = questionnaireResponses.some(r => r.event_id === selectedEvent.id);
            const categoryLabel = sessionCategories.find(c => c.value === selectedEvent.session_category)?.label || 'Non spécifié';
            return (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border-l-4" style={{ borderLeftColor: selectedEvent.session_color || '#6366f1', backgroundColor: selectedEvent.session_color ? `${selectedEvent.session_color}15` : '#f1f5f9' }}>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-600"><CalendarIcon className="w-4 h-4" /><span>{format(eventDate, 'EEEE d MMMM yyyy', { locale: fr })}</span></div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-1"><Clock className="w-4 h-4" /><span>{selectedEvent.start_time} - {selectedEvent.end_time}</span>{selectedEvent.duration_minutes && <span className="text-slate-500">({selectedEvent.duration_minutes} min)</span>}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Info className="w-4 h-4" />Type de séance</div>
                  <Badge className="bg-slate-100 text-slate-700">{categoryLabel}</Badge>
                </div>
                {selectedEvent.theme && <div className="space-y-2"><div className="text-sm font-medium text-slate-700">Thème</div><p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedEvent.theme}</p></div>}
                {selectedEvent.description && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><FileText className="w-4 h-4" />Description</div>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                )}
                {selectedEvent.assigned_athletes && selectedEvent.assigned_athletes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Users className="w-4 h-4" />Athlètes assignés</div>
                    <div className="bg-slate-50 p-3 rounded-lg"><p className="text-sm text-slate-600">{selectedEvent.assigned_athletes.length} athlète(s) assigné(s)</p></div>
                  </div>
                )}
                {hasQuestionnaire && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><FileText className="w-4 h-4" />Questionnaire post-séance</div>
                    {hasResponded ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div><p className="text-sm font-medium text-green-800">Questionnaire complété</p><p className="text-xs text-green-700">Vous avez répondu au questionnaire de cette séance</p></div>
                      </div>
                    ) : isPastSession ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div className="flex-1"><p className="text-sm font-medium text-amber-800">Questionnaire non complété</p><p className="text-xs text-amber-700">Cette séance est passée et vous n'avez pas encore répondu</p></div>
                        <Button size="sm" onClick={() => { setSelectedPastSession(selectedEvent); setShowEventDetailsDialog(false); setShowQuestionnaireDialog(true); }} className="bg-amber-600 hover:bg-amber-700">Remplir</Button>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div><p className="text-sm font-medium text-blue-800">Questionnaire disponible après la séance</p><p className="text-xs text-blue-700">Vous pourrez le remplir une fois la séance terminée</p></div>
                      </div>
                    )}
                  </div>
                )}
                {!hasQuestionnaire && <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg"><p className="text-sm text-slate-600">Aucun questionnaire associé à cette séance</p></div>}
                {selectedEvent.user_email === userEmail && (
                  <div className="pt-4 border-t space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        setEditSession({
                          id: selectedEvent.id,
                          title: selectedEvent.title,
                          theme: selectedEvent.theme || '',
                          session_category: selectedEvent.session_category,
                          session_color: selectedEvent.session_color,
                          start_time: selectedEvent.start_time,
                          duration_minutes: selectedEvent.duration_minutes,
                          description: selectedEvent.description || '',
                          event_date: selectedEvent.event_date
                        });
                        setShowEventDetailsDialog(false);
                        setShowEditDialog(true);
                      }}
                    >
                      Modifier la séance
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        if (confirm('Supprimer cette séance ?')) {
                          deleteSessionMutation.mutate(selectedEvent.id);
                        }
                      }}
                    >
                      Supprimer la séance
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog questionnaire séance passée */}
      <Dialog open={showQuestionnaireDialog} onOpenChange={setShowQuestionnaireDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Questionnaire de la séance</DialogTitle></DialogHeader>
          {selectedPastSession && (() => {
            const hasResponded = questionnaireResponses.some(r => r.event_id === selectedPastSession.id);
            return (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-slate-800">{selectedPastSession.title}</h3>
                  <p className="text-sm text-slate-600">{format(parseISO(selectedPastSession.event_date), 'EEEE d MMMM yyyy', { locale: fr })}</p>
                </div>
                {hasResponded ? (
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <p className="text-lg font-semibold text-green-800">Vous avez déjà répondu à ce questionnaire</p>
                    </div>
                    <p className="text-sm text-green-700">Merci pour votre retour sur cette séance</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 text-center">Vous n'avez pas encore répondu au questionnaire de cette séance</p>
                    </div>
                    <CustomQuestionnaireForm
                      templateId={selectedPastSession.questionnaire_template_id}
                      userEmail={userEmail}
                      forceDate={selectedPastSession.event_date}
                      eventId={selectedPastSession.id}
                      onSuccess={() => { setShowQuestionnaireDialog(false); setSelectedPastSession(null); }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de création de séance */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une séance personnelle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">

            {/* Date - sélecteur universel */}
            <div>
              <Label className="mb-1.5 block">Date de la séance *</Label>
              <DatePickerButton
                value={newSession.event_date}
                onChange={(date) => setNewSession({ ...newSession, event_date: date })}
              />
            </div>

            <div>
              <Label>Titre de la séance *</Label>
              <Input placeholder="Ex: Séance de fractionné" value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} />
            </div>

            <div>
              <Label>Thème</Label>
              <Input placeholder="Ex: Endurance, Vitesse, Technique..." value={newSession.theme} onChange={(e) => setNewSession({ ...newSession, theme: e.target.value })} />
            </div>

            <div>
              <Label>Type de séance</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {sessionCategories.map((category) => (
                  <div
                    key={category.value}
                    className={`relative flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${newSession.session_category === category.value ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    onClick={() => setNewSession({ ...newSession, session_category: category.value, session_color: category.defaultColor })}
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                      {newSession.session_category === category.value && <div className="w-2 h-2 rounded-full bg-slate-700" />}
                    </div>
                    <div className="w-6 h-6 rounded border border-slate-300 flex-shrink-0" style={{ backgroundColor: newSession.session_category === category.value ? newSession.session_color : category.defaultColor }} />
                    <span className="text-sm flex-1">{category.label}</span>
                    {newSession.session_category === category.value && (
                      <input type="color" value={newSession.session_color} onChange={(e) => setNewSession({ ...newSession, session_color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Heure + Durée */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="mb-1.5 block">Heure de début *</Label>
                <TimePicker
                  value={newSession.start_time}
                  onChange={(time) => setNewSession({ ...newSession, start_time: time })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Durée (minutes) *</Label>
                <Input type="number" placeholder="Ex: 60" value={newSession.duration_minutes} onChange={(e) => setNewSession({ ...newSession, duration_minutes: e.target.value })} className="w-full" />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea placeholder="Détails de la séance..." value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} rows={4} />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
              <Button onClick={handleCreateSession}>Créer la séance</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de modification de séance */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la séance</DialogTitle>
          </DialogHeader>
          {editSession && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="mb-1.5 block">Date de la séance *</Label>
                <DatePickerButton
                  value={editSession.event_date}
                  onChange={(date) => setEditSession({ ...editSession, event_date: date })}
                />
              </div>

              <div>
                <Label>Titre de la séance *</Label>
                <Input placeholder="Ex: Séance de fractionné" value={editSession.title} onChange={(e) => setEditSession({ ...editSession, title: e.target.value })} />
              </div>

              <div>
                <Label>Thème</Label>
                <Input placeholder="Ex: Endurance, Vitesse, Technique..." value={editSession.theme} onChange={(e) => setEditSession({ ...editSession, theme: e.target.value })} />
              </div>

              <div>
                <Label>Type de séance</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {sessionCategories.map((category) => (
                    <div
                      key={category.value}
                      className={`relative flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${editSession.session_category === category.value ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      onClick={() => setEditSession({ ...editSession, session_category: category.value, session_color: category.defaultColor })}
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                        {editSession.session_category === category.value && <div className="w-2 h-2 rounded-full bg-slate-700" />}
                      </div>
                      <div className="w-6 h-6 rounded border border-slate-300 flex-shrink-0" style={{ backgroundColor: editSession.session_category === category.value ? editSession.session_color : category.defaultColor }} />
                      <span className="text-sm flex-1">{category.label}</span>
                      {editSession.session_category === category.value && (
                        <input type="color" value={editSession.session_color} onChange={(e) => setEditSession({ ...editSession, session_color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <Label className="mb-1.5 block">Heure de début *</Label>
                  <TimePicker
                    value={editSession.start_time}
                    onChange={(time) => setEditSession({ ...editSession, start_time: time })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Durée (minutes) *</Label>
                  <Input type="number" placeholder="Ex: 60" value={editSession.duration_minutes} onChange={(e) => setEditSession({ ...editSession, duration_minutes: e.target.value })} className="w-full" />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea placeholder="Détails de la séance..." value={editSession.description} onChange={(e) => setEditSession({ ...editSession, description: e.target.value })} rows={4} />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annuler</Button>
                <Button onClick={handleEditSession}>Enregistrer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
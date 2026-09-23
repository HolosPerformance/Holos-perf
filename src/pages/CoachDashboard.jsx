import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AthleteDataChart from '../components/dashboard/AthleteDataChart';
import HistogramChart from '../components/dashboard/HistogramChart';
import BoxPlotChart, { autoBoxplotGroupBy, LOW_COUNT } from '../components/dashboard/BoxPlotChart';
import ZoomableChartCard from '../components/dashboard/ZoomableChartCard';
import AdvancedAnalyses from '../components/dashboard/analysis/AdvancedAnalyses';
import { CollapsibleAnalysis } from '../components/dashboard/analysis/AnalysisParts';
import MetricSelector from '../components/dashboard/MetricSelector';
import StatCard from '../components/dashboard/StatCard';
import SummaryStatsTable from '../components/dashboard/SummaryStatsTable';
import AdvancedStatsToggle from '../components/dashboard/AdvancedStatsToggle';
import { REFERENCE_STAT_DEFS, EMA_STAT_DEFS, EMPTY_ADVANCED_STATS, computeMetricStats } from '@/lib/advancedStats';
import {
  Users, Activity, TrendingUp, Calendar, Filter,
  RefreshCw, ArrowLeft, Search, Zap, Download,
  BoxSelect, Table2, BarChart3, MessageSquare
} from 'lucide-react';
import { format, subDays, isAfter, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const BOXPLOT_GROUP_LABELS = { day: 'Jour', week: 'Semaine', month: 'Mois' };

const defaultSessionTypeColors = [
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-slate-100 text-slate-600',
  'bg-green-100 text-green-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

// Virtual demo data
const generateDemoData = () => {
  const athletes = [
    { email: 'marie.dupont@email.com', name: 'Marie Dupont' },
    { email: 'lucas.martin@email.com', name: 'Lucas Martin' },
    { email: 'emma.bernard@email.com', name: 'Emma Bernard' },
    { email: 'thomas.petit@email.com', name: 'Thomas Petit' },
    { email: 'lea.moreau@email.com', name: 'Léa Moreau' }
  ];
  
  const sessionTypes = ['entrainement', 'competition', 'effort_type', 'off'];
  const logs = [];
  
  const today = new Date();
  
  athletes.forEach(athlete => {
    const daysCount = 30 + Math.floor(Math.random() * 15);
    
    for (let i = 0; i < daysCount; i++) {
      const date = subDays(today, i);
      if (Math.random() > 0.75) continue;
      
      const sessionType = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
      const isCompetition = sessionType === 'competition';
      const isOff = sessionType === 'off';
      
      logs.push({
        id: `demo-${athlete.email}-${i}`,
        athlete_email: athlete.email,
        athlete_name: athlete.name,
        training_date: format(date, 'yyyy-MM-dd'),
        session_type: sessionType,
        duration_minutes: isOff ? null : (60 + Math.floor(Math.random() * 90)),
        fatigue: Math.floor(30 + Math.random() * 50),
        intensite: isOff ? Math.floor(10 + Math.random() * 20) : (isCompetition ? Math.floor(70 + Math.random() * 30) : Math.floor(40 + Math.random() * 40)),
        sommeil: Math.floor(40 + Math.random() * 50),
        plaisir: Math.floor(50 + Math.random() * 45),
        harmonie_proches: Math.floor(50 + Math.random() * 40),
        maitrise_technique: Math.floor(45 + Math.random() * 45),
        maitrise_tactique: Math.floor(40 + Math.random() * 50),
        epanouissement: Math.floor(55 + Math.random() * 40),
        commentaire: Math.random() > 0.7 ? ['Bonne séance', 'Fatigue accumulée', 'Sensation de forme', 'Besoin de récupération', 'Excellente session'][Math.floor(Math.random() * 5)] : ''
      });
    }
  });
  
  return logs.sort((a, b) => new Date(b.training_date) - new Date(a.training_date));
};

// Default date range: last 30 days
const getDefaultDates = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(today, 'yyyy-MM-dd'),
  };
};

export default function CoachDashboard() {
  const { user } = useAuth();
  const [selectedAthleteEmails, setSelectedAthleteEmails] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedClubIds, setSelectedClubIds] = useState([]);
  const [startDate, setStartDate] = useState(() => getDefaultDates().start);
  const [endDate, setEndDate] = useState(() => getDefaultDates().end);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  // Indique que la sélection par défaut doit être recalculée une fois connus
  // les indicateurs ayant des données sur la période
  const needsDefaultSelection = useRef(false);
  const [groupBy, setGroupBy] = useState('day');
  const [sessionTypeFilters, setSessionTypeFilters] = useState(['entrainement', 'competition', 'effort_type', 'off', 'inconnu']);
  const [demoData] = useState(() => generateDemoData());
  const [athleteMetrics, setAthleteMetrics] = useState({ labels: {}, colors: {}, idToCanonical: {} });
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [dynamicSessionTypes, setDynamicSessionTypes] = useState({ labels: {}, colors: {} });
  const [customColors, setCustomColors] = useState({});
  // Statistiques avancées : réglage global + éventuels réglages individuels
  // par graphique (clé 'evolution' pour le graphique d'évolution, sinon la
  // clé de l'indicateur pour chaque histogramme).
  const [globalAdvancedStats, setGlobalAdvancedStats] = useState(EMPTY_ADVANCED_STATS);
  const [chartAdvancedStats, setChartAdvancedStats] = useState({});
  // Menus repliables, fermés à chaque arrivée sur la page
  const [showSummaryStats, setShowSummaryStats] = useState(false);
  const [showHistograms, setShowHistograms] = useState(false);
  const [showBoxplots, setShowBoxplots] = useState(false);
  // Regroupement des boxplots : null = automatique selon la longueur de la période
  const [boxplotGroupByChoice, setBoxplotGroupByChoice] = useState(null);
  const [showRemarks, setShowRemarks] = useState(false);

  useEffect(() => {
    if (user?.metric_colors) {
      setCustomColors(user.metric_colors);
    }
  }, [user?.email]);

  const handleColorChange = async (metricKey, newColor) => {
    const updated = { ...customColors, [metricKey]: newColor };
    setCustomColors(updated);
    // Sauvegarder dans le profil utilisateur
    await base44.auth.updateMe({ metric_colors: updated });
    // Mettre à jour les couleurs dans athleteMetrics en temps réel
    setAthleteMetrics(prev => ({
      ...prev,
      colors: { ...prev.colors, [metricKey]: newColor }
    }));
  };

  const isAdmin = user?.user_status === 'admin';
  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';

  const defaultColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
    '#f43f5e', '#a855f7', '#84cc16', '#6366f1',
    '#fb923c', '#34d399', '#60a5fa', '#f87171'
  ];

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      if (!isCoach) return null;
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0] || null;
    },
    enabled: isCoach && !!user?.email,
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club', user?.email],
    queryFn: async () => {
      if (!user?.email || !isCoach) return null;
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: !!user?.email && isCoach,
  });

  const { data: assignedTemplates = [] } = useQuery({
    queryKey: ['coach-templates', user?.email, coachGroup?.id, coachClub?.id],
    queryFn: async () => {
      if (!user?.email || (!isCoach && !isAdmin)) return [];
      if (isAdmin) {
        const templates = await base44.entities.QuestionnaireTemplate.list();
        return templates.filter(t => t.is_active !== false);
      }
      // Pour un coach : tous les templates assignés à ses athlètes (groupe + club)
      const templates = await base44.entities.QuestionnaireTemplate.list();
      const coachAthleteEmails = [
        ...(coachGroup?.athlete_emails || []),
        ...(coachClub?.athlete_emails || []),
      ];
      const uniqueEmails = [...new Set(coachAthleteEmails)];
      return templates.filter(t =>
        t.assigned_coaches?.includes(user.email) ||
        uniqueEmails.some(email => t.assigned_athletes?.includes(email))
      );
    },
    enabled: !!user && (isCoach || isAdmin),
  });

  const { data: realLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['questionnaire-responses-coach', user?.email, coachGroup?.id, coachClub?.id, assignedTemplates.map(t => t.id).join(',')],
    queryFn: async () => {
      let filteredResponses;
      if (isAdmin) {
        const allResponses = await base44.entities.QuestionnaireResponse.list('-submitted_date', 2000);
        const templateIds = assignedTemplates.map(t => t.id);
        filteredResponses = templateIds.length > 0 ? allResponses.filter(r => templateIds.includes(r.template_id)) : allResponses;
      } else if (isCoach) {
        const allResponses = await base44.entities.QuestionnaireResponse.list('-submitted_date', 1000);
        let coachAthleteEmails = [...(coachGroup?.athlete_emails || [])];
        if (!isIndividualView && coachClub) {
          coachAthleteEmails = [...new Set([...coachAthleteEmails, ...(coachClub.athlete_emails || [])])];
        }
        if (coachAthleteEmails.length === 0) return [];
        filteredResponses = allResponses.filter(r => coachAthleteEmails.includes(r.athlete_email));
      } else {
        return [];
      }
      const templateMap = {};
      assignedTemplates.forEach(t => { templateMap[t.id] = t; });
      return filteredResponses.map(response => {
        const submittedDate = response.submitted_date ? new Date(response.submitted_date) : new Date();
        const responseTemplate = templateMap[response.template_id];
        const transformedResponses = {};
        if (responseTemplate && response.responses) {
          responseTemplate.questions.forEach(question => {
            const responseValue = response.responses[question.id];
            if (responseValue !== undefined && responseValue !== null) {
              if (question.type === 'scale' || question.type === 'number') {
                // Store under original question id; canonical mapping applied at render time
                transformedResponses[question.id] = Number(responseValue);
              } else if (question.type === 'text' || question.type === 'textarea') {
                transformedResponses[question.id] = String(responseValue);
              } else {
                transformedResponses[question.id] = responseValue;
              }
            }
          });
        }
        const firstQuestionId = responseTemplate?.questions?.[0]?.id;
        const firstQuestion = responseTemplate?.questions?.[0];
        const hasSelectFirstQuestion = firstQuestion?.type === 'select';
        let sessionType = null;
        if (hasSelectFirstQuestion && firstQuestionId) {
          const rawVal = response.responses?.[firstQuestionId];
          if (rawVal !== undefined && rawVal !== null) {
            const choices = firstQuestion?.selectOptions?.choices || [];
            const singleVal = Array.isArray(rawVal) ? rawVal[0] : rawVal;
            const idx = parseInt(singleVal, 10);
            sessionType = (!isNaN(idx) && choices[idx]) ? choices[idx].label : singleVal;
          }
        }
        return {
          id: response.id,
          athlete_email: response.athlete_email,
          athlete_name: response.athlete_name,
          training_date: format(submittedDate, 'yyyy-MM-dd'),
          template_id: response.template_id,
          session_type: sessionType || (hasSelectFirstQuestion ? 'inconnu' : 'questionnaire'),
          duration_minutes: null,
          ...transformedResponses
        };
      });
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const { data: rawTrainingLogs = [] } = useQuery({
    queryKey: ['training-logs-coach-dashboard', user?.email, coachGroup?.id, coachClub?.id],
    queryFn: async () => {
      if (isAdmin) {
        return await base44.entities.TrainingLog.list('-training_date', 2000);
      } else if (isCoach) {
        let coachAthleteEmails = [...(coachGroup?.athlete_emails || [])];
        if (!isIndividualView && coachClub) {
          coachAthleteEmails = [...new Set([...coachAthleteEmails, ...(coachClub.athlete_emails || [])])];
        }
        if (coachAthleteEmails.length === 0) return [];
        const all = await base44.entities.TrainingLog.list('-training_date', 2000);
        return all.filter(l => coachAthleteEmails.includes(l.athlete_email));
      }
      return [];
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const mappedTrainingLogs = useMemo(() => rawTrainingLogs.map(log => ({
    id: log.id,
    athlete_email: log.athlete_email,
    athlete_name: log.athlete_name,
    training_date: log.training_date,
    template_id: null,
    session_type: log.session_type || 'entrainement',
    duration_minutes: log.duration_minutes,
    fatigue: log.fatigue,
    intensite: log.intensite,
    sommeil: log.sommeil,
    plaisir: log.plaisir,
    harmonie_proches: log.harmonie_proches,
    maitrise_technique: log.maitrise_technique,
    maitrise_tactique: log.maitrise_tactique,
    epanouissement: log.epanouissement,
    commentaire: log.commentaire,
  })), [rawTrainingLogs]);

  const hasRealAthletes = isCoach
    ? (coachGroup?.athlete_emails?.length || 0) > 0 || (coachClub?.athlete_emails?.length || 0) > 0
    : true;
  const combinedRealLogs = useMemo(() => [...realLogs, ...mappedTrainingLogs], [realLogs, mappedTrainingLogs]);
  const allLogs = combinedRealLogs.length > 0 ? combinedRealLogs : (hasRealAthletes ? [] : demoData);
  const isUsingDemoData = combinedRealLogs.length === 0 && !hasRealAthletes;



  const { data: allGroups = [] } = useQuery({
    queryKey: ['all-groups', user?.email],
    queryFn: async () => {
      if (isAdmin) return await base44.entities.Group.list();
      if (isCoach) return await base44.entities.Group.filter({ coach_email: user.email });
      return [];
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      return await base44.entities.User.list();
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const isIndividualView = localStorage.getItem('coachView') === 'individual';

  const { data: allClubs = [] } = useQuery({
    queryKey: ['all-clubs-coach-dashboard'],
    queryFn: async () => await base44.entities.Club.list(),
    enabled: !!user && isAdmin,
  });

  const selectableAthletes = useMemo(() => {
    if (isAdmin) {
      return allUsers
        .filter(u => u.user_status === 'athlete' || (u.role === 'user' && u.user_status !== 'coach' && u.user_status !== 'coach_pro' && u.user_status !== 'admin'))
        .map(u => ({ email: u.email, name: u.full_name }));
    } else if (isCoach) {
      let athleteEmails = [];
      if (coachClub && !isIndividualView) {
        athleteEmails = coachClub.athlete_emails || [];
      } else {
        athleteEmails = coachGroup?.athlete_emails || [];
      }
      return athleteEmails.map(email => {
        const u = allUsers.find(u => u.email === email);
        return { email, name: u?.full_name || u?.email || email };
      });
    }
    return [];
  }, [isAdmin, isCoach, allUsers, coachClub, isIndividualView, coachGroup]);

  // Pool d'athlètes affiché dans la liste à cocher : réduit aux groupes/clubs
  // sélectionnés s'il y en a, sinon le pool complet (club + groupe du coach, ou tous pour l'admin).
  const athletePool = useMemo(() => {
    if (selectedGroupIds.length === 0 && selectedClubIds.length === 0) return selectableAthletes;
    const narrowedEmails = new Set([
      ...selectedGroupIds.flatMap(id => allGroups.find(g => g.id === id)?.athlete_emails || []),
      ...selectedClubIds.flatMap(id => allClubs.find(c => c.id === id)?.athlete_emails || []),
    ]);
    return selectableAthletes.filter(a => narrowedEmails.has(a.email));
  }, [selectableAthletes, selectedGroupIds, selectedClubIds, allGroups, allClubs]);

  const toggleGroupFilter = (groupId) => {
    const group = allGroups.find(g => g.id === groupId);
    const emails = group?.athlete_emails || [];
    const isSelected = selectedGroupIds.includes(groupId);
    setSelectedGroupIds(prev => isSelected ? prev.filter(id => id !== groupId) : [...prev, groupId]);
    setSelectedAthleteEmails(prev => isSelected
      ? prev.filter(e => !emails.includes(e))
      : [...new Set([...prev, ...emails])]);
  };

  const toggleClubFilter = (clubId) => {
    const club = allClubs.find(c => c.id === clubId);
    const emails = club?.athlete_emails || [];
    const isSelected = selectedClubIds.includes(clubId);
    setSelectedClubIds(prev => isSelected ? prev.filter(id => id !== clubId) : [...prev, clubId]);
    setSelectedAthleteEmails(prev => isSelected
      ? prev.filter(e => !emails.includes(e))
      : [...new Set([...prev, ...emails])]);
  };

  const clearAthleteSelection = () => {
    setSelectedGroupIds([]);
    setSelectedClubIds([]);
    setSelectedAthleteEmails([]);
  };

  const userFilteredLogs = useMemo(() => {
    let logs = allLogs;

    if (isAdmin) {
      logs = allLogs;
    } else if (isCoach) {
      const coachAthleteEmails = selectableAthletes.map(a => a.email);
      logs = allLogs.filter(log => coachAthleteEmails.includes(log.athlete_email));
    } else {
      logs = allLogs.filter(log => log.athlete_email === user?.email);
    }

    if (isAdmin || isCoach) {
      // Aucune sélection précise : rien à afficher tant que l'utilisateur n'a rien choisi
      logs = selectedAthleteEmails.length > 0
        ? logs.filter(log => selectedAthleteEmails.includes(log.athlete_email))
        : [];
    }

    return logs;
  }, [allLogs, isAdmin, isCoach, selectableAthletes, user?.email, selectedAthleteEmails]);

  const athletesFromLogs = [...new Map(userFilteredLogs.map(log => [log.athlete_email, { 
    email: log.athlete_email, 
    name: log.athlete_name 
  }])).values()];

  const athletes = athletesFromLogs;

  const calculateMedian = (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  // Extract dynamic session types from the templates actually used in visible logs
  useEffect(() => {
    if ((isAdmin || isCoach) && userFilteredLogs.length === 0) {
      setDynamicSessionTypes({ labels: {}, colors: {} });
      setSessionTypeFilters([]);
      return;
    }

    // Get unique template IDs present in the currently visible logs
    const templateIdsInLogs = [...new Set(userFilteredLogs.map(log => log.template_id).filter(Boolean))];

    // Find the corresponding templates
    let relevantTemplates = templateIdsInLogs.length > 0
      ? assignedTemplates.filter(t => templateIdsInLogs.includes(t.id))
      : assignedTemplates;

    const labels = {};
    const colors = {};
    let colorIndex = 0;

    relevantTemplates.forEach(template => {
      const firstQuestion = template.questions?.[0];
      if (firstQuestion && firstQuestion.type === 'select') {
        const choices = firstQuestion.selectOptions?.choices || [];
        choices.forEach((choice) => {
          const key = choice.label;
          if (!labels[key]) {
            labels[key] = choice.label;
            colors[key] = defaultSessionTypeColors[colorIndex % defaultSessionTypeColors.length];
            colorIndex++;
          }
        });
      }
    });

    // Ajouter les types de séance des training logs si des données existent
    if (userFilteredLogs.some(l => !l.template_id)) {
      const TL_TYPES = {
        entrainement: { label: 'Entraînement', css: 'bg-blue-100 text-blue-700' },
        competition: { label: 'Compétition', css: 'bg-amber-100 text-amber-700' },
        effort_type: { label: 'Effort type', css: 'bg-purple-100 text-purple-700' },
        off: { label: 'Off', css: 'bg-slate-100 text-slate-600' },
      };
      Object.entries(TL_TYPES).forEach(([key, { label, css }]) => {
        if (!labels[key]) { labels[key] = label; colors[key] = css; }
      });
    }

    // Toujours inclure 'questionnaire' pour les questionnaires sans QCM en première question
    labels['questionnaire'] = 'Questionnaire';
    colors['questionnaire'] = 'bg-indigo-100 text-indigo-700';
    // Toujours inclure 'inconnu' pour les questionnaires avec QCM sans valeur reconnue
    labels['inconnu'] = 'Autre';
    colors['inconnu'] = 'bg-slate-100 text-slate-600';

    setDynamicSessionTypes({ labels, colors });
    setSessionTypeFilters(Object.keys(labels));
  }, [userFilteredLogs, assignedTemplates, isAdmin, isCoach]);

  useEffect(() => {
    if ((isAdmin || isCoach) && userFilteredLogs.length === 0) {
      setAthleteMetrics({ labels: {}, colors: {}, idToCanonical: {} });
      setSelectedMetrics([]);
      return;
    }

    // Trouver les templates réellement utilisés dans les logs filtrés
    const templateIdsInLogs = [...new Set(userFilteredLogs.map(log => log.template_id).filter(Boolean))];
    const relevantTemplates = templateIdsInLogs.length > 0
      ? assignedTemplates.filter(t => templateIdsInLogs.includes(t.id))
      : assignedTemplates;

    const normalizeLabel = (str) => (str || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim();

    const hasTrainingLogs = userFilteredLogs.some(l => !l.template_id);

    if (relevantTemplates.length === 0 && !hasTrainingLogs) {
      setAthleteMetrics({ labels: {}, colors: {}, idToCanonical: {} });
      setSelectedMetrics([]);
      return;
    }

    // Regrouper les questions de meme label
    const groupedByLabel = new Map();
    relevantTemplates.forEach(template => {
      (template.questions || []).filter(q => q.type === 'scale' || q.type === 'number').forEach(question => {
        const norm = normalizeLabel(question.label || question.athleteLabel);
        if (!groupedByLabel.has(norm)) {
          groupedByLabel.set(norm, { representative: question, ids: [question.id] });
        } else {
          const existing = groupedByLabel.get(norm);
          if (!existing.ids.includes(question.id)) existing.ids.push(question.id);
        }
      });
    });

    // Ajouter les champs fixes des training logs s'il y en a dans les donnees
    if (hasTrainingLogs) {
      const TRAINING_LOG_FIELDS = [
        { id: 'fatigue', label: 'Fatigue' },
        { id: 'intensite', label: 'Intensité' },
        { id: 'sommeil', label: 'Sommeil' },
        { id: 'plaisir', label: 'Plaisir' },
        { id: 'harmonie_proches', label: 'Harmonie avec les proches' },
        { id: 'maitrise_technique', label: 'Maîtrise technique' },
        { id: 'maitrise_tactique', label: 'Maîtrise tactique' },
        { id: 'epanouissement', label: 'Épanouissement' },
      ];
      TRAINING_LOG_FIELDS.forEach(field => {
        const norm = normalizeLabel(field.label);
        if (!groupedByLabel.has(norm)) {
          groupedByLabel.set(norm, { representative: field, ids: [field.id] });
        } else {
          const existing = groupedByLabel.get(norm);
          if (!existing.ids.includes(field.id)) existing.ids.push(field.id);
        }
      });
    }

    if (groupedByLabel.size === 0) {
      setAthleteMetrics({ labels: {}, colors: {}, idToCanonical: {} });
      setSelectedMetrics([]);
      return;
    }

    const labels = {};
    const colors = {};
    const idToCanonical = {};
    let colorIdx = 0;

    groupedByLabel.forEach(({ representative: question, ids }) => {
      const canonicalKey = ids[0];
      ids.forEach(id => { idToCanonical[id] = canonicalKey; });

      const label = normalizeLabel(question.label || question.athleteLabel);
      labels[canonicalKey] = question.label || question.athleteLabel;

      let color;
      if (label.includes('fatigue')) color = '#ef4444';
      else if (label.includes('intensit')) color = '#f59e0b';
      else if (label.includes('sommeil')) color = '#8b5cf6';
      else if (label.includes('plaisir')) color = '#10b981';
      else if (label.includes('harmonie') || label.includes('proches')) color = '#06b6d4';
      else if (label.includes('technique')) color = '#3b82f6';
      else if (label.includes('tactique')) color = '#6366f1';
      else if (label.includes('epanouissement')) color = '#ec4899';
      else if (label.includes('dynamisme')) color = '#84cc16';
      else if (label.includes('estime')) color = '#a855f7';
      else if (label.includes('cardiovasculaire')) color = '#f43f5e';
      else if (label.includes('musculaire')) color = '#fb923c';
      else color = defaultColors[colorIdx % defaultColors.length];
      colors[canonicalKey] = color;
      colorIdx++;
    });

    // Appliquer les couleurs personnalisées de l'utilisateur en priorité
    Object.keys(colors).forEach(key => {
      if (customColors[key]) colors[key] = customColors[key];
    });

    setAthleteMetrics({ labels, colors, idToCanonical });
    // La sélection par défaut est appliquée plus bas, parmi les indicateurs
    // ayant des données sur la période (voir availableMetricEntries)
    needsDefaultSelection.current = true;
    // customColors volontairement absent des dépendances : un changement de couleur
    // ne doit pas réinitialiser les indicateurs sélectionnés (voir effet ci-dessous)
  }, [userFilteredLogs, assignedTemplates, isAdmin, isCoach]);

  // Appliquer les couleurs personnalisées sans toucher à la sélection des indicateurs
  useEffect(() => {
    setAthleteMetrics(prev => {
      const colors = { ...prev.colors };
      let changed = false;
      Object.keys(colors).forEach(key => {
        if (customColors[key] && colors[key] !== customColors[key]) {
          colors[key] = customColors[key];
          changed = true;
        }
      });
      return changed ? { ...prev, colors } : prev;
    });
  }, [customColors]);

  const dateRange = { start: parseISO(startDate), end: parseISO(endDate) };

  // Filter logs
  const filteredLogs = userFilteredLogs.filter(log => {
    const logDate = parseISO(log.training_date);
    const inDateRange = logDate >= dateRange.start && logDate <= dateRange.end;
    const matchesSessionType = sessionTypeFilters.includes(log.session_type);
    return inDateRange && matchesSessionType;
  });

  // Remap all question ids in a log to their canonical key so grouped questions plot together
  const remapLogMetrics = (log) => {
    const idToCanonical = athleteMetrics.idToCanonical || {};
    if (Object.keys(idToCanonical).length === 0) return log;
    const remapped = { ...log };
    Object.entries(idToCanonical).forEach(([origId, canonicalId]) => {
      if (origId !== canonicalId && remapped[origId] !== undefined && remapped[canonicalId] === undefined) {
        remapped[canonicalId] = remapped[origId];
      }
    });
    return remapped;
  };

  const processedLogs = (() => {
    if (selectedAthleteEmails.length <= 1) {
      return filteredLogs.map(log => ({
        ...remapLogMetrics(log),
        dateLabel: format(parseISO(log.training_date), 'dd/MM', { locale: fr })
      }));
    }

    const grouped = {};
    filteredLogs.forEach(rawLog => {
      const log = remapLogMetrics(rawLog);
      const dateKey = log.training_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          training_date: log.training_date,
          session_type: log.session_type,
          dateLabel: format(parseISO(log.training_date), 'dd/MM', { locale: fr }),
          athlete_name: 'Sélection (médiane)',
          values: {}
        };
      }

      Object.keys(athleteMetrics.labels).forEach(metricKey => {
        if (log[metricKey] != null) {
          if (!grouped[dateKey].values[metricKey]) {
            grouped[dateKey].values[metricKey] = [];
          }
          grouped[dateKey].values[metricKey].push(log[metricKey]);
        }
      });
    });

    return Object.values(grouped).map(day => {
      const medians = {};
      Object.entries(day.values).forEach(([metricKey, values]) => {
        medians[metricKey] = Math.round(calculateMedian(values));
      });
      return {
        id: `median-${day.training_date}`,
        training_date: day.training_date,
        session_type: day.session_type,
        dateLabel: day.dateLabel,
        athlete_name: day.athlete_name,
        athlete_email: 'group',
        duration_minutes: null,
        ...medians
      };
    });
  })();

  const logsWithLabels = processedLogs;

  // Logs bruts remappés (un log par saisie, sans agrégation à la médiane) :
  // nécessaire pour les boxplots, qui doivent voir la répartition réelle des
  // valeurs d'un jour (ex. tous les athlètes sélectionnés), pas juste la
  // médiane déjà calculée par processedLogs quand plusieurs athlètes sont sélectionnés.
  const rawFilteredLogs = filteredLogs.map(remapLogMetrics);
  const boxplotGroupBy = boxplotGroupByChoice || autoBoxplotGroupBy(startDate, endDate);

  // Saisies pour les menus AFE / Analyse réseau (mémorisées : ces calculs sont
  // coûteux et ne doivent pas être relancés à chaque rendu du dashboard)
  const analysisAthleteLogs = useMemo(
    () => userFilteredLogs.map(remapLogMetrics),
    [userFilteredLogs, athleteMetrics.idToCanonical]
  );
  const analysisPeriodLogs = useMemo(
    () => analysisAthleteLogs.filter(log =>
      log.training_date >= startDate && log.training_date <= endDate && sessionTypeFilters.includes(log.session_type)),
    [analysisAthleteLogs, startDate, endDate, sessionTypeFilters]
  );
  const analysisGlobalFilters = useMemo(
    () => ({ startDate, endDate, sessionTypes: sessionTypeFilters }),
    [startDate, endDate, sessionTypeFilters]
  );

  // N'affiche un histogramme / boxplot que si l'indicateur a au moins une
  // valeur sur la période et les filtres courants.
  const metricsWithData = (logs) => Object.entries(athleteMetrics.labels)
    .filter(([key]) => logs.some(log => log[key] != null));
  const histogramMetricEntries = metricsWithData(logsWithLabels);
  // Indicateurs proposés dans le sélecteur : même règle que les boxplots
  const availableMetricEntries = metricsWithData(rawFilteredLogs);
  const boxplotMetricEntries = availableMetricEntries;
  const availableMetricKeysSignature = availableMetricEntries.map(([key]) => key).join('|');

  // Sélection par défaut : les 4 premiers indicateurs ayant des données
  useEffect(() => {
    if (!needsDefaultSelection.current) return;
    const keys = availableMetricKeysSignature ? availableMetricKeysSignature.split('|') : [];
    setSelectedMetrics(keys.slice(0, 4));
    if (keys.length > 0) needsDefaultSelection.current = false;
  }, [availableMetricKeysSignature, athleteMetrics]);

  // Remarques : commentaire libre du questionnaire d'entraînement classique,
  // et réponses aux questions de type texte libre des questionnaires personnalisés.
  const remarksList = useMemo(() => {
    const templateById = {};
    assignedTemplates.forEach(t => { templateById[t.id] = t; });

    const remarks = [];
    filteredLogs.forEach(log => {
      if (log.template_id) {
        const template = templateById[log.template_id];
        const textQuestions = (template?.questions || []).filter(q => q.type === 'text' || q.type === 'textarea');
        textQuestions.forEach(q => {
          const value = log[q.id];
          if (value && String(value).trim()) {
            remarks.push({
              id: `${log.id}-${q.id}`,
              date: log.training_date,
              athlete_name: log.athlete_name,
              text: String(value).trim(),
            });
          }
        });
      } else if (log.commentaire && String(log.commentaire).trim()) {
        remarks.push({
          id: `${log.id}-commentaire`,
          date: log.training_date,
          athlete_name: log.athlete_name,
          text: String(log.commentaire).trim(),
        });
      }
    });

    return remarks.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredLogs, assignedTemplates]);

  const groupedChartData = (() => {
    const currentMetricLabels = Object.keys(athleteMetrics.labels);
    if (currentMetricLabels.length === 0) return [];
    if (groupBy === 'day') return logsWithLabels;
    
    const grouped = {};
    filteredLogs.forEach(log => {
      let key;
      const date = parseISO(log.training_date);
      if (groupBy === 'week') {
        key = format(startOfWeek(date, { locale: fr }), 'yyyy-MM-dd');
      } else if (groupBy === 'month') {
        key = format(startOfMonth(date), 'yyyy-MM');
      }
      
      if (!grouped[key]) {
        grouped[key] = { 
          training_date: key, 
          dateLabel: groupBy === 'week' 
            ? `Sem. ${format(parseISO(key), 'dd/MM', { locale: fr })}`
            : format(parseISO(key + '-01'), 'MMM yyyy', { locale: fr }),
          count: 0, 
          ...Object.fromEntries(
            currentMetricLabels.map(m => [m, { sum: 0, count: 0 }])
          )
        };
      }
      grouped[key].count++;
      currentMetricLabels.forEach(m => {
        if (log[m] != null) {
          grouped[key][m].sum += log[m];
          grouped[key][m].count++;
        }
      });
    });

    return Object.values(grouped).map(g => ({
      training_date: g.training_date,
      dateLabel: g.dateLabel,
      ...Object.fromEntries(
        currentMetricLabels.map(m => [m, g[m].count > 0 ? Math.round(g[m].sum / g[m].count) : null])
      )
    })).sort((a, b) => new Date(a.training_date) - new Date(b.training_date));
  })();

  const totalSessions = filteredLogs.length;
  const firstMetricKey = selectedMetrics[0];
  const secondMetricKey = selectedMetrics[1];
  
  const avgFirstMetric = filteredLogs.length > 0 && firstMetricKey
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[firstMetricKey] || 0), 0) / filteredLogs.length)
    : '-';
  const avgSecondMetric = filteredLogs.length > 0 && secondMetricKey
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[secondMetricKey] || 0), 0) / filteredLogs.length)
    : '-';

  // Réglages "statistiques avancées" : 'evolution' pour le graphique
  // d'évolution, sinon la clé de l'indicateur pour un histogramme donné.
  const getChartStats = (chartId) => chartAdvancedStats[chartId] || EMPTY_ADVANCED_STATS;

  // Le bouton global applique immédiatement la valeur à tous les graphiques
  // (évolution + chaque histogramme). Les flèches individuelles permettent
  // ensuite d'ajuster une carte précise sans affecter les autres.
  const toggleGlobalStat = (statKey) => {
    const nextVal = !globalAdvancedStats[statKey];
    setGlobalAdvancedStats(prev => ({ ...prev, [statKey]: nextVal }));
    setChartAdvancedStats(current => {
      const chartIds = ['evolution', ...Object.keys(athleteMetrics.labels)];
      const next = { ...current };
      chartIds.forEach(id => {
        next[id] = { ...(current[id] || EMPTY_ADVANCED_STATS), [statKey]: nextVal };
      });
      return next;
    });
  };

  const toggleChartStat = (chartId, statKey) => {
    setChartAdvancedStats(current => ({
      ...current,
      [chartId]: { ...(current[chartId] || EMPTY_ADVANCED_STATS), [statKey]: !(current[chartId] || EMPTY_ADVANCED_STATS)[statKey] }
    }));
  };

  // Lignes de référence pour le graphique d'évolution : une par indicateur
  // sélectionné et par statistique active, calculées sur filteredLogs (donc
  // sur la période et les filtres déjà appliqués).
  const evolutionStats = getChartStats('evolution');
  const evolutionStatLines = selectedMetrics.flatMap(metricKey => {
    const values = filteredLogs.map(l => l[metricKey]).filter(v => v != null);
    const stats = computeMetricStats(values);
    if (!stats) return [];
    return REFERENCE_STAT_DEFS.filter(def => evolutionStats[def.key]).map(def => ({
      id: `${metricKey}-${def.key}`,
      value: stats[def.key],
      color: def.color,
      dash: def.dash,
      label: `${def.label} · ${athleteMetrics.labels[metricKey]}`,
    }));
  });
  const evolutionEmaDefs = EMA_STAT_DEFS.filter(def => evolutionStats[def.key]);

  const toggleSessionTypeFilter = (type) => {
    setSessionTypeFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              {isCoach ? 'Dashboard Entraineur 🏆' : isAdmin ? 'Dashboard Admin 🏆' : 'Mes Données 📊'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isCoach ? `Suivi du groupe ${coachGroup?.name || ''}` : isAdmin ? 'Suivi de vos athlètes' : 'Suivi de mes entraînements'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(isAdmin || isCoach) && (
              <Link to={isAdmin ? createPageUrl('AdminHome') : isIndividualView ? createPageUrl('CoachHomeIndividual') : createPageUrl('CoachHome')}>
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Accueil
                </Button>
              </Link>
            )}
            {(!isCoach || user?.can_access_objective_data_page !== false) && (
            <Link to="/ObjectiveData">
              <Button variant="outline" className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50">
                <Zap className="w-4 h-4" />
                Données Objectives
              </Button>
            </Link>
            )}
            {isCoach && (
              <Link to={createPageUrl('DataExport')}>
                <Button variant="outline" className="gap-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                  <Download className="w-4 h-4" />
                  Export données
                </Button>
              </Link>
            )}
            {isUsingDemoData && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Données de démonstration
              </Badge>
            )}
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Athlete Selector */}
        {(isAdmin || isCoach) && (
          <Card className="shadow-lg border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-indigo-900">
                🎯 Sélection d'athlète
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-4">
                {(allGroups.length > 0 || allClubs.length > 0) && (
                  <div className="flex flex-col gap-3">
                    {allGroups.length > 0 && (
                      <div className="flex items-start gap-4">
                        <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-1">Groupes :</Label>
                        <div className="flex-1 flex flex-wrap gap-x-4 gap-y-2">
                          {allGroups.map(group => (
                            <div key={group.id} className="flex items-center gap-1.5">
                              <Checkbox
                                id={`group-filter-${group.id}`}
                                checked={selectedGroupIds.includes(group.id)}
                                onCheckedChange={() => toggleGroupFilter(group.id)}
                              />
                              <Label htmlFor={`group-filter-${group.id}`} className="text-sm cursor-pointer">
                                {group.name} ({group.athlete_emails?.length || 0})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {allClubs.length > 0 && (
                      <div className="flex items-start gap-4">
                        <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-1">Clubs :</Label>
                        <div className="flex-1 flex flex-wrap gap-x-4 gap-y-2">
                          {allClubs.map(club => (
                            <div key={club.id} className="flex items-center gap-1.5">
                              <Checkbox
                                id={`club-filter-${club.id}`}
                                checked={selectedClubIds.includes(club.id)}
                                onCheckedChange={() => toggleClubFilter(club.id)}
                              />
                              <Label htmlFor={`club-filter-${club.id}`} className="text-sm cursor-pointer">
                                {club.name} ({club.athlete_emails?.length || 0})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-3">Athlètes :</Label>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Rechercher un athlète..."
                        value={athleteSearchQuery}
                        onChange={(e) => setAthleteSearchQuery(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                      {athletePool.length > 0 ? (
                        athletePool
                          .filter(a => !athleteSearchQuery || a.name.toLowerCase().includes(athleteSearchQuery.toLowerCase()) || a.email.toLowerCase().includes(athleteSearchQuery.toLowerCase()))
                          .map((athlete) => (
                            <div key={athlete.email} className="flex items-center gap-2 py-1">
                              <Checkbox
                                id={`athlete-${athlete.email}`}
                                checked={selectedAthleteEmails.includes(athlete.email)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedAthleteEmails([...selectedAthleteEmails, athlete.email]);
                                  } else {
                                    setSelectedAthleteEmails(selectedAthleteEmails.filter(e => e !== athlete.email));
                                  }
                                }}
                              />
                              <Label htmlFor={`athlete-${athlete.email}`} className="text-sm cursor-pointer">
                                {athlete.name}
                              </Label>
                            </div>
                          ))
                      ) : (
                        <div className="text-sm text-amber-700">Aucun athlète disponible</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      {selectedAthleteEmails.length > 0 ? (
                        <div className="text-sm text-indigo-700 font-medium">
                          ✓ {selectedAthleteEmails.length} athlète(s) sélectionné(s){selectedAthleteEmails.length > 1 ? ' - Affichage des médianes' : ''}
                        </div>
                      ) : <span />}
                      {(selectedGroupIds.length > 0 || selectedClubIds.length > 0 || selectedAthleteEmails.length > 0) && (
                        <Button variant="ghost" size="sm" onClick={clearAthleteSelection} className="text-slate-500 h-7 px-2">
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date & Session Type Filters */}
        <Card className="shadow-sm border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">Du :</Label>
                <Input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">Au :</Label>
                <Input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              {Object.keys(dynamicSessionTypes.labels).length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <Label className="text-sm text-slate-600">Type :</Label>
                  {Object.entries(dynamicSessionTypes.labels).map(([value, label]) => (
                    <div key={value} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`type-${value}`}
                        checked={sessionTypeFilters.includes(value)}
                        onCheckedChange={() => toggleSessionTypeFilter(value)}
                      />
                      <Label htmlFor={`type-${value}`} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metric Selector */}
        {availableMetricEntries.length > 0 && (
          <Card className="shadow-sm border-0 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-semibold text-slate-800">Indicateurs à afficher</h3>
                <AdvancedStatsToggle
                  variant="button"
                  idPrefix="global"
                  label="Statistiques avancées"
                  active={globalAdvancedStats}
                  onToggle={toggleGlobalStat}
                />
              </div>
              <MetricSelector
                selected={selectedMetrics}
                onChange={setSelectedMetrics}
                onColorChange={handleColorChange}
                metrics={availableMetricEntries.map(([key, label]) => ({
                  key,
                  label,
                  color: athleteMetrics.colors[key]
                }))}
              />
            </CardContent>
          </Card>
        )}

        {/* Line Chart */}
        {groupedChartData.length > 0 && selectedMetrics.length > 0 && (
          <div className="mb-6">
            <ZoomableChartCard
              title={`Évolution ${isAdmin && athletes.length > 1 ? '(tous les athlètes)' : ''}`}
              zoomedHeight={550}
              headerExtra={
                <AdvancedStatsToggle
                  variant="icon"
                  idPrefix="evolution"
                  active={getChartStats('evolution')}
                  onToggle={(statKey) => toggleChartStat('evolution', statKey)}
                />
              }
            >
              {(isZoomed, zoomHeight) => (
                <AthleteDataChart
                  data={groupedChartData}
                  selectedMetrics={selectedMetrics}
                  metricConfig={Object.keys(athleteMetrics.labels).reduce((acc, key) => {
                    acc[key] = { name: athleteMetrics.labels[key], color: athleteMetrics.colors[key] };
                    return acc;
                  }, {})}
                  title={`Évolution ${isAdmin && athletes.length > 1 ? '(tous les athlètes)' : ''}`}
                  startDate={startDate}
                  endDate={endDate}
                  height={isZoomed ? zoomHeight : undefined}
                  statLines={evolutionStatLines}
                  emaDefs={evolutionEmaDefs}
                  isZoomed={isZoomed}
                />
              )}
            </ZoomableChartCard>
          </div>
        )}

        {/* Statistiques descriptives, repliable */}
        <CollapsibleAnalysis
          title="Statistiques descriptives"
          icon={Table2}
          open={showSummaryStats}
          onToggle={() => setShowSummaryStats(v => !v)}
        >
          <SummaryStatsTable
            data={userFilteredLogs}
            metricLabels={athleteMetrics.labels}
            metricColors={athleteMetrics.colors}
            startDate={startDate}
            endDate={endDate}
            sessionTypeFilters={sessionTypeFilters}
            showTitle={false}
          />
        </CollapsibleAnalysis>

        {/* Histogrammes, repliable */}
        {histogramMetricEntries.length > 0 && (
          <CollapsibleAnalysis
            title="Histogrammes"
            icon={BarChart3}
            open={showHistograms}
            onToggle={() => setShowHistograms(v => !v)}
          >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {histogramMetricEntries.map(([key, label]) => (
              <ZoomableChartCard
                key={key}
                title={label}
                zoomedHeight={450}
                headerExtra={
                  <AdvancedStatsToggle
                    variant="icon"
                    idPrefix={`hist-${key}`}
                    active={getChartStats(key)}
                    onToggle={(statKey) => toggleChartStat(key, statKey)}
                  />
                }
              >
                {(isZoomed, zoomHeight) => (
                  <HistogramChart
                    data={logsWithLabels}
                    dataKey={key}
                    title={label}
                    color={athleteMetrics.colors[key]}
                    startDate={startDate}
                    endDate={endDate}
                    height={isZoomed ? zoomHeight : undefined}
                    advancedStats={getChartStats(key)}
                    isZoomed={isZoomed}
                  />
                )}
              </ZoomableChartCard>
            ))}
          </div>
          </CollapsibleAnalysis>
        )}

        {/* Boxplots : distribution par jour, semaine ou mois, par indicateur, repliable */}
        {boxplotMetricEntries.length > 0 && (
          <CollapsibleAnalysis
            title="Boxplot"
            icon={BoxSelect}
            badge={BOXPLOT_GROUP_LABELS[boxplotGroupBy]}
            open={showBoxplots}
            onToggle={() => setShowBoxplots(v => !v)}
          >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-sm font-medium text-slate-700">Regrouper par :</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                  {[
                    [null, `Auto (${BOXPLOT_GROUP_LABELS[autoBoxplotGroupBy(startDate, endDate)].toLowerCase()})`],
                    ['day', BOXPLOT_GROUP_LABELS.day],
                    ['week', BOXPLOT_GROUP_LABELS.week],
                    ['month', BOXPLOT_GROUP_LABELS.month],
                  ].map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setBoxplotGroupByChoice(value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        boxplotGroupByChoice === value ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Boîte : de Q1 à Q3 · trait : médiane · ◇ : moyenne · moustaches : jusqu'à 1,5 × l'écart interquartile · ○ : valeurs extrêmes ·
                n : nombre de valeurs (boîte pâle si moins de {LOW_COUNT}) · <span className="text-amber-600">partiel</span> : semaine ou mois coupé par la période (bordure en pointillés).
                Survolez une boîte pour le détail.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boxplotMetricEntries.map(([key, label]) => (
                  <ZoomableChartCard key={key} title={`${label} — distribution`} zoomedHeight={420}>
                    {(isZoomed, zoomHeight) => (
                      <BoxPlotChart
                        data={rawFilteredLogs}
                        dataKey={key}
                        title={label}
                        color={athleteMetrics.colors[key]}
                        startDate={startDate}
                        endDate={endDate}
                        height={isZoomed ? zoomHeight : undefined}
                        groupBy={boxplotGroupBy}
                      />
                    )}
                  </ZoomableChartCard>
                ))}
              </div>
          </CollapsibleAnalysis>
        )}

        {/* AFE et analyse réseau : admin uniquement */}
        {isAdmin && Object.keys(athleteMetrics.labels).length > 0 && (
          <AdvancedAnalyses
            user={user}
            periodLogs={analysisPeriodLogs}
            athleteLogs={analysisAthleteLogs}
            metricLabels={athleteMetrics.labels}
            metricColors={athleteMetrics.colors}
            sessionTypeLabels={dynamicSessionTypes.labels}
            globalFilters={analysisGlobalFilters}
          />
        )}

        {/* Remarques, repliable */}
        <CollapsibleAnalysis
          title="Remarques"
          icon={MessageSquare}
          badge={`${remarksList.length} remarque${remarksList.length > 1 ? 's' : ''}`}
          open={showRemarks}
          onToggle={() => setShowRemarks(v => !v)}
        >
        <Card className="shadow-sm border-0">
          <CardContent className="pt-6">
            {remarksList.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-6">
                Aucune remarque sur la période sélectionnée.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {remarksList.map((remark) => (
                  <div key={remark.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-medium text-slate-800 text-sm">{remark.athlete_name}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {format(parseISO(remark.date), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{remark.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </CollapsibleAnalysis>
      </div>
    </div>
  );
}
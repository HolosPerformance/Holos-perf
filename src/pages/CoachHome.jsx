import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  User,
  MessageCircle,
  BarChart3,
  Users,
  ClipboardList,
  Calendar,
  CalendarDays,
  TrendingUp,
  PenLine,
  BarChart2,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import CoachCalendar from '../components/calendar/CoachCalendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function getBrandColor() {
  return document.documentElement.style.getPropertyValue('--brand-color') || null;
}

function getBrandSecondaryColor() {
  return document.documentElement.style.getPropertyValue('--brand-secondary-color') || null;
}

export default function CoachHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [club, setClub] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [brandColor, setBrandColor] = useState(null);
  const [brandSecondaryColor, setBrandSecondaryColor] = useState(null);

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

  // Persister la vue club dans localStorage
  useEffect(() => {
    localStorage.setItem('coachView', 'club');
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const load = async () => {
      const [groups, clubs, users] = await Promise.all([
        base44.entities.Group.list(),
        base44.entities.Club.list(),
        base44.entities.User.list(),
      ]);
      setGroup(groups.find(g => g.coach_email === user.email) || null);
      setClub(clubs.find(c => (c.coach_emails || []).includes(user.email)) || null);
      setAllUsers(users);
    };
    load();
  }, [user?.email]);

  const menuItems = [
    {
      title: 'Séances',
      description: 'Séances passées et à venir',
      icon: Calendar,
      href: '/Sessions',
      color: 'from-violet-500 to-violet-600'
    },
    (user?.can_access_subjective_data_page !== false || user?.can_access_objective_data_page !== false) && {
      title: 'Dashboard',
      description: 'Visualiser les données de mon groupe',
      icon: BarChart3,
      href: createPageUrl('CoachDashboard'),
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: club ? 'Gestion du Club' : 'Gestion athlètes et groupes',
      description: club ? `Gérer mon club - ${club.name}` : 'Gérer mes athlètes',
      icon: Users,
      href: club ? `/ClubDetails?id=${club.id}` : createPageUrl('GroupManagement'),
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Messages',
      description: 'Communiquer avec mes athlètes',
      icon: MessageCircle,
      href: createPageUrl('Messages'),
      color: 'from-amber-500 to-amber-600'
    },
    {
      title: 'Export des données',
      description: 'Télécharger les données d\'entraînement',
      icon: Download,
      href: createPageUrl('DataExport'),
      color: 'from-red-500 to-rose-600'
    },
    {
      title: 'Questionnaires',
      description: user?.user_status === 'coach_pro' ? 'Gérer les questionnaires' : 'Résumé des questionnaires actifs',
      icon: ClipboardList,
      href: createPageUrl('CoachQuestionnaires'),
      color: 'from-indigo-500 to-indigo-600'
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
        <Activity className="w-8 h-8 animate-pulse text-slate-400" />
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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Users className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Espace Entraîneur
          </h1>
          <p className="text-slate-500 text-lg">
            Bienvenue, {user.first_name || user.full_name} 👋
          </p>

        </div>

        {/* Questionnaire du jour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Questionnaire du jour</h3>
                    <p className="text-sm text-slate-500 capitalize">
                      {format(new Date(), 'EEEE d MMMM', { locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => navigate('/CoachDailyQuestionnaire')}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <PenLine className="w-4 h-4" />
                    Répondre au questionnaire
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/CoachDailyResponses')}
                    className="gap-2"
                  >
                    <BarChart2 className="w-4 h-4" />
                    Voir les réponses
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Menu Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
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
                    <div className={`h-2 bg-gradient-to-r ${item.color}`} style={brandColor ? { background: brandColor } : {}} />
                    <CardContent className="p-6">
                      <div
                        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                        style={brandColor ? { background: brandColor } : {}}
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-slate-900 transition-colors">
                        {item.title}
                      </h2>
                      <p className="text-slate-500 text-sm">
                        {item.description}
                      </p>
                      <div className="flex items-center text-sm text-slate-600 group-hover:text-slate-800 font-medium mt-4">
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

        {/* Calendrier */}
        <div className="mt-4">
          <CoachCalendar
            coachEmail={user.email}
            athletes={(group?.athlete_emails || []).map(email => {
              const u = allUsers.find(u => u.email === email);
              return { email, name: u?.full_name || email };
            })}
          />
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-0 shadow-sm overflow-hidden" style={brandSecondaryColor ? { borderLeft: `4px solid ${brandSecondaryColor}` } : {}}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Mon Statut</p>
                    <p className="text-2xl font-bold text-slate-800">Entraîneur</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Aujourd'hui</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
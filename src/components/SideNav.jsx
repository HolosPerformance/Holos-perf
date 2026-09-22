import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase as base44 } from '@/api/supabaseClient';
import {
  LayoutDashboard, CalendarDays, Calendar, MessageSquare, Users, User,
  FileText, Download, Settings, Home, ClipboardList, Shield, X
} from 'lucide-react';

const adminLinks = [
  { label: 'Séances', icon: Calendar, to: '/Sessions' },
  { label: 'Calendrier', icon: CalendarDays, to: createPageUrl('CalendarPage') },
  { label: 'Dashboard', icon: LayoutDashboard, to: createPageUrl('CoachDashboard') },
  { label: 'Utilisateurs & Groupes', icon: Users, to: createPageUrl('UserManagement') },
  { label: 'Fiches Athlètes', icon: User, to: createPageUrl('AthleteProfile') },
  { label: 'Messages', icon: MessageSquare, to: createPageUrl('Messages') },
  { label: 'Export données', icon: Download, to: createPageUrl('DataExport') },
  { label: 'Bibliothèque', icon: ClipboardList, to: createPageUrl('Questionnaires') },
  { label: 'Clubs', icon: Shield, to: createPageUrl('ClubManagement') },
  { label: 'Paramètres', icon: Settings, to: '/Settings' },
];

const coachLinks = [
  { label: 'Séances', icon: Calendar, to: '/Sessions' },
  { label: 'Calendrier', icon: CalendarDays, to: createPageUrl('CalendarPage') },
  { label: 'Dashboard', icon: LayoutDashboard, to: createPageUrl('CoachDashboard') },
  { label: 'Gestion de groupe', icon: Users, to: createPageUrl('GroupManagement') },
  { label: 'Messages', icon: MessageSquare, to: createPageUrl('Messages') },
  { label: 'Questionnaires', icon: ClipboardList, to: createPageUrl('CoachQuestionnaires') },
  { label: 'Export données', icon: Download, to: createPageUrl('DataExport') },
  { label: 'Paramètres', icon: Settings, to: '/Settings' },
];

const athleteLinks = [
  { label: 'Mes Séances', icon: Calendar, to: '/Sessions' },
  { label: 'Calendrier', icon: CalendarDays, to: createPageUrl('CalendarPage') },
  { label: 'Mon Dashboard', icon: LayoutDashboard, to: createPageUrl('PersonalDashboard') },
  { label: 'Ma Fiche Athlète', icon: User, to: createPageUrl('AthleteProfile') },
  { label: 'Messages', icon: MessageSquare, to: createPageUrl('Messages') },
  { label: 'Paramètres', icon: Settings, to: '/Settings' },
];

export default function SideNav({ userStatus, unreadCount, mobileOpen, onMobileClose, user }) {
  const location = useLocation();
  const [coachClubId, setCoachClubId] = useState(null);
  const [hovered, setHovered] = useState(false);

  const isCoachRole = userStatus === 'coach' || userStatus === 'coach_pro';
  const coachView = typeof window !== 'undefined' ? localStorage.getItem('coachView') || 'club' : 'club';
  const isOnIndividualView = coachView === 'individual';
  const isOnClubView = coachView === 'club';

  useEffect(() => {
    if ((userStatus !== 'coach' && userStatus !== 'coach_pro') || !user?.email) return;
    base44.entities.Club.list().then(clubs => {
      const myClub = clubs.find(c => (c.coach_emails || []).includes(user.email));
      if (myClub) setCoachClubId(myClub.id);
    });
  }, [userStatus, user?.email]);

  let links;
  if (userStatus === 'admin') {
    links = adminLinks;
  } else if (userStatus === 'coach' || userStatus === 'coach_pro') {
    const baseCoachLinks = coachLinks.map(l => {
      if (l.label === 'Gestion de groupe' && coachClubId && !isOnIndividualView) {
        return { ...l, label: 'Gestion du club', icon: Shield, to: `/ClubDetails?id=${coachClubId}` };
      }
      return l;
    }).filter(l => {
      if (l.label === 'Dashboard' && user?.can_access_subjective_data_page === false) return false;
      return true;
    });
    links = baseCoachLinks;
  } else {
    links = athleteLinks;
  }

  const NavLinks = ({ expanded }) => (
    <nav className="flex flex-col gap-1 p-3 pt-4">
      {links.map(({ label, icon: Icon, to }) => {
        const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={onMobileClose}
            title={!expanded ? label : undefined}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative ${
              isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {expanded && <span className="whitespace-nowrap overflow-hidden text-base">{label}</span>}
            {expanded && label === 'Messages' && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {unreadCount}
              </span>
            )}
            {!expanded && label === 'Messages' && unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-red-500 rounded-full w-2 h-2" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const homeUrl = userStatus === 'admin' ? createPageUrl('AdminHome') : isCoachRole ? createPageUrl('CoachHome') : createPageUrl('AthleteHome');

  const canAccessClubView = user?.can_access_club_view === true;
  const canAccessIndividualView = user?.can_access_individual_view !== false;

  const CoachViewToggle = ({ expanded }) => {
    if (!isCoachRole) return null;
    if (!canAccessClubView || !canAccessIndividualView) return null;
    return (
      <div className={`px-3 pb-2 flex gap-1 ${expanded ? '' : 'flex-col'}`}>
        <Link
          to={createPageUrl('CoachHome')}
          title={!expanded ? 'Club' : undefined}
          onClick={() => localStorage.setItem('coachView', 'club')}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
            isOnClubView
              ? 'bg-slate-800 text-white border-slate-800'
              : 'text-slate-500 border-slate-200 hover:bg-slate-100'
          }`}
        >
          {expanded ? 'Club' : 'C'}
        </Link>
        <Link
          to={createPageUrl('CoachHomeIndividual')}
          title={!expanded ? 'Indiv.' : undefined}
          onClick={() => localStorage.setItem('coachView', 'individual')}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
            isOnIndividualView
              ? 'bg-teal-600 text-white border-teal-600'
              : 'text-slate-500 border-slate-200 hover:bg-slate-100'
          }`}
        >
          {expanded ? 'Indiv.' : 'I'}
        </Link>
      </div>
    );
  };

  return (
    <>
      {/* Desktop: icônes seulement, hover pour déployer */}
      <aside
        className="hidden md:flex flex-col shrink-0 border-r border-slate-200 bg-white/70 backdrop-blur-sm overflow-hidden transition-all duration-300 z-40 fixed top-36 left-0 h-[calc(100vh-9rem)]"
        style={{ width: hovered ? '18rem' : '4.5rem' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <CoachViewToggle expanded={hovered} />
        <NavLinks expanded={hovered} />
      </aside>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="relative flex flex-col w-72 bg-white shadow-xl min-h-full z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="font-semibold text-slate-700 text-sm">Menu</span>
              <button onClick={onMobileClose} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <CoachViewToggle expanded={true} />
            <NavLinks expanded={true} />
          </aside>
        </div>
      )}
    </>
  );
}
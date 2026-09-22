import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import SideNav from '@/components/SideNav';
import { Menu } from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';

// ─── Bootstrap athlète (assignation questionnaires) ───────────────────────────
async function bootstrapAthlete(userData) {
  try {
    const [templates, clubs, profiles, appSettings] = await Promise.all([
      base44.entities.QuestionnaireTemplate.list(),
      base44.entities.Club.list(),
      base44.entities.AthleteProfile.filter({ athlete_email: userData.email }),
      base44.entities.AppSetting.list()
    ]);

    // Synchroniser la fiche athlète
    const athleteName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || userData.email;
    if (profiles.length === 0) {
      await base44.entities.AthleteProfile.create({
        athlete_email: userData.email,
        athlete_name:  athleteName,
        first_name:    userData.first_name || '',
        last_name:     userData.last_name  || '',
        birth_date:    userData.birth_date || null,
        sport: ''
      });
    }

    // Assignation questionnaire par défaut si aucun assigné
    const defaultSetting = appSettings.find(s => s.key === 'default_athlete_questionnaire_id');
    const athleteClub    = clubs.find(c => (c.athlete_emails || []).includes(userData.email));
    const currentlyAssigned = templates.filter(
      t => t.is_active && (t.assigned_athletes || []).includes(userData.email)
    );

    if (currentlyAssigned.length === 0) {
      let targetTemplates = [];

      if (athleteClub) {
        const ids = athleteClub.default_questionnaire_template_ids?.length
          ? athleteClub.default_questionnaire_template_ids
          : athleteClub.default_questionnaire_template_id
            ? [athleteClub.default_questionnaire_template_id] : [];
        targetTemplates = ids.map(id => templates.find(t => t.id === id && t.is_active)).filter(Boolean);
      }

      if (targetTemplates.length === 0) {
        const fallback = defaultSetting?.value
          ? templates.find(t => t.id === defaultSetting.value && t.is_active)
          : templates.find(t => t.name?.toLowerCase() === 'questionnaire standard' && t.is_active);
        if (fallback) targetTemplates.push(fallback);
      }

      for (const tmpl of targetTemplates) {
        if (!(tmpl.assigned_athletes || []).includes(userData.email)) {
          await base44.entities.QuestionnaireTemplate.update(tmpl.id, {
            assigned_athletes:       [...(tmpl.assigned_athletes || []), userData.email],
            auto_assigned_athletes:  [...(tmpl.auto_assigned_athletes || []), userData.email],
          });
        }
      }
    }
  } catch (err) {
    console.error('Erreur bootstrap athlète :', err);
  }
}

// ─── Composant Layout ─────────────────────────────────────────────────────────
export default function Layout({ children, currentPageName }) {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { user, isAdmin, isCoach, isAthlete } = useAuth();
  const [sideNavOpen,  setSideNavOpen]  = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [bootstrapped, setBootstrapped] = useState(false);

  useBranding(user, location.pathname);

  // ── Bootstrap unique par session ─────────────────────────────────────────
  useEffect(() => {
    if (!user || bootstrapped) return;
    setBootstrapped(true);

    if (isAthlete) bootstrapAthlete(user);
  }, [user, bootstrapped, isAthlete]);

  // ── Redirection selon le rôle sur les pages "home" ───────────────────────
  useEffect(() => {
    if (!user) return;

    const homePages = ['Home', 'AthleteHome', 'CoachHome', 'AdminHome', 'CoachHomeIndividual'];
    if (!homePages.includes(currentPageName)) return;

    const userStatus = user.user_status;

    if (userStatus === 'athlete' && currentPageName !== 'AthleteHome') {
      navigate(createPageUrl('AthleteHome'));
    } else if ((userStatus === 'coach' || userStatus === 'coach_pro') && currentPageName === 'AdminHome') {
      navigate(createPageUrl('CoachHome'));
    } else if (userStatus === 'admin' && currentPageName === 'AthleteHome') {
      navigate(createPageUrl('AdminHome'));
    }
  }, [currentPageName, user, navigate]);

  // ── Messages non lus ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    base44.entities.Message.filter({ recipient_email: user.email, is_read: false })
      .then(msgs => { if (mounted) setUnreadCount(msgs.length); })
      .catch(() => {});

    const unsub = base44.entities.Message.subscribe(event => {
      if (event.type === 'create' && event.data.recipient_email === user.email) {
        setUnreadCount(n => n + 1);
      } else if (event.type === 'update' && event.data.recipient_email === user.email && event.data.is_read) {
        setUnreadCount(n => Math.max(0, n - 1));
      }
    });

    return () => { mounted = false; unsub(); };
  }, [user]);

  if (!user) return <div className="min-h-screen">{children}</div>;

  const logoLink = isAdmin
    ? createPageUrl('AdminHome')
    : (isCoach ? createPageUrl('CoachHome') : createPageUrl('AthleteHome'));

  return (
    <div id="layout-bg" className="min-h-screen" style={{ background: 'transparent' }}>
      {/* Header mobile */}
      <div className="mobile-header fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pb-1 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-100 md:hidden">
        <Link to={logoLink}>
          <img
            src="/logo.png"
            onError={(e) => { e.target.style.display = 'none'; }}
            alt="Logo"
            className="block w-14 h-14 object-contain"
          />
        </Link>
        <button
          className="p-3 rounded-xl hover:bg-slate-100"
          onClick={() => setSideNavOpen(true)}
        >
          <Menu className="w-7 h-7 text-slate-700" />
        </button>
      </div>

      {/* Logo desktop */}
      <div className="hidden md:block fixed top-3 left-3 z-50">
        <Link to={logoLink}>
          <img
            src="/logo.png"
            onError={(e) => { e.target.style.display = 'none'; }}
            alt="Logo"
            className="block w-32 h-32 object-contain drop-shadow-md hover:scale-105 transition-transform"
          />
        </Link>
      </div>

      {/* Sidebar + contenu */}
      <div className="flex">
        <SideNav
          userStatus={user.user_status}
          unreadCount={unreadCount}
          mobileOpen={sideNavOpen}
          onMobileClose={() => setSideNavOpen(false)}
          user={user}
        />
        <main className="flex-1 min-w-0 relative z-30 main-below-header md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}

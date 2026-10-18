import { useEffect, useRef, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';

function hexToHsl(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ─── Couleurs de marque ───────────────────────────────────────────────────────
// Mémorisées dans le navigateur (par compte et par vue) pour être appliquées dès
// le premier affichage, sans attendre la requête Supabase. Les pages lisent les
// couleurs via useBrandColors(), prévenu à chaque changement.
const BRAND_CACHE_KEY = 'brandColors';
const BRAND_EVENT = 'brand-colors-change';

const cacheId = (user, isIndividualView) => `${user.email}|${isIndividualView ? 'individual' : 'club'}`;

function readCachedColors(id) {
  try {
    const cached = JSON.parse(localStorage.getItem(BRAND_CACHE_KEY) || 'null');
    return cached?.id === id ? cached : null;
  } catch { return null; }
}

function setBrandColors(primary, secondary, id, notify = true) {
  const root = document.documentElement.style;
  if (secondary) root.setProperty('--brand-secondary-color', secondary);
  else root.removeProperty('--brand-secondary-color');
  const primaryHsl = hexToHsl(primary);
  if (primary && primaryHsl) {
    root.setProperty('--primary', primaryHsl);
    root.setProperty('--primary-foreground', '0 0% 100%');
    root.setProperty('--brand-color', primary);
  } else {
    root.removeProperty('--primary');
    root.removeProperty('--primary-foreground');
    root.removeProperty('--brand-color');
  }
  // Nettoyer les anciennes surcharges qui coloraient les fonds de cartes
  root.removeProperty('--card');
  root.removeProperty('--card-foreground');
  if (id) {
    try { localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify({ id, primary: primary || null, secondary: secondary || null })); } catch { /* stockage indisponible */ }
  }
  if (notify) window.dispatchEvent(new Event(BRAND_EVENT));
}

const readBrandVar = (name) => document.documentElement.style.getPropertyValue(name) || null;
const readBrandColors = () => ({ primary: readBrandVar('--brand-color'), secondary: readBrandVar('--brand-secondary-color') });

// Couleurs de marque courantes, mises à jour dès qu'elles changent
export function useBrandColors() {
  const [colors, setColors] = useState(readBrandColors);
  useEffect(() => {
    const update = () => setColors(prev => {
      const next = readBrandColors();
      return prev.primary === next.primary && prev.secondary === next.secondary ? prev : next;
    });
    update();
    window.addEventListener(BRAND_EVENT, update);
    return () => window.removeEventListener(BRAND_EVENT, update);
  }, []);
  return colors;
}

function applyLogo(logoUrl) {
  document.getElementById('club-logo-bg')?.remove();
  document.getElementById('club-logo-layout')?.remove();
  document.body.style.backgroundImage = 'none';
  const layoutBg = document.getElementById('layout-bg');
  if (layoutBg) layoutBg.style.backgroundImage = '';
  if (logoUrl && layoutBg) {
    const logoDiv = document.createElement('div');
    logoDiv.id = 'club-logo-layout';
    logoDiv.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:20;background-repeat:no-repeat;background-position:center;background-size:35%;opacity:0.15;background-image:url('${logoUrl}');`;
    layoutBg.style.position = 'relative';
    layoutBg.insertBefore(logoDiv, layoutBg.firstChild);
  }
}

export function useBranding(user, currentPath) {
  const isIndividualView = typeof window !== 'undefined' && localStorage.getItem('coachView') === 'individual';

  // Couleurs mémorisées appliquées pendant le rendu du layout, donc avant celui
  // des pages : elles s'affichent directement aux bonnes couleurs
  const appliedCacheId = useRef(null);
  if (user?.email) {
    const id = cacheId(user, isIndividualView);
    if (appliedCacheId.current !== id) {
      appliedCacheId.current = id;
      const cached = readCachedColors(id);
      if (cached) setBrandColors(cached.primary, cached.secondary, null, false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const id = cacheId(user, isIndividualView);
    const apply = (branding) => {
      setBrandColors(branding?.primary_color, branding?.secondary_color, id);
      applyLogo(branding?.club_logo_url);
    };

    const applyBranding = async () => {
      try {
        // Si vue individuelle coach : utiliser uniquement le branding perso
        const isCoach = user.user_status === 'coach' || user.user_status === 'coach_pro';
        if (isCoach && isIndividualView) {
          const brandings = await base44.entities.CoachBranding.filter({ coach_email: user.email });
          if (cancelled) return;
          apply(brandings[0] || null);
          return;
        }

        // Vérifier d'abord si l'utilisateur est dans un club
        const clubs = await base44.entities.Club.list();
        if (cancelled) return;
        // Un compte peut figurer dans plusieurs clubs (ex. ancien athlète devenu
        // coach ailleurs) : priorité au club correspondant à son rôle actuel.
        const isCoachClub = c => (c.coach_emails || []).includes(user.email);
        const isAthleteClub = c => (c.athlete_emails || []).includes(user.email);
        const myClub = isCoach
          ? clubs.find(isCoachClub) || clubs.find(isAthleteClub)
          : clubs.find(isAthleteClub) || clubs.find(isCoachClub);

        if (!isIndividualView && myClub && (myClub.primary_color || myClub.logo_url)) {
          // Appliquer le branding du club
          apply({ primary_color: myClub.primary_color, secondary_color: myClub.secondary_color, club_logo_url: myClub.logo_url });
          return;
        }

        // Fallback : branding de l'entraîneur
        let coachEmail = null;
        if (isCoach) {
          coachEmail = user.email;
        } else if (user.user_status === 'athlete') {
          const groups = await base44.entities.Group.list();
          if (cancelled) return;
          const myGroup = groups.find(g => g.athlete_emails?.includes(user.email));
          if (myGroup) coachEmail = myGroup.coach_email;
        }

        const brandings = coachEmail
          ? await base44.entities.CoachBranding.filter({ coach_email: coachEmail })
          : [];
        if (cancelled) return;
        apply(brandings[0] || null);
      } catch (e) {
        if (!cancelled && e?.message !== 'Request aborted') console.error('Erreur branding:', e);
      }
    };

    applyBranding();

    return () => { cancelled = true; };
  }, [user?.email, user?.user_status, currentPath]);
}

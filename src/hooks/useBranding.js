import { useEffect } from 'react';
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

export function useBranding(user, currentPath) {
  const isIndividualView = typeof window !== 'undefined' && localStorage.getItem('coachView') === 'individual';

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const applyBranding = async () => {
      try {
        // Si vue individuelle coach : utiliser uniquement le branding perso
        const isCoach = user.user_status === 'coach' || user.user_status === 'coach_pro';
        if (isCoach && isIndividualView) {
          document.getElementById('club-logo-bg')?.remove();
          document.getElementById('club-logo-layout')?.remove();
          document.body.style.backgroundImage = 'none';
          const layoutBg = document.getElementById('layout-bg');
          if (layoutBg) layoutBg.style.backgroundImage = '';
          const brandings = await base44.entities.CoachBranding.filter({ coach_email: user.email });
          if (cancelled) return;
          if (brandings.length > 0) {
            const b = brandings[0];
            if (b.secondary_color) document.documentElement.style.setProperty('--brand-secondary-color', b.secondary_color);
            if (b.primary_color) {
              const h = hexToHsl(b.primary_color);
              if (h) { document.documentElement.style.setProperty('--primary', h); document.documentElement.style.setProperty('--primary-foreground', '0 0% 100%'); }
              document.documentElement.style.setProperty('--brand-color', b.primary_color);
            }
            document.documentElement.style.removeProperty('--card');
            document.documentElement.style.removeProperty('--card-foreground');
            if (b.club_logo_url && layoutBg) {
              const logoDiv = document.createElement('div');
              logoDiv.id = 'club-logo-layout';
              logoDiv.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:20;background-repeat:no-repeat;background-position:center;background-size:35%;opacity:0.15;background-image:url('${b.club_logo_url}');`;
              layoutBg.style.position = 'relative';
              layoutBg.insertBefore(logoDiv, layoutBg.firstChild);
            }
          }
          return;
        }

        // Vérifier d'abord si l'utilisateur est dans un club
        const clubs = await base44.entities.Club.list();
        if (cancelled) return;
        const myClub = clubs.find(c =>
          (c.athlete_emails || []).includes(user.email) ||
          (c.coach_emails || []).includes(user.email)
        );

        if (!isIndividualView && myClub && (myClub.primary_color || myClub.logo_url)) {
          // Appliquer le branding du club
          const branding = { primary_color: myClub.primary_color, secondary_color: myClub.secondary_color, club_logo_url: myClub.logo_url };
          if (branding.secondary_color) {
            document.documentElement.style.setProperty('--brand-secondary-color', branding.secondary_color);
          }
          if (branding.primary_color) {
            const primaryHsl = hexToHsl(branding.primary_color);
            if (primaryHsl) {
              document.documentElement.style.setProperty('--primary', primaryHsl);
              document.documentElement.style.setProperty('--primary-foreground', '0 0% 100%');
            }
            document.documentElement.style.setProperty('--brand-color', branding.primary_color);
          }
          document.documentElement.style.removeProperty('--card');
          document.documentElement.style.removeProperty('--card-foreground');
          document.getElementById('club-logo-bg')?.remove();
          document.getElementById('club-logo-layout')?.remove();
          document.body.style.backgroundImage = 'none';
          const layoutBg = document.getElementById('layout-bg');
          if (layoutBg) layoutBg.style.backgroundImage = '';
          if (branding.club_logo_url && layoutBg) {
            const logoDiv = document.createElement('div');
            logoDiv.id = 'club-logo-layout';
            logoDiv.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:20;background-repeat:no-repeat;background-position:center;background-size:35%;opacity:0.15;background-image:url('${branding.club_logo_url}');`;
            layoutBg.style.position = 'relative';
            layoutBg.insertBefore(logoDiv, layoutBg.firstChild);
          }
          return;
        }

        // Fallback : branding de l'entraîneur
        let coachEmail = null;
        if (user.user_status === 'coach' || user.user_status === 'coach_pro') {
          coachEmail = user.email;
        } else if (user.user_status === 'athlete') {
          const groups = await base44.entities.Group.list();
          if (cancelled) return;
          const myGroup = groups.find(g => g.athlete_emails?.includes(user.email));
          if (myGroup) coachEmail = myGroup.coach_email;
        }

        if (!coachEmail) return;

        const brandings = await base44.entities.CoachBranding.filter({ coach_email: coachEmail });
        if (cancelled) return;
        if (brandings.length === 0) return;

        const branding = brandings[0];

        if (branding.secondary_color) {
          document.documentElement.style.setProperty('--brand-secondary-color', branding.secondary_color);
        }

        if (branding.primary_color) {
          const primaryHsl = hexToHsl(branding.primary_color);
          if (primaryHsl) {
            document.documentElement.style.setProperty('--primary', primaryHsl);
            document.documentElement.style.setProperty('--primary-foreground', '0 0% 100%');
          }
          document.documentElement.style.setProperty('--brand-color', branding.primary_color);
        }

        // Nettoyer les anciennes surcharges qui coloraient les fonds de cartes
        document.documentElement.style.removeProperty('--card');
        document.documentElement.style.removeProperty('--card-foreground');

        // Nettoyer les anciens divs s'ils existent
        document.getElementById('club-logo-bg')?.remove();
        document.getElementById('club-logo-layout')?.remove();
        document.body.style.backgroundImage = 'none';

        // Réinitialiser le style du layout
        const layoutBg = document.getElementById('layout-bg');
        if (layoutBg) {
          layoutBg.style.backgroundImage = '';
        }

        // Appliquer le logo comme div enfant absolu dans le layout
        if (branding.club_logo_url && layoutBg) {
          const logoDiv = document.createElement('div');
          logoDiv.id = 'club-logo-layout';
          logoDiv.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:20;background-repeat:no-repeat;background-position:center;background-size:35%;opacity:0.15;background-image:url('${branding.club_logo_url}');`;
          layoutBg.style.position = 'relative';
          layoutBg.insertBefore(logoDiv, layoutBg.firstChild);
        }
      } catch (e) {
        if (!cancelled && e?.message !== 'Request aborted') console.error('Erreur branding:', e);
      }
    };

    applyBranding();

    return () => { cancelled = true; };
  }, [user?.email, user?.user_status, currentPath]);
}
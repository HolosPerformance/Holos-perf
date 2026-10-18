import { useEffect, useRef, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';

// Réglages des menus AFE / Analyse réseau, indépendants des autres filtres du
// dashboard. Sauvegardés dans le profil (colonne profiles.analysis_settings)
// et, en secours, dans le navigateur si la colonne n'existe pas encore.

const STORAGE_KEY = 'holos-analysis-settings';

export const DEFAULT_ANALYSIS_SETTINGS = {
  efa: {
    excluded: [],
    nFactorsMode: 'auto',
    nFactors: 2,
    rotation: 'oblimin',
    loadingThreshold: 0.3,
    centerByAthlete: false,
  },
  network: {
    excluded: [],
    colorGroups: [],
    assignments: {},
    gamma: 0.5,
    edgeThreshold: 0,
    centrality: 'strength',
    centerByAthlete: false,
  },
  updatedAt: 0,
};

const merge = (saved) => ({
  efa: { ...DEFAULT_ANALYSIS_SETTINGS.efa, ...(saved?.efa || {}) },
  network: { ...DEFAULT_ANALYSIS_SETTINGS.network, ...(saved?.network || {}) },
  updatedAt: saved?.updatedAt || 0,
});

const readLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocal = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privée…) : la sauvegarde profil suffit
  }
};

// Garde la version la plus récente entre le profil et le navigateur
const pickLatest = (fromProfile, fromLocal) => {
  if (!fromProfile) return fromLocal;
  if (!fromLocal) return fromProfile;
  return (fromLocal.updatedAt || 0) > (fromProfile.updatedAt || 0) ? fromLocal : fromProfile;
};

export default function useAnalysisSettings(user) {
  const [settings, setSettings] = useState(() => merge(pickLatest(user?.analysis_settings, readLocal())));
  const dirty = useRef(false);
  const profileSaveFailed = useRef(false);

  useEffect(() => {
    setSettings(merge(pickLatest(user?.analysis_settings, readLocal())));
  }, [user?.email]);

  useEffect(() => {
    if (!dirty.current) return;
    writeLocal(settings);
    if (profileSaveFailed.current) return;
    const timer = setTimeout(async () => {
      try {
        await base44.auth.updateMe({ analysis_settings: settings });
      } catch (error) {
        // Colonne absente : on reste sur la sauvegarde navigateur
        profileSaveFailed.current = true;
        console.warn('Réglages d\'analyse non sauvegardés dans le profil :', error.message);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [settings]);

  const updateSection = (section, patch) => {
    dirty.current = true;
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...(typeof patch === 'function' ? patch(prev[section]) : patch) },
      updatedAt: Date.now(),
    }));
  };

  return [settings, updateSection];
}

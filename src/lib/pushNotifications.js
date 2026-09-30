/**
 * Web Push côté client : détection du support, abonnement, et persistance.
 *
 * Les préférences vivent dans la colonne jsonb `user_preferences.preferences`
 * (et non en colonnes plates) :
 *   { notifications_enabled, daily_reminder_time, email_reminders, push_subscription }
 */

import { supabaseRaw } from '@/api/supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const DEFAULT_REMINDER_TIME = '20:00';

/**
 * Créneaux proposés pour le rappel quotidien.
 *
 * Bornes et pas repris de supabase/functions/_shared/reminders.ts : l'émetteur
 * ne tourne qu'entre 7h00 et 23h30, et le cron passe toutes les 15 min avec une
 * tolérance de ±7 min. Proposer un autre créneau donnerait une heure que le
 * serveur ne saurait pas honorer. Ces trois valeurs vont donc de pair.
 */
const REMINDER_STEP_MINUTES = 15;
const REMINDER_FIRST_MINUTES = 7 * 60;
const REMINDER_LAST_MINUTES = 23 * 60 + 30;

const formatMinutes = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

export const REMINDER_TIME_OPTIONS = Array.from(
  { length: Math.floor((REMINDER_LAST_MINUTES - REMINDER_FIRST_MINUTES) / REMINDER_STEP_MINUTES) + 1 },
  (_, i) => formatMinutes(REMINDER_FIRST_MINUTES + i * REMINDER_STEP_MINUTES),
);

/** Ramène une heure enregistrée hors grille sur le créneau proposé le plus proche. */
export function snapToReminderSlot(time) {
  if (typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) return DEFAULT_REMINDER_TIME;
  const [h, m] = time.split(':').map(Number);
  const clamped = Math.min(
    Math.max(h * 60 + m, REMINDER_FIRST_MINUTES),
    REMINDER_LAST_MINUTES,
  );
  const snapped =
    Math.round((clamped - REMINDER_FIRST_MINUTES) / REMINDER_STEP_MINUTES) * REMINDER_STEP_MINUTES +
    REMINDER_FIRST_MINUTES;
  return formatMinutes(Math.min(snapped, REMINDER_LAST_MINUTES));
}

/** La clé publique VAPID est inlinée au build par Vite : absente = build mal configuré. */
export function isPushConfigured() {
  return typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.length > 0;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ se présente comme un Mac : on le distingue par le tactile.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Sur iOS, le web push exige que la PWA soit installée sur l'écran d'accueil. */
export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Raison pour laquelle l'abonnement est impossible, ou null si c'est jouable.
 * @returns {{code: string, message: string} | null}
 */
export function getPushBlocker() {
  if (!isPushSupported()) {
    if (isIOS() && !isStandalonePWA()) {
      return {
        code: 'ios-not-installed',
        message:
          "Sur iPhone, installe d'abord Holos sur ton écran d'accueil (Partager → Sur l'écran d'accueil), puis rouvre l'app depuis cette icône.",
      };
    }
    return {
      code: 'unsupported',
      message: "Ton navigateur ne gère pas les notifications push.",
    };
  }
  if (isIOS() && !isStandalonePWA()) {
    return {
      code: 'ios-not-installed',
      message:
        "Sur iPhone, les notifications ne fonctionnent que depuis l'app installée. Partager → Sur l'écran d'accueil, puis rouvre Holos depuis cette icône.",
    };
  }
  if (Notification.permission === 'denied') {
    return {
      code: 'denied',
      message:
        "Les notifications sont bloquées pour Holos. Réautorise-les dans les réglages de ton navigateur.",
    };
  }
  if (!isPushConfigured()) {
    return {
      code: 'misconfigured',
      message: "Les notifications ne sont pas configurées sur ce serveur.",
    };
  }
  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ─── Persistance ──────────────────────────────────────────────────────────────

/** @returns {Promise<{id: string|null, preferences: object}>} */
export async function loadPreferences(athleteEmail) {
  const { data, error } = await supabaseRaw
    .from('user_preferences')
    .select('id, preferences')
    .eq('athlete_email', athleteEmail)
    .maybeSingle();
  if (error) throw new Error(`Lecture des préférences : ${error.message}`);
  return { id: data?.id || null, preferences: data?.preferences || {} };
}

/**
 * Fusionne `patch` dans le jsonb existant, sans écraser les autres clés
 * (email_reminders notamment, géré ailleurs).
 */
export async function savePreferences(athleteEmail, patch) {
  const { preferences } = await loadPreferences(athleteEmail);
  const merged = { ...preferences, ...patch };
  const { data, error } = await supabaseRaw
    .from('user_preferences')
    .upsert(
      { athlete_email: athleteEmail, preferences: merged, updated_at: new Date().toISOString() },
      { onConflict: 'athlete_email' },
    )
    .select('id, preferences')
    .single();
  if (error) throw new Error(`Enregistrement des préférences : ${error.message}`);
  return data.preferences;
}

// ─── Abonnement ───────────────────────────────────────────────────────────────

/**
 * Abonnement effectif de CE navigateur, indépendamment de ce que dit la base.
 *
 * Un abonnement est lié à un couple (navigateur, origine) : celui enregistré
 * depuis un ordinateur ne vaut pas pour un téléphone. Sans cette vérification,
 * l'interface annoncerait « déjà activées » sur un appareil qui ne recevrait
 * jamais rien.
 *
 * @returns {Promise<string|null>} l'endpoint local, ou null
 */
export async function getLocalEndpoint() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription?.endpoint || null;
  } catch {
    return null;
  }
}

/** Les notifications sont-elles actives sur CET appareil ? */
export function isActiveOnThisDevice(preferences, localEndpoint) {
  if (!preferences || preferences.notifications_enabled === false) return false;
  const stored = preferences.push_subscription?.endpoint;
  return !!stored && !!localEndpoint && stored === localEndpoint;
}

/**
 * Demande la permission, s'abonne au service de push, et enregistre l'abonnement.
 * @returns {Promise<object>} les préférences à jour
 * @throws {Error} message déjà prêt à afficher
 */
export async function enablePushNotifications(athleteEmail) {
  const blocker = getPushBlocker();
  if (blocker) throw new Error(blocker.message);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error("Permission refusée. Tu peux la réactiver dans les réglages de ton navigateur.");
  }

  const registration = await navigator.serviceWorker.ready;

  // Un abonnement peut déjà exister (autre onglet, activation précédente).
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { preferences } = await loadPreferences(athleteEmail);
  return savePreferences(athleteEmail, {
    push_subscription: subscription.toJSON(),
    notifications_enabled: true,
    daily_reminder_time: preferences.daily_reminder_time || DEFAULT_REMINDER_TIME,
  });
}

/** Désabonne l'appareil et coupe les notifications côté serveur. */
export async function disablePushNotifications(athleteEmail) {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  }
  return savePreferences(athleteEmail, {
    push_subscription: null,
    notifications_enabled: false,
  });
}

/**
 * Logique pure « qui doit recevoir un rappel, maintenant ? ».
 * Sans I/O, pour être testable et pour garder la règle métier en un seul endroit.
 *
 * Deux rappels, mutuellement exclusifs sur une journée :
 *  - post-séance : 60 à 90 min après la fin d'une séance ayant un questionnaire lié
 *  - quotidien   : à l'heure choisie par l'athlète, si aucune séance du jour
 *                  n'a de questionnaire lié
 *
 * Cette exclusion reprend la règle de l'app (src/lib/pendingQuestionnaires.js,
 * supprimé depuis) : une séance sans questionnaire lié ne supprime PAS le rappel
 * quotidien — sinon l'athlète finirait la journée sans aucune sollicitation.
 */

export interface Preferences {
  notifications_enabled?: boolean;
  daily_reminder_time?: string;
  push_subscription?: PushSubscriptionJSON | null;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

export interface PreferenceRow {
  id: string;
  athlete_email: string;
  preferences: Preferences | null;
}

export interface EventRow {
  id: string;
  title: string;
  event_date: string;
  end_time: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  assigned_athletes: string[] | null;
  questionnaire_template_id: string | null;
  is_training_session: boolean | null;
}

export interface ResponseRow {
  athlete_email: string;
  event_id: string | null;
  template_id: string | null;
  submitted_date: string | null;
}

export interface TemplateRow {
  id: string;
  is_active: boolean | null;
  assigned_athletes: string[] | null;
}

export interface Reminder {
  athleteEmail: string;
  kind: 'session' | 'daily';
  title: string;
  body: string;
  url: string;
  subscription: PushSubscriptionJSON;
  preferenceId: string;
}

/** Minutes depuis minuit pour une chaîne "HH:MM". NaN si invalide. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
}

/** Fin de séance en minutes depuis minuit, via end_time ou start_time+durée. */
function sessionEndMinutes(event: EventRow): number {
  if (event.end_time) return toMinutes(event.end_time);
  if (event.start_time && event.duration_minutes) {
    return toMinutes(event.start_time) + event.duration_minutes;
  }
  return Number.NaN;
}

export interface ClockContext {
  /** Date du jour à Paris, format YYYY-MM-DD. */
  today: string;
  /** Minutes depuis minuit, heure de Paris. */
  nowMinutes: number;
}

/** Heure de Paris, indépendamment du fuseau du serveur. */
export function parisClock(now: Date = new Date()): ClockContext {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { today, nowMinutes: toMinutes(parts) };
}

export interface BuildInput {
  clock: ClockContext;
  preferences: PreferenceRow[];
  events: EventRow[];
  responses: ResponseRow[];
  templates: TemplateRow[];
  /** Ne cibler qu'un athlète (tests). */
  targetEmail?: string | null;
  /** Ignorer les contraintes horaires (tests). */
  ignoreSchedule?: boolean;
}

/** Fenêtre de tolérance du rappel quotidien, en minutes (cron toutes les 15 min). */
const DAILY_WINDOW_MINUTES = 7;
/** Le rappel post-séance part entre 60 et 90 min après la fin. */
const SESSION_DELAY_MIN = 60;
const SESSION_DELAY_MAX = 90;
/** Pas de notification en pleine nuit. */
const ACTIVE_FROM_MINUTES = 7 * 60;
const ACTIVE_UNTIL_MINUTES = 23 * 60 + 30;

export function buildReminders(input: BuildInput): Reminder[] {
  const { clock, preferences, events, responses, templates, targetEmail, ignoreSchedule } = input;
  const reminders: Reminder[] = [];

  const withinActiveHours =
    clock.nowMinutes >= ACTIVE_FROM_MINUTES && clock.nowMinutes <= ACTIVE_UNTIL_MINUTES;
  if (!ignoreSchedule && !withinActiveHours) return reminders;

  const subscribable = new Map<string, PreferenceRow>();
  for (const pref of preferences) {
    if (targetEmail && pref.athlete_email !== targetEmail) continue;
    const p = pref.preferences || {};
    if (p.notifications_enabled === false) continue;
    if (!p.push_subscription?.endpoint) continue;
    // Endpoint hors des services de push connus : jamais contacté (SSRF).
    if (!isAllowedPushEndpoint(p.push_subscription.endpoint)) {
      console.warn(`Endpoint de push refusé pour ${pref.athlete_email}`);
      continue;
    }
    subscribable.set(pref.athlete_email, pref);
  }
  if (subscribable.size === 0) return reminders;

  const todayEvents = events.filter(
    (e) => e.event_date === clock.today && e.is_training_session !== false,
  );

  // ─── Rappels post-séance ────────────────────────────────────────────────────
  const notifiedForSession = new Set<string>();

  for (const event of todayEvents) {
    if (!event.questionnaire_template_id) continue;
    const endMinutes = sessionEndMinutes(event);
    if (!Number.isFinite(endMinutes)) continue;

    if (!ignoreSchedule) {
      const elapsed = clock.nowMinutes - endMinutes;
      if (elapsed < SESSION_DELAY_MIN || elapsed > SESSION_DELAY_MAX) continue;
    }

    for (const athleteEmail of event.assigned_athletes || []) {
      const pref = subscribable.get(athleteEmail);
      if (!pref) continue;
      const answered = responses.some(
        (r) => r.athlete_email === athleteEmail && r.event_id === event.id,
      );
      if (answered) continue;

      notifiedForSession.add(athleteEmail);
      reminders.push({
        athleteEmail,
        kind: 'session',
        title: '🏋️ Questionnaire post-séance',
        body: `N'oublie pas de remplir ton questionnaire suite à la séance « ${event.title} » !`,
        url: '/AthleteHome',
        subscription: pref.preferences!.push_subscription!,
        preferenceId: pref.id,
      });
    }
  }

  // ─── Rappel quotidien ───────────────────────────────────────────────────────
  // Neutralisé pour les athlètes dont une séance du jour porte un questionnaire.
  const hasSessionQuestionnaireToday = new Set<string>();
  for (const event of todayEvents) {
    if (!event.questionnaire_template_id) continue;
    for (const athleteEmail of event.assigned_athletes || []) {
      hasSessionQuestionnaireToday.add(athleteEmail);
    }
  }

  for (const [athleteEmail, pref] of subscribable) {
    if (hasSessionQuestionnaireToday.has(athleteEmail)) continue;
    if (notifiedForSession.has(athleteEmail)) continue;

    const reminderTime = pref.preferences?.daily_reminder_time;
    if (!reminderTime) continue;

    if (!ignoreSchedule) {
      const target = toMinutes(reminderTime);
      if (!Number.isFinite(target)) continue;
      if (Math.abs(target - clock.nowMinutes) > DAILY_WINDOW_MINUTES) continue;
    }

    // Un questionnaire quotidien doit exister et lui être assigné.
    const assigned = templates.filter(
      (t) => t.is_active !== false && (t.assigned_athletes || []).includes(athleteEmail),
    );
    if (assigned.length === 0) continue;

    const answeredToday = responses.some((r) => {
      if (r.athlete_email !== athleteEmail || r.event_id) return false;
      if (!r.submitted_date) return false;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })
        .format(new Date(r.submitted_date));
      return day === clock.today;
    });
    if (answeredToday) continue;

    reminders.push({
      athleteEmail,
      kind: 'daily',
      title: '📋 Questionnaire du jour',
      body: "N'oublie pas de remplir ton questionnaire quotidien !",
      url: '/AthleteHome',
      subscription: pref.preferences!.push_subscription!,
      preferenceId: pref.id,
    });
  }

  return reminders;
}

// ─── Garde-fou SSRF ───────────────────────────────────────────────────────────
//
// `push_subscription.endpoint` est écrit par l'utilisateur sur sa propre ligne
// de `user_preferences`. Sans contrôle, il pourrait y placer une URL interne
// (métadonnées cloud, service privé) et faire émettre la requête par le serveur,
// qui est en position de confiance : c'est un SSRF.
//
// On n'accepte donc que les domaines des services de push légitimes, en HTTPS.

const ALLOWED_PUSH_HOSTS = [
  'android.googleapis.com',
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];
const ALLOWED_PUSH_SUFFIXES = ['.notify.windows.com', '.push.apple.com', '.push.services.mozilla.com'];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (ALLOWED_PUSH_HOSTS.includes(host)) return true;
  return ALLOWED_PUSH_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

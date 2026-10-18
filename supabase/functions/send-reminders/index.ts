/**
 * Envoi des rappels push (quotidien + post-séance).
 *
 * Appelée périodiquement par pg_cron (voir la migration cron), ou manuellement
 * pour tester :
 *   curl -X POST "$SUPABASE_URL/functions/v1/send-reminders" \
 *        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
 *        -H "Content-Type: application/json" \
 *        -d '{"athleteEmail":"bob@holos.test","ignoreSchedule":true}'
 *
 * Corps accepté (tout optionnel) :
 *   athleteEmail   : ne cibler qu'un athlète
 *   ignoreSchedule : ignorer les fenêtres horaires
 *   dryRun         : calculer sans envoyer
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { buildReminders, parisClock } from '../_shared/reminders.ts';
import type { EventRow, PreferenceRow, ResponseRow, TemplateRow } from '../_shared/reminders.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@holos.app';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Le jeton présenté porte-t-il le rôle `service_role` ?
 *
 * Une simple égalité avec SUPABASE_SERVICE_ROLE_KEY ne suffit pas : Supabase
 * émet plusieurs identifiants valides pour ce rôle — le JWT historique et le
 * format `sb_secret_…` — et la variable d'environnement n'en contient qu'un.
 * Comparer deux chaînes revenait donc à refuser l'autre, pourtant légitime.
 *
 * La signature du jeton n'est pas revérifiée ici : la plateforme l'a déjà fait
 * en amont (`verify_jwt` actif sur la fonction). Désactiver ce réglage rendrait
 * la revendication de rôle falsifiable — il doit rester activé.
 */
function estServiceRole(enTete: string): boolean {
  const jeton = enTete.replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return false;

  // Correspondance exacte avec le secret fourni par la plateforme, quel que soit son format.
  if (SERVICE_ROLE_KEY && jeton === SERVICE_ROLE_KEY) return true;

  // Sinon, JWT : on lit la revendication `role`.
  const parties = jeton.split('.');
  if (parties.length !== 3) return false;
  try {
    const charge = JSON.parse(
      atob(parties[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return charge?.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Réservé au service role : le cron et les tests manuels, jamais un athlète.
  if (!estServiceRole(req.headers.get('Authorization') || '')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'Clés VAPID absentes de la configuration' }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide accepté */ }
  const targetEmail = (body.athleteEmail as string) || null;
  const ignoreSchedule = body.ignoreSchedule === true;
  const dryRun = body.dryRun === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const clock = parisClock();

  const [prefsRes, eventsRes, responsesRes, templatesRes] = await Promise.all([
    supabase.from('user_preferences').select('id, athlete_email, preferences'),
    supabase
      .from('events')
      .select('id, title, event_date, start_time, end_time, duration_minutes, assigned_athletes, questionnaire_template_id, is_training_session')
      .eq('event_date', clock.today),
    // Seules les réponses récentes comptent : celles du jour pour le rappel
    // quotidien, celles des séances du jour pour le rappel post-séance.
    //
    // Sans ce filtre, la requête remontait l'ensemble de la table — or PostgREST
    // plafonne à 1000 lignes et renvoie les plus anciennes. Passé ce volume, les
    // réponses récentes disparaissaient du lot et la vérification « a déjà
    // répondu » devenait inopérante : des rappels partaient à des athlètes ayant
    // pourtant rempli leur questionnaire.
    //
    // La fenêtre de 48 h couvre la journée en cours quel que soit le décalage
    // horaire, tout en gardant le volume négligeable.
    supabase
      .from('questionnaire_responses')
      .select('athlete_email, event_id, template_id, submitted_date')
      .gte('submitted_date', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('questionnaire_templates')
      .select('id, is_active, assigned_athletes'),
  ]);

  for (const [label, res] of Object.entries({
    user_preferences: prefsRes,
    events: eventsRes,
    questionnaire_responses: responsesRes,
    questionnaire_templates: templatesRes,
  })) {
    if (res.error) return json({ error: `Lecture ${label} : ${res.error.message}` }, 500);
  }

  const reminders = buildReminders({
    clock,
    preferences: (prefsRes.data || []) as PreferenceRow[],
    events: (eventsRes.data || []) as EventRow[],
    responses: (responsesRes.data || []) as ResponseRow[],
    templates: (templatesRes.data || []) as TemplateRow[],
    targetEmail,
    ignoreSchedule,
  });

  if (dryRun) {
    return json({
      success: true,
      dryRun: true,
      clock,
      planned: reminders.map((r) => ({ athlete: r.athleteEmail, kind: r.kind, title: r.title })),
    });
  }

  let sent = 0;
  const failures: Array<{ athlete: string; reason: string }> = [];
  /** Endpoints morts : le navigateur a désinstallé l'app ou révoqué l'abonnement. */
  const expired: string[] = [];

  for (const reminder of reminders) {
    try {
      await webpush.sendNotification(
        reminder.subscription,
        JSON.stringify({ title: reminder.title, body: reminder.body, url: reminder.url }),
      );
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      const message = (err as Error).message || String(err);
      // 404/410 = abonnement définitivement invalide, on le purge.
      if (statusCode === 404 || statusCode === 410) {
        expired.push(reminder.preferenceId);
      }
      failures.push({ athlete: reminder.athleteEmail, reason: `${statusCode ?? '?'} ${message}` });
      console.error(`Push échoué pour ${reminder.athleteEmail}:`, statusCode, message);
    }
  }

  for (const preferenceId of new Set(expired)) {
    const { data: row } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('id', preferenceId)
      .maybeSingle();
    if (!row) continue;
    await supabase
      .from('user_preferences')
      .update({
        preferences: { ...(row.preferences || {}), push_subscription: null },
        updated_at: new Date().toISOString(),
      })
      .eq('id', preferenceId);
  }

  return json({
    success: true,
    clock,
    candidates: reminders.length,
    sent,
    expiredCleared: new Set(expired).size,
    failures,
  });
});

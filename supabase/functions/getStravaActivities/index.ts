/**
 * Renvoie les activités Strava d'un athlète, jeton rafraîchi si besoin.
 *
 * Appelée par `src/pages/ObjectiveData.jsx`. Un athlète ne voit que ses propres
 * activités ; un coach ou un administrateur peut viser un autre athlète via
 * `athlete_email`.
 *
 * Corps accepté (tout optionnel) :
 *   athlete_email : athlète visé, réservé aux coachs et administrateurs
 *   start_date    : date ISO (YYYY-MM-DD) de début de plage
 *   end_date      : date ISO (YYYY-MM-DD) de fin de plage, incluse
 *   after / before : horodatages Unix, si l'on préfère les donner directement
 *   per_page      : taille de page demandée à Strava, 200 au maximum
 *
 * Portage de `base44/functions/getStravaActivities/entry.ts`.
 */

import {
  getCaller,
  jetonValide,
  json,
  lireActivites,
  peutConsulterAutrui,
  preflight,
  serviceClient,
  type StravaTokenRow,
} from '../_shared/strava.ts';

/** Convertit une date ISO en horodatage Unix, ou `undefined` si inexploitable. */
function versUnix(valeur: unknown, finDeJournee = false): number | undefined {
  if (typeof valeur !== 'string' || !valeur) return undefined;
  const ms = new Date(finDeJournee ? `${valeur}T23:59:59` : valeur).getTime();
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

Deno.serve(async (req) => {
  const vol = preflight(req);
  if (vol) return vol;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = serviceClient();
  const caller = await getCaller(req, supabase);
  if (!caller) return json({ error: 'Non autorisé' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide accepté */ }

  const demande = typeof body.athlete_email === 'string' ? body.athlete_email : '';
  // Le statut vient du profil en base, jamais du corps de la requête : sans ce
  // contrôle, n'importe quel athlète lirait les activités d'un autre.
  if (demande && demande !== caller.email && !peutConsulterAutrui(caller)) {
    return json({ error: 'Non autorisé' }, 403);
  }
  const cible = demande || caller.email;

  const { data: token, error } = await supabase
    .from('strava_tokens')
    .select('id, athlete_email, access_token, refresh_token, expires_at, athlete_id')
    .eq('athlete_email', cible)
    .maybeSingle();

  if (error) {
    console.error('Lecture strava_tokens :', error.message);
    return json({ error: 'Lecture des jetons impossible' }, 500);
  }
  if (!token) {
    return json({ error: 'strava_not_connected', not_connected: true, athlete_email: cible });
  }

  let accessToken: string;
  try {
    accessToken = await jetonValide(supabase, token as StravaTokenRow);
  } catch (err) {
    // Jeton révoqué côté Strava : l'athlète doit reconnecter son compte.
    console.error(`Rafraîchissement Strava pour ${cible} :`, (err as Error).message);
    return json({ error: 'strava_not_connected', not_connected: true, athlete_email: cible });
  }

  const after = versUnix(body.start_date) ??
    (typeof body.after === 'number' ? body.after : undefined);
  const before = versUnix(body.end_date, true) ??
    (typeof body.before === 'number' ? body.before : undefined);

  try {
    const activities = await lireActivites(accessToken, {
      after,
      before,
      perPage: typeof body.per_page === 'number' ? body.per_page : undefined,
    });
    return json({ activities, athlete_email: cible });
  } catch (err) {
    console.error(`Lecture des activités Strava pour ${cible} :`, (err as Error).message);
    return json({ error: 'Lecture des activités Strava impossible' }, 502);
  }
});

/**
 * Échange le code d'autorisation Strava contre des jetons, et les stocke.
 *
 * Appelée par la page `src/pages/StravaCallback.jsx`, sur laquelle Strava
 * renvoie l'athlète après l'autorisation.
 *
 * Portage de `base44/functions/handleStravaCallback/entry.ts`.
 */

import {
  demanderJeton,
  getCaller,
  json,
  preflight,
  serviceClient,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
} from '../_shared/strava.ts';

Deno.serve(async (req) => {
  const vol = preflight(req);
  if (vol) return vol;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = serviceClient();
  const caller = await getCaller(req, supabase);
  if (!caller) return json({ error: 'Non autorisé' }, 401);

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return json({ error: 'Identifiants Strava absents de la configuration' }, 500);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide : traité comme code manquant */ }
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code) return json({ error: 'Code manquant' }, 400);

  const tokenData = await demanderJeton({ code, grant_type: 'authorization_code' });

  if (tokenData?.errors || !tokenData?.access_token) {
    // Le détail de Strava n'est pas renvoyé au navigateur : il peut contenir
    // l'identifiant de l'application.
    console.error('Échec de l\'échange du code Strava', tokenData?.errors ?? tokenData?.message);
    return json({ error: 'Échec de l\'échange du code' }, 400);
  }

  const athlete = tokenData.athlete ?? {};
  const prenomNom = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ');

  // Les jetons sont toujours rattachés à l'athlète connecté, jamais à un email
  // fourni dans le corps de la requête. `athlete_email` est unique sur la
  // table : un `upsert` remplace la connexion précédente.
  const { error } = await supabase
    .from('strava_tokens')
    .upsert({
      athlete_email: caller.email,
      athlete_id: athlete.id != null ? String(athlete.id) : null,
      athlete_name: prenomNom || null,
      profile_picture: athlete.profile_medium ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    }, { onConflict: 'athlete_email' });

  if (error) {
    console.error('Enregistrement des jetons Strava :', error.message);
    return json({ error: 'Enregistrement des jetons impossible' }, 500);
  }

  return json({
    success: true,
    athlete: {
      id: athlete.id ?? null,
      name: prenomNom || null,
      profile_picture: athlete.profile_medium ?? null,
    },
  });
});

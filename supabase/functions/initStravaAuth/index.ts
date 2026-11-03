/**
 * Construit l'URL d'autorisation Strava pour l'athlète connecté.
 *
 * Appelée par `src/components/StravaConnect.jsx`, qui redirige ensuite le
 * navigateur vers l'URL renvoyée.
 *
 * Portage de `base44/functions/initStravaAuth/entry.ts`.
 */

import {
  getCaller,
  json,
  preflight,
  serviceClient,
  STRAVA_CLIENT_ID,
  STRAVA_REDIRECT_URI,
  STRAVA_SCOPE,
} from '../_shared/strava.ts';

Deno.serve(async (req) => {
  const vol = preflight(req);
  if (vol) return vol;

  const supabase = serviceClient();
  const caller = await getCaller(req, supabase);
  if (!caller) return json({ error: 'Non autorisé' }, 401);

  if (!STRAVA_CLIENT_ID) {
    return json({ error: 'STRAVA_CLIENT_ID absent de la configuration' }, 500);
  }

  const authUrl = new URL('https://www.strava.com/oauth/authorize');
  authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', STRAVA_REDIRECT_URI);
  authUrl.searchParams.set('approval_prompt', 'force');
  authUrl.searchParams.set('scope', STRAVA_SCOPE);

  return json({ authUrl: authUrl.toString() });
});

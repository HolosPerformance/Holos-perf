/**
 * Socle commun aux trois fonctions Strava.
 *
 * Reprend la chaîne OAuth qui tournait côté Base44 (`base44/functions/…`) :
 * autorisation, échange du code, rafraîchissement du jeton et lecture des
 * activités. Le SDK Base44 est remplacé par le client Supabase Deno, et le
 * contrôle d'accès par une vérification du profil appelant.
 *
 * Secrets attendus (à poser avec `supabase secrets set`, jamais dans le dépôt) :
 *   STRAVA_CLIENT_ID      identifiant de l'application Strava
 *   STRAVA_CLIENT_SECRET  secret de l'application Strava
 *   STRAVA_REDIRECT_URI   optionnel, défaut https://holos-perf.vercel.app/StravaCallback
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') || '';
export const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '';

/**
 * Où Strava renvoie l'athlète après l'autorisation.
 *
 * Doit pointer vers la page `StravaCallback` servie par Vercel, et figurer à
 * l'identique dans le « Authorization Callback Domain » de l'application Strava.
 * Une adresse locale ici casserait la connexion en production.
 */
export const STRAVA_REDIRECT_URI =
  Deno.env.get('STRAVA_REDIRECT_URI') || 'https://holos-perf.vercel.app/StravaCallback';

/** Portées demandées : lecture du profil et de toutes les activités. */
export const STRAVA_SCOPE = 'read,activity:read_all,profile:read_all';

/**
 * En-têtes CORS.
 *
 * Contrairement à `send-reminders`, appelée par le cron, ces trois fonctions
 * sont invoquées depuis le navigateur : sans réponse au pré-vol `OPTIONS`,
 * l'appel échoue avant même d'atteindre le code.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Réponse au pré-vol CORS, ou `null` si la requête n'en est pas un. */
export const preflight = (req: Request) =>
  req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;

/** Client service role : seul habilité à lire et écrire `strava_tokens`. */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export type Caller = {
  id: string;
  email: string;
  user_status: string;
  role: string;
};

/**
 * Identifie l'appelant et charge son profil applicatif.
 *
 * `verify_jwt` est actif sur ces fonctions : la plateforme a déjà validé la
 * signature du jeton. Mais la clé anon est elle-même un JWT valide, d'où la
 * vérification explicite qu'il s'agit bien d'un utilisateur connecté.
 *
 * Le rôle fonctionnel (athlète / coach / admin) ne vit pas dans le jeton : il
 * est lu dans `public.profiles`, source de vérité du schéma. Il n'est jamais
 * pris dans le corps de la requête, que l'appelant contrôle.
 */
export async function getCaller(req: Request, supabase: SupabaseClient): Promise<Caller | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return null;

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user?.email) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, user_status, role')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email,
    user_status: profile?.user_status || 'athlete',
    role: profile?.role || 'user',
  };
}

/** Un coach, un coach pro ou un administrateur peut consulter un autre athlète. */
export function peutConsulterAutrui(caller: Caller): boolean {
  return caller.role === 'admin' ||
    caller.user_status === 'admin' ||
    caller.user_status === 'coach' ||
    caller.user_status === 'coach_pro';
}

export type StravaTokenRow = {
  id: string;
  athlete_email: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  athlete_id: string | null;
};

/** Appelle l'endpoint jeton de Strava (échange de code ou rafraîchissement). */
export async function demanderJeton(params: Record<string, string>) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      ...params,
    }),
  });
  return await res.json();
}

/**
 * Renvoie un jeton d'accès valide, en le rafraîchissant si besoin.
 *
 * La marge d'une minute évite qu'un jeton expire entre la vérification et
 * l'appel à l'API.
 */
export async function jetonValide(
  supabase: SupabaseClient,
  token: StravaTokenRow,
): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  if (token.access_token && (token.expires_at ?? 0) > maintenant + 60) {
    return token.access_token;
  }

  if (!token.refresh_token) throw new Error('strava_refresh_impossible');

  const data = await demanderJeton({
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  });

  if (!data?.access_token) {
    throw new Error('strava_refresh_refuse');
  }

  await supabase
    .from('strava_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
    .eq('id', token.id);

  return data.access_token;
}

/** Nombre maximum d'activités rendues par page par l'API Strava. */
const STRAVA_PAGE_MAX = 200;
/** Garde-fou : au-delà, la plage demandée est à restreindre côté appelant. */
const PAGES_MAX = 20;

/**
 * Lit les activités de l'athlète, page par page.
 *
 * Strava plafonne chaque réponse à 200 éléments et ne signale rien au-delà :
 * une plage d'un trimestre renvoyait donc silencieusement les 200 premières
 * activités. On enchaîne les pages jusqu'à en recevoir une incomplète.
 */
export async function lireActivites(
  accessToken: string,
  filtres: { before?: number; after?: number; perPage?: number },
): Promise<unknown[]> {
  const perPage = Math.min(filtres.perPage || STRAVA_PAGE_MAX, STRAVA_PAGE_MAX);
  const activites: unknown[] = [];

  for (let page = 1; page <= PAGES_MAX; page++) {
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    if (filtres.after !== undefined) url.searchParams.set('after', String(filtres.after));
    if (filtres.before !== undefined) url.searchParams.set('before', String(filtres.before));

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`strava_api_${res.status}`);
    }
    const lot = await res.json();
    if (!Array.isArray(lot)) throw new Error('strava_reponse_inattendue');

    activites.push(...lot);
    if (lot.length < perPage) break;
  }

  return activites;
}

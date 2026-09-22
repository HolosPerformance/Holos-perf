import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const redirectUri = Deno.env.get('STRAVA_REDIRECT_URI');

    const scope = 'read,activity:read_all,profile:read_all';

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri + '/StravaCallback')}&approval_prompt=force&scope=${scope}`;

    return Response.json({ authUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
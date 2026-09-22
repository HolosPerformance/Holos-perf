import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function refreshTokenIfNeeded(base44, tokenRecord) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenRecord.expires_at > now + 60) {
    return tokenRecord.access_token;
  }

  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRecord.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json();

  await base44.asServiceRole.entities.StravaToken.update(tokenRecord.id, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at
  });

  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { per_page = 30, page = 1, before, after, start_date, end_date, athlete_email: requestedEmail, user_id: requestedUserId } = body;

    const isCoachOrAdmin = user.role === 'admin' || user.user_status === 'coach' || user.user_status === 'coach_pro';
    const targetEmail = (isCoachOrAdmin && requestedEmail) ? requestedEmail : user.email;
    const targetUserId = (isCoachOrAdmin && requestedUserId) ? requestedUserId : user.id;

    // Chercher par user_id en priorité (plus fiable), sinon par email
    let tokens = targetUserId ? await base44.asServiceRole.entities.StravaToken.filter({ user_id: targetUserId }) : [];
    if (tokens.length === 0) {
      tokens = await base44.asServiceRole.entities.StravaToken.filter({ athlete_email: targetEmail });
    }

    if (tokens.length === 0) {
      return Response.json({ error: 'strava_not_connected', not_connected: true }, { status: 200 });
    }

    const accessToken = await refreshTokenIfNeeded(base44, tokens[0]);

    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}&page=${page}`;
    if (before) url += `&before=${before}`;
    if (after) url += `&after=${after}`;
    if (start_date) url += `&after=${Math.floor(new Date(start_date).getTime() / 1000)}`;
    if (end_date) url += `&before=${Math.floor(new Date(end_date + 'T23:59:59').getTime() / 1000)}`;

    const activitiesRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const activities = await activitiesRes.json();

    return Response.json({ activities, athlete_email: user.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
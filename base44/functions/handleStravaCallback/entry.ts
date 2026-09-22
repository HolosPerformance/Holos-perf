import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return Response.json({ error: 'Code manquant' }, { status: 400 });
    }

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');

    // Échanger le code contre des tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();

    if (tokenData.errors || !tokenData.access_token) {
      return Response.json({ error: 'Échec de l\'échange du code', details: tokenData }, { status: 400 });
    }

    // Sauvegarder ou mettre à jour les tokens en base (chercher par user_id d'abord, puis email)
    let existing = await base44.asServiceRole.entities.StravaToken.filter({ user_id: user.id });
    if (existing.length === 0) {
      existing = await base44.asServiceRole.entities.StravaToken.filter({ athlete_email: user.email });
    }

    const tokenRecord = {
      athlete_email: user.email,
      user_id: user.id,
      strava_athlete_id: String(tokenData.athlete?.id),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      strava_athlete_name: `${tokenData.athlete?.firstname} ${tokenData.athlete?.lastname}`,
      strava_profile_picture: tokenData.athlete?.profile_medium
    };

    if (existing.length > 0) {
      await base44.asServiceRole.entities.StravaToken.update(existing[0].id, tokenRecord);
    } else {
      await base44.asServiceRole.entities.StravaToken.create(tokenRecord);
    }

    return Response.json({ success: true, athlete: tokenData.athlete });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
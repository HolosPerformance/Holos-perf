import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_EMAIL')}`,
    Deno.env.get('VAPID_PUBLIC_KEY'),
    Deno.env.get('VAPID_PRIVATE_KEY')
  );

  const nowUTC = new Date();
  const parisNow = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const parisToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(nowUTC);
  const currentMinutes = parisNow.getHours() * 60 + parisNow.getMinutes();

  // Support targeting a specific athlete via function args (for per-athlete scheduling)
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const targetEmail = body?.athleteEmail || null;

  const preferences = await base44.asServiceRole.entities.UserPreference.list();
  const responses = await base44.asServiceRole.entities.QuestionnaireResponse.list();
  const events = await base44.asServiceRole.entities.Event.filter({ is_training_session: true });

  let sentCount = 0;

  for (const pref of preferences) {
    if (!pref.notifications_enabled || !pref.push_subscription || !pref.daily_reminder_time) continue;

    // If a specific athlete is targeted, skip others
    if (targetEmail && pref.athlete_email !== targetEmail) continue;

    // Check if reminder time matches current Paris time (±7 min window for 15-min polling)
    const [reminderHour, reminderMin] = pref.daily_reminder_time.split(':').map(Number);
    const reminderMinutes = reminderHour * 60 + reminderMin;
    if (Math.abs(reminderMinutes - currentMinutes) > 7) continue;

    // Skip if athlete had a training session today (session reminder handles it)
    const hadSessionToday = events.some(e =>
      e.event_date === parisToday &&
      (e.assigned_athletes || []).includes(pref.athlete_email)
    );
    if (hadSessionToday) continue;

    // Check if already responded to daily questionnaire today
    const alreadyResponded = responses.some(r => {
      if (r.athlete_email !== pref.athlete_email || r.event_id) return false;
      if (!r.submitted_date) return false;
      const submittedParisDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(r.submitted_date));
      return submittedParisDate === parisToday;
    });
    if (alreadyResponded) continue;

    try {
      await webpush.sendNotification(
        pref.push_subscription,
        JSON.stringify({
          title: '📋 Questionnaire du jour',
          body: "N'oublie pas de remplir ton questionnaire quotidien !",
          url: '/AthleteHome'
        })
      );
      sentCount++;
    } catch (err) {
      console.error(`Push failed for ${pref.athlete_email}:`, err.message);
    }
  }

  return Response.json({ success: true, sent: sentCount });
});
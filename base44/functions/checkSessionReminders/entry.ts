import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_EMAIL')}`,
    Deno.env.get('VAPID_PUBLIC_KEY'),
    Deno.env.get('VAPID_PRIVATE_KEY')
  );

  // Get current Paris time
  const nowUTC = new Date();
  const parisNow = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const parisToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(nowUTC);
  const parisHour = parisNow.getHours();

  const parisMinutes = parisNow.getMinutes();

  // Only run between 7h and 23h30 Paris time
  const afterStart = parisHour >= 7;
  const beforeEnd = parisHour < 23 || (parisHour === 23 && parisMinutes <= 30);
  if (!afterStart || !beforeEnd) {
    return Response.json({ success: true, sent: 0, skipped: 'outside active hours' });
  }

  const preferences = await base44.asServiceRole.entities.UserPreference.list();
  const responses = await base44.asServiceRole.entities.QuestionnaireResponse.list();
  const events = await base44.asServiceRole.entities.Event.filter({ is_training_session: true, event_date: parisToday });

  let sentCount = 0;

  for (const event of events) {
    if (!event.end_time || !event.assigned_athletes?.length) continue;

    // Compare in Paris time (minutes since midnight)
    const [endHour, endMin] = event.end_time.split(':').map(Number);
    const sessionEndMinutes = endHour * 60 + endMin;
    const currentMinutes = parisNow.getHours() * 60 + parisNow.getMinutes();
    const diff = currentMinutes - sessionEndMinutes;

    // Send notification if session ended between 60 and 90 minutes ago (1h to 1h30)
    if (diff < 60 || diff > 90) continue;

    for (const athleteEmail of event.assigned_athletes) {
      // Check if athlete already responded for this event
      const alreadyResponded = responses.some(r =>
        r.athlete_email === athleteEmail && r.event_id === event.id
      );
      if (alreadyResponded) continue;

      // Get push subscription
      const pref = preferences.find(p => p.athlete_email === athleteEmail);
      if (!pref?.push_subscription || pref?.notifications_enabled === false) continue;

      try {
        await webpush.sendNotification(
          pref.push_subscription,
          JSON.stringify({
            title: '🏋️ Questionnaire post-séance',
            body: `N'oublie pas de remplir ton questionnaire suite à la séance "${event.title}" !`,
            url: '/AthleteHome'
          })
        );
        sentCount++;
      } catch (err) {
        console.error(`Push failed for ${athleteEmail}:`, err.message);
      }
    }
  }

  return Response.json({ success: true, sent: sentCount });
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedStatuses = ['coach', 'coach_pro', 'admin'];
    if (!allowedStatuses.includes(user.user_status)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Utiliser le service role pour récupérer tous les utilisateurs
    const allUsers = await base44.asServiceRole.entities.User.list();

    return Response.json({ users: allUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
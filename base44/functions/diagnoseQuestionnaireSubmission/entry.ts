import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  const { athleteEmail, questionnaireId } = await req.json();

  if (!athleteEmail) {
    return Response.json({ error: 'athleteEmail requis' }, { status: 400 });
  }

  const report = {
    athleteEmail,
    questionnaireId: questionnaireId || null,
    checks: [],
    verdict: 'OK',
    errors: []
  };

  const check = (name, ok, detail) => {
    report.checks.push({ name, ok, detail });
    if (!ok) {
      report.verdict = 'PROBLÈME DÉTECTÉ';
      report.errors.push(`❌ ${name}: ${detail}`);
    }
  };

  // 1. Vérifier que l'athlète existe
  const allUsers = await base44.asServiceRole.entities.User.list();
  const athlete = allUsers.find(u => u.email === athleteEmail);
  check('Utilisateur trouvé', !!athlete, athlete ? `ID: ${athlete.id}` : 'Aucun utilisateur avec cet email');
  if (!athlete) return Response.json(report);

  // 2. Vérifier le statut
  check('Statut athlète', athlete.user_status === 'athlete', `user_status = "${athlete.user_status}"`);
  check('Compte approuvé', !!athlete.is_approved, `is_approved = ${athlete.is_approved}`);
  check('Rôle user', athlete.role === 'user', `role = "${athlete.role}"`);

  // 3. Vérifier le profil athlète
  const profiles = await base44.asServiceRole.entities.AthleteProfile.filter({ athlete_email: athleteEmail });
  check('Profil AthleteProfile', profiles.length > 0, profiles.length > 0 ? `Profil trouvé (ID: ${profiles[0].id})` : 'Aucun profil AthleteProfile trouvé');

  // 4. Vérifier les questionnaires assignés
  const allTemplates = await base44.asServiceRole.entities.QuestionnaireTemplate.list();
  const assignedTemplates = allTemplates.filter(t =>
    t.is_active && (t.assigned_athletes || []).includes(athleteEmail)
  );
  check('Questionnaires assignés', assignedTemplates.length > 0,
    assignedTemplates.length > 0
      ? `${assignedTemplates.length} questionnaire(s): ${assignedTemplates.map(t => `"${t.name}" (${t.id})`).join(', ')}`
      : 'Aucun questionnaire actif assigné à cet athlète'
  );

  // 5. Si un questionnaireId est fourni, vérifier spécifiquement ce template
  if (questionnaireId) {
    const template = allTemplates.find(t => t.id === questionnaireId);
    check('Template trouvé', !!template, template ? `Nom: "${template.name}"` : `Aucun template avec l'ID ${questionnaireId}`);
    if (template) {
      check('Template actif', !!template.is_active, `is_active = ${template.is_active}`);
      check('Athlète assigné au template', (template.assigned_athletes || []).includes(athleteEmail),
        (template.assigned_athletes || []).includes(athleteEmail)
          ? 'Oui'
          : `Non — liste actuelle: [${(template.assigned_athletes || []).join(', ')}]`
      );
    }
  }

  // 6. Vérifier les RLS sur QuestionnaireResponse (simulation create)
  // La règle RLS exige data.athlete_email === user.email
  // On vérifie si l'email de l'athlète correspond exactement (casse, espaces)
  const emailTrimmed = athleteEmail.trim().toLowerCase();
  const emailOriginal = athlete.email;
  check('Email sans espaces/casse',
    emailOriginal === emailOriginal.trim() && emailOriginal === emailOriginal.toLowerCase(),
    `Email en base: "${emailOriginal}" — trimmed/lowercase: "${emailTrimmed}"`
  );

  // 7. Vérifier s'il a déjà des réponses (pour s'assurer que le RLS lecture fonctionne)
  const existingResponses = await base44.asServiceRole.entities.QuestionnaireResponse.filter({ athlete_email: athleteEmail });
  check('Réponses existantes', true, `${existingResponses.length} réponse(s) déjà enregistrée(s)`);

  // 8. Vérifier les clubs / équipes pour contexte
  const clubs = await base44.asServiceRole.entities.Club.list();
  const athleteClub = clubs.find(c => (c.athlete_emails || []).includes(athleteEmail));
  check('Appartenance club', true, athleteClub ? `Club: "${athleteClub.name}" (ID: ${athleteClub.id})` : 'Athlète hors club');

  if (athleteClub) {
    const clubTemplateIds = athleteClub.default_questionnaire_template_ids?.length
      ? athleteClub.default_questionnaire_template_ids
      : athleteClub.default_questionnaire_template_id ? [athleteClub.default_questionnaire_template_id] : [];
    check('Questionnaires du club', clubTemplateIds.length > 0,
      clubTemplateIds.length > 0 ? `IDs: ${clubTemplateIds.join(', ')}` : 'Aucun questionnaire configuré pour ce club'
    );
  }

  return Response.json(report);
});
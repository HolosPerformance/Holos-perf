import { supabase as base44 } from '@/api/supabaseClient';

// Assignation d'athlètes à un entraîneur par l'administrateur.
//
// Elle est stockée dans athlete_profiles.assigned_coach_emails. Un athlète
// assigné n'est ajouté à aucun groupe : il s'ajoute simplement à la liste des
// athlètes suivis par l'entraîneur, et uniquement dans sa vue individuelle
// (la vue club reste limitée au club).

export const isIndividualCoachView = () => {
  try {
    return localStorage.getItem('coachView') === 'individual';
  } catch {
    return false;
  }
};

/** L'entraîneur est-il rattaché à un club ? */
export async function coachHasClub(coachEmail) {
  const clubs = await base44.entities.Club.list();
  return clubs.some(c => (c.coach_emails || []).includes(coachEmail));
}

/**
 * Athlètes assignés à afficher dans la vue courante : en vue individuelle,
 * ou quand l'entraîneur n'a pas de club. Un entraîneur sans club reste
 * souvent en « vue club » (permission club désactivée par défaut, donc pas
 * de bascule possible) : cette vue ne montre alors que ses propres athlètes.
 */
export async function fetchAssignedAthleteEmailsForView(coachEmail) {
  if (!coachEmail) return [];
  if (!isIndividualCoachView() && await coachHasClub(coachEmail)) return [];
  return fetchAssignedAthleteEmails(coachEmail);
}

/** E-mails des athlètes assignés à cet entraîneur. */
export async function fetchAssignedAthleteEmails(coachEmail) {
  if (!coachEmail) return [];
  const profiles = await base44.entities.AthleteProfile.filterContains('assigned_coach_emails', coachEmail);
  return [...new Set(profiles.map(p => p.athlete_email).filter(Boolean))];
}

/** E-mails des entraîneurs assignés à cet athlète. */
export async function fetchAssignedCoachEmails(athleteEmail) {
  if (!athleteEmail) return [];
  const profiles = await base44.entities.AthleteProfile.filter({ athlete_email: athleteEmail });
  return [...new Set(profiles.flatMap(p => p.assigned_coach_emails || []))];
}

/**
 * Athlètes individuels d'un entraîneur : ceux de tous ses groupes, plus ceux
 * que l'admin lui a assignés.
 */
export async function fetchIndividualAthleteEmails(coachEmail) {
  if (!coachEmail) return [];
  const [groups, assigned] = await Promise.all([
    base44.entities.Group.filter({ coach_email: coachEmail }),
    fetchAssignedAthleteEmails(coachEmail),
  ]);
  return [...new Set([...groups.flatMap(g => g.athlete_emails || []), ...assigned])];
}

/**
 * Ajoute ou retire un entraîneur de la liste d'un athlète. Crée la fiche
 * profil de l'athlète si elle n'existe pas encore.
 */
export async function setCoachAssignment({ athleteEmail, athleteName, coachEmail, assigned, profile }) {
  let current = profile;
  if (!current) {
    [current] = await base44.entities.AthleteProfile.filter({ athlete_email: athleteEmail });
  }
  if (!current) {
    if (!assigned) return null;
    return base44.entities.AthleteProfile.create({
      athlete_email: athleteEmail,
      athlete_name: athleteName || null,
      assigned_coach_emails: [coachEmail],
    });
  }
  const list = current.assigned_coach_emails || [];
  const has = list.includes(coachEmail);
  if (assigned === has) return current;
  return base44.entities.AthleteProfile.update(current.id, {
    assigned_coach_emails: assigned ? [...list, coachEmail] : list.filter(e => e !== coachEmail),
  });
}
